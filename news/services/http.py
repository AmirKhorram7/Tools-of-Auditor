from __future__ import annotations

import logging
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from django.core.cache import cache

from news.constants import NEWS_USER_AGENT

log = logging.getLogger("news")

DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=8.0)
RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRIES = 3
MIN_INTERVAL_SECONDS = 2.0
ROBOTS_TTL = 6 * 3600


class FetchError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class RobotsBlocked(FetchError):
    pass


class NotModified(Exception):
    """HTTP 304 — caller should keep last_status = not_modified."""


def _domain(url: str) -> str:
    return urlsplit(url).netloc.lower()


def _robots_url(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


class NewsHttp:
    """Shared outbound client: UA, robots, rate limit, retries, ETag."""

    def __init__(self, client: httpx.Client | None = None, respect_robots: bool = True):
        self.respect_robots = respect_robots
        self._owns = client is None
        self.client = client or httpx.Client(
            headers={"User-Agent": NEWS_USER_AGENT, "Accept": "*/*"},
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
        )

    def close(self):
        if self._owns:
            self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def allowed_by_robots(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        key = f"news:robots:{_domain(url)}"
        raw = cache.get(key)
        if raw is None:
            robots = _robots_url(url)
            try:
                response = self.client.get(robots)
                raw = "" if response.status_code >= 400 else response.text
            except httpx.HTTPError:
                raw = ""
            cache.set(key, raw, ROBOTS_TTL)
        parser = RobotFileParser()
        parser.parse((raw or "").splitlines())
        try:
            return parser.can_fetch(NEWS_USER_AGENT, url)
        except Exception:
            return True

    def _rate_limit(self, url: str):
        domain = _domain(url)
        key = f"news:rate:{domain}"
        last = cache.get(key)
        now = time.monotonic()
        if last is not None:
            wait = MIN_INTERVAL_SECONDS - (now - float(last))
            if wait > 0:
                time.sleep(wait)
        cache.set(key, time.monotonic(), 60)

    def get(
        self,
        url: str,
        *,
        etag: str = "",
        last_modified: str = "",
        headers: dict | None = None,
    ) -> httpx.Response:
        if not self.allowed_by_robots(url):
            raise RobotsBlocked(f"robots.txt blocks {url}")
        self._rate_limit(url)
        extra = dict(headers or {})
        if etag:
            extra["If-None-Match"] = etag
        if last_modified:
            extra["If-Modified-Since"] = last_modified
        delay = 0.6
        last_exc: Exception | None = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.get(url, headers=extra)
                if response.status_code == 304:
                    raise NotModified()
                if response.status_code in RETRY_STATUSES and attempt < MAX_RETRIES - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                if response.status_code >= 400:
                    raise FetchError(
                        f"HTTP {response.status_code} for {url}",
                        status=response.status_code,
                    )
                return response
            except NotModified:
                raise
            except FetchError:
                raise
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt >= MAX_RETRIES - 1:
                    break
                time.sleep(delay)
                delay *= 2
        raise FetchError(f"request failed for {url}: {last_exc}")
