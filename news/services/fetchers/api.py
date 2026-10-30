from __future__ import annotations

import json

from news.constants import AI_KEYWORDS
from news.models import NewsSource, SourceType
from news.services.fetchers.base import BaseFetcher
from news.services.http import NewsHttp
from news.services.normalize import RawItem, canonicalize_url, clean_text, parse_datetime

HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"
ARXIV_QUERY = "https://export.arxiv.org/api/query?search_query={q}&start=0&max_results=40&sortBy=submittedDate&sortOrder=descending"


def _matches_keywords(title: str, keywords: tuple[str, ...] | list[str]) -> bool:
    blob = (title or "").lower()
    return any(key in blob for key in keywords)


class APIFetcher(BaseFetcher):
    source_type = SourceType.API

    def fetch(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        kind = (source.config or {}).get("api_kind") or "json"
        if kind == "hn":
            return self._hn(source, http)
        if kind == "arxiv":
            return self._arxiv(source, http)
        response = http.get(source.fetch_target())
        return self.parse_body(source, response.text, source.base_url)

    def parse_body(self, source: NewsSource, body: str, base_url: str = "") -> list[RawItem]:
        cfg = source.config or {}
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return []
        rows = payload
        path = cfg.get("list_path")
        if path:
            for part in str(path).split("."):
                rows = rows.get(part, []) if isinstance(rows, dict) else []
        if not isinstance(rows, list):
            return []
        url_key = cfg.get("url_key") or "url"
        title_key = cfg.get("title_key") or "title"
        summary_key = cfg.get("summary_key") or "summary"
        date_key = cfg.get("date_key") or "published_at"
        items: list[RawItem] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            url = canonicalize_url(str(row.get(url_key) or ""), base_url or source.base_url)
            title = clean_text(str(row.get(title_key) or ""), 400)
            if not url or not title:
                continue
            items.append(
                RawItem(
                    url=url,
                    title=title,
                    summary=clean_text(str(row.get(summary_key) or ""), 2000),
                    body=clean_text(str(row.get(cfg.get("body_key") or "body") or row.get("content") or row.get("text") or ""), 100_000),
                    published_at=parse_datetime(row.get(date_key)),
                    language=cfg.get("language", "en"),
                )
            )
        return items[: int(cfg.get("limit") or 40)]

    def _hn(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        cfg = source.config or {}
        min_score = int(cfg.get("min_score") or 20)
        keywords = tuple(cfg.get("keywords") or AI_KEYWORDS)
        top = http.get(HN_TOP).json()
        if not isinstance(top, list):
            return []
        items: list[RawItem] = []
        for story_id in top[:80]:
            if len(items) >= 40:
                break
            try:
                data = http.get(HN_ITEM.format(id=story_id)).json()
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            title = clean_text(str(data.get("title") or ""), 400)
            url = canonicalize_url(str(data.get("url") or ""))
            if not title or not url:
                continue
            if int(data.get("score") or 0) < min_score:
                continue
            if not _matches_keywords(title, keywords):
                continue
            items.append(
                RawItem(
                    url=url,
                    title=title,
                    summary="",
                    body=clean_text(str(data.get("text") or ""), 100_000),
                    published_at=parse_datetime(data.get("time")),
                    language="en",
                    tags=["hacker-news"],
                )
            )
        return items

    def _arxiv(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        from news.services.fetchers.rss import RSSFetcher

        query = (source.config or {}).get("arxiv_query") or "cat:cs.AI"
        xml = http.get(ARXIV_QUERY.format(q=query.replace(" ", "+"))).text
        return RSSFetcher().parse_body(source, xml, "https://arxiv.org")
