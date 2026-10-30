from __future__ import annotations

import feedparser

from news.models import NewsSource, SourceType
from news.services.fetchers.base import BaseFetcher
from news.services.http import NewsHttp
from news.services.body import feed_entry_body
from news.services.normalize import RawItem, canonicalize_url, clean_text, parse_datetime


class RSSFetcher(BaseFetcher):
    source_type = SourceType.RSS

    def fetch(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        response = http.get(
            source.fetch_target(),
            etag=source.last_etag,
            last_modified=source.last_modified,
        )
        source.last_etag = response.headers.get("ETag", "")[:255]
        source.last_modified = response.headers.get("Last-Modified", "")[:128]
        return self.parse_body(source, response.text, source.base_url)

    def parse_body(self, source: NewsSource, body: str, base_url: str = "") -> list[RawItem]:
        parsed = feedparser.parse(body)
        items: list[RawItem] = []
        for entry in parsed.entries:
            link = canonicalize_url(
                getattr(entry, "link", "") or "",
                base_url or source.base_url,
            )
            title = clean_text(getattr(entry, "title", "") or "", 400)
            if not link or not title:
                continue
            summary = clean_text(
                getattr(entry, "summary", "") or getattr(entry, "description", "") or "",
                2000,
            )
            body = feed_entry_body(entry)
            image = ""
            media = getattr(entry, "media_content", None) or getattr(entry, "media_thumbnail", None)
            if media:
                image = canonicalize_url(media[0].get("url", ""), source.base_url)
            if not image:
                for enc in getattr(entry, "enclosures", []) or []:
                    href = enc.get("href") or enc.get("url") or ""
                    typ = (enc.get("type") or "").lower()
                    if href and (typ.startswith("image/") or href.lower().endswith((".jpg", ".png", ".webp", ".jpeg"))):
                        image = canonicalize_url(href, source.base_url)
                        break
            published = parse_datetime(
                getattr(entry, "published", None)
                or getattr(entry, "updated", None)
                or getattr(entry, "published_parsed", None)
            )
            if hasattr(entry, "published_parsed") and entry.published_parsed and published is None:
                published = parse_datetime(
                    __import__("time").strftime("%a, %d %b %Y %H:%M:%S +0000", entry.published_parsed)
                )
            author = clean_text(getattr(entry, "author", "") or "", 200)
            items.append(
                RawItem(
                    url=link,
                    title=title,
                    summary=summary,
                    body=body,
                    image_url=image,
                    author=author,
                    published_at=published,
                    language=(source.config or {}).get("language", "en"),
                    tags=list((source.config or {}).get("tags") or []),
                )
            )
        return items


class AtomFetcher(RSSFetcher):
    source_type = SourceType.ATOM
