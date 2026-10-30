from news.models import SourceType
from news.services.fetchers.api import APIFetcher
from news.services.fetchers.base import BaseFetcher
from news.services.fetchers.html import HTMLFetcher
from news.services.fetchers.rss import AtomFetcher, RSSFetcher
from news.services.fetchers.sitemap import SitemapFetcher

FETCHERS: dict[str, type[BaseFetcher]] = {
    SourceType.RSS: RSSFetcher,
    SourceType.ATOM: AtomFetcher,
    SourceType.SITEMAP: SitemapFetcher,
    SourceType.HTML: HTMLFetcher,
    SourceType.API: APIFetcher,
}


def fetcher_for(source_type: str) -> BaseFetcher:
    cls = FETCHERS.get(source_type, RSSFetcher)
    return cls()
