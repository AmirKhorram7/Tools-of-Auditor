"""Plain-text article bodies for the warehouse / ML path.

The feed card never renders this. We keep title + summary on the UI and store
the longest honest extract we can get from the feed, then (if short) from the
original page, still behind robots.txt and the shared rate limiter.
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from news.constants import MAX_BODY_CHARS, MIN_FULL_BODY_CHARS
from news.services.http import FetchError, NewsHttp, NotModified, RobotsBlocked
from news.services.normalize import clean_text

_NOISE = ("script", "style", "nav", "footer", "aside", "form", "noscript", "iframe")


def html_to_text(html: str, limit: int = MAX_BODY_CHARS) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(_NOISE):
        tag.decompose()
    return clean_text(soup.get_text(" ", strip=True), limit)


def extract_main_text(html: str, limit: int = MAX_BODY_CHARS) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(_NOISE):
        tag.decompose()
    node = soup.find("article") or soup.find("main") or soup.find(attrs={"role": "main"})
    if node is not None:
        return clean_text(node.get_text(" ", strip=True), limit)
    paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    return clean_text(" ".join(p for p in paras if p), limit)


def feed_entry_body(entry) -> str:
    """Best body RSS/Atom gave us (content:encoded / atom:content), else summary HTML."""
    for block in getattr(entry, "content", None) or []:
        value = ""
        if isinstance(block, dict):
            value = block.get("value") or ""
        else:
            value = getattr(block, "value", "") or ""
        text = html_to_text(value)
        if text:
            return text
    encoded = getattr(entry, "content_encoded", None) or getattr(entry, "encoded", None) or ""
    if encoded:
        text = html_to_text(str(encoded))
        if text:
            return text
    summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
    return html_to_text(str(summary))


def hydrate_body(http: NewsHttp, url: str, existing: str) -> str:
    """If the feed only gave an excerpt, pull the original page (robots-aware)."""
    current = (existing or "").strip()
    if len(current) >= MIN_FULL_BODY_CHARS:
        return current[:MAX_BODY_CHARS]
    if not url:
        return current
    try:
        response = http.get(url)
    except (RobotsBlocked, FetchError, NotModified):
        return current
    except Exception:
        return current
    extracted = extract_main_text(response.text)
    if len(extracted) > len(current):
        return extracted[:MAX_BODY_CHARS]
    return current[:MAX_BODY_CHARS]
