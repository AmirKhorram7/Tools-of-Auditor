from __future__ import annotations

import re
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from news.models import NewsSource, SourceType
from news.services.fetchers.base import BaseFetcher
from news.services.http import NewsHttp
from news.services.normalize import RawItem, canonicalize_url, clean_text, parse_datetime


def _slug(url: str) -> str:
    path = urlsplit(url).path.rstrip("/")
    return path.rsplit("/", 1)[-1] if path else ""


def _title_from_slug(url: str) -> str:
    return clean_text(_slug(url).replace("-", " "), 400)


class HTMLFetcher(BaseFetcher):
    """Static listing pages. Playwright is intentionally not used here."""

    source_type = SourceType.HTML

    def fetch(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        response = http.get(source.fetch_target())
        return self.parse_body(source, response.text, str(response.url) or source.base_url)

    def parse_body(self, source: NewsSource, body: str, base_url: str = "") -> list[RawItem]:
        cfg = source.config or {}
        soup = BeautifulSoup(body, "html.parser")
        item_sel = cfg.get("item_selector") or "article"
        link_sel = cfg.get("link_selector") or "a[href]"
        title_sel = cfg.get("title_selector") or "h2, h3, a"
        summary_sel = cfg.get("summary_selector") or "p"
        date_sel = cfg.get("date_selector") or "time"
        date_attr = cfg.get("date_attr") or "datetime"
        skip_slugs = {str(s).lower() for s in (cfg.get("skip_slugs") or [])}
        pattern = cfg.get("link_pattern")
        compiled = re.compile(pattern) if pattern else None
        origin = base_url or source.base_url
        listing = canonicalize_url(source.fetch_target() or origin, origin)
        nodes = soup.select(item_sel)
        if not nodes:
            nodes = soup.select(link_sel)
        items: list[RawItem] = []
        seen: set[str] = set()

        def accept(href: str) -> bool:
            if not href or href in seen:
                return False
            if listing and href.rstrip("/") == listing.rstrip("/"):
                return False
            if compiled and not compiled.search(href) and not compiled.search(urlsplit(href).path):
                return False
            if _slug(href).lower() in skip_slugs:
                return False
            return True

        for node in nodes:
            link_el = node.select_one(link_sel) if node.name != "a" else node
            if link_el is None:
                continue
            href = canonicalize_url(link_el.get("href") or "", origin)
            if not accept(href):
                continue
            title_el = node.select_one(title_sel) or link_el
            title = clean_text(title_el.get_text(" ", strip=True), 400) or _title_from_slug(href)
            if not title:
                continue
            summary_el = node.select_one(summary_sel)
            summary = clean_text(summary_el.get_text(" ", strip=True) if summary_el else "", 2000)
            date_el = node.select_one(date_sel)
            published = None
            if date_el is not None:
                published = parse_datetime(date_el.get(date_attr) or date_el.get_text())
            img = node.select_one("img")
            image = canonicalize_url(img.get("src") if img else "", origin)
            seen.add(href)
            items.append(
                RawItem(
                    url=href,
                    title=title,
                    summary=summary,
                    image_url=image,
                    published_at=published,
                    language=cfg.get("language", "en"),
                )
            )

        if compiled and (cfg.get("scan_html") or len(items) < 3):
            for match in compiled.finditer(body or ""):
                href = canonicalize_url(match.group(0), origin)
                if not accept(href):
                    continue
                seen.add(href)
                items.append(
                    RawItem(
                        url=href,
                        title=_title_from_slug(href),
                        language=cfg.get("language", "en"),
                    )
                )

        limit = int(cfg.get("limit") or 40)
        return items[:limit]
