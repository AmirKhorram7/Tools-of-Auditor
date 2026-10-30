from __future__ import annotations

from news.models import NewsSource
from news.services.http import NewsHttp
from news.services.normalize import RawItem


class BaseFetcher:
    """One adapter per source_type. Isolated: never raise out of ingest."""

    source_type = ""

    def fetch(self, source: NewsSource, http: NewsHttp) -> list[RawItem]:
        raise NotImplementedError

    def parse_body(self, source: NewsSource, body: str, base_url: str = "") -> list[RawItem]:
        """Used by tests with recorded fixtures — no network."""
        raise NotImplementedError
