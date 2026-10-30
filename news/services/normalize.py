from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import struct_time
from urllib.parse import urldefrag, urljoin, urlsplit, urlunsplit

_WS = re.compile(r"\s+")


@dataclass
class RawItem:
    url: str
    title: str
    summary: str = ""
    body: str = ""
    image_url: str = ""
    author: str = ""
    published_at: datetime | None = None
    language: str = "en"
    tags: list[str] = field(default_factory=list)


def canonicalize_url(url: str, base: str = "") -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if base and not raw.startswith(("http://", "https://")):
        raw = urljoin(base, raw)
    raw, _frag = urldefrag(raw)
    parts = urlsplit(raw)
    host = parts.netloc.lower()
    path = parts.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    query = parts.query
    return urlunsplit((parts.scheme.lower() or "https", host, path, query, ""))


def clean_text(value: str, limit: int = 4000) -> str:
    text = _WS.sub(" ", (value or "")).strip()
    return text[:limit]


def content_hash(title: str, summary: str, url: str) -> str:
    payload = f"{clean_text(title, 400).lower()}\n{clean_text(summary, 800).lower()}\n{canonicalize_url(url)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_datetime(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    if isinstance(value, struct_time):
        try:
            return datetime(*value[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        dt = parsedate_to_datetime(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, OverflowError):
        pass
    iso = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None
