from __future__ import annotations

import xml.etree.ElementTree as ET

from news.models import NewsSource, SourceType
from news.services.fetchers.base import BaseFetcher
from news.services.http import NewsHttp
from news.services.normalize import RawItem, canonicalize_url, clean_text, parse_datetime

NS = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "news": "http://www.google.com/schemas/sitemap-news/0.9",
}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


class SitemapFetcher(BaseFetcher):
    source_type = SourceType.SITEMAP

    def fetch(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        response = http.get(source.fetch_target())
        return self.parse_body(source, response.text, source.base_url)

    def parse_body(self, source: NewsSource, body: str, base_url: str = "") -> list[RawItem]:
        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            return []
        items: list[RawItem] = []
        for url_el in root.iter():
            if _local(url_el.tag) != "url":
                continue
            loc = ""
            title = ""
            published = None
            for child in list(url_el):
                name = _local(child.tag)
                if name == "loc" and child.text:
                    loc = canonicalize_url(child.text.strip(), base_url or source.base_url)
                elif name == "lastmod" and child.text:
                    published = parse_datetime(child.text.strip())
                elif name == "news":
                    for news_child in list(child):
                        n = _local(news_child.tag)
                        if n == "title" and news_child.text:
                            title = clean_text(news_child.text, 400)
                        elif n == "publication_date" and news_child.text:
                            published = parse_datetime(news_child.text.strip()) or published
            if not loc:
                continue
            if not title:
                title = clean_text(loc.rsplit("/", 1)[-1].replace("-", " "), 400) or loc
            items.append(
                RawItem(
                    url=loc,
                    title=title,
                    published_at=published,
                    language=(source.config or {}).get("language", "en"),
                )
            )
        limit = int((source.config or {}).get("limit") or 80)
        return items[:limit]
