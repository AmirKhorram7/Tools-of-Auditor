"""Is a source (or every active source) fresh enough to skip a manual fetch?"""

from __future__ import annotations

from django.db.models import Max, Q
from django.utils import timezone as dj_tz

from news.models import FetchJob, FetchStatus, JobStatus, NewsSource

# Soft window: even if the source interval is longer, treat a recent OK fetch as current.
DEFAULT_FRESH_MINUTES = 30


def _threshold_minutes(source: NewsSource) -> int:
    interval = int(source.fetch_interval_minutes or 180)
    return max(5, min(interval, DEFAULT_FRESH_MINUTES))


def source_freshness(source: NewsSource, *, now=None) -> dict:
    now = now or dj_tz.now()
    last = source.last_fetched_at
    threshold = _threshold_minutes(source)
    age_minutes = None
    up_to_date = False
    if last is not None:
        age_minutes = max(0, int((now - last).total_seconds() // 60))
        # Fresh only after a successful poll (ok / not_modified) inside the window.
        if source.last_status in {FetchStatus.OK, FetchStatus.NOT_MODIFIED} and age_minutes < threshold:
            up_to_date = True
    running = FetchJob.objects.filter(
        status__in=[JobStatus.PENDING, JobStatus.RUNNING],
    ).filter(Q(source_id=source.pk) | Q(source__isnull=True)).exists()
    return {
        "id": source.pk,
        "slug": source.slug,
        "name": source.name,
        "color": (source.color or "").strip(),
        "is_active": source.is_active,
        "last_fetched_at": last,
        "last_status": source.last_status or "",
        "fetch_interval_minutes": source.fetch_interval_minutes,
        "fresh_within_minutes": threshold,
        "age_minutes": age_minutes,
        "up_to_date": up_to_date,
        "fetch_running": running,
    }


def catalog_freshness(*, source_id: int | None = None, include_inactive: bool = False) -> dict:
    now = dj_tz.now()
    qs = NewsSource.objects.all().order_by("name")
    if source_id:
        qs = qs.filter(pk=source_id)
    elif not include_inactive:
        qs = qs.filter(is_active=True)
    rows = [source_freshness(s, now=now) for s in qs]
    active_rows = [r for r in rows if r["is_active"]] or rows
    up_to_date = bool(active_rows) and all(r["up_to_date"] for r in active_rows)
    any_running = any(r["fetch_running"] for r in rows) or FetchJob.objects.filter(
        status__in=[JobStatus.PENDING, JobStatus.RUNNING],
        source__isnull=True,
    ).exists()
    latest = (
        NewsSource.objects.filter(is_active=True)
        .aggregate(m=Max("last_fetched_at"))
        .get("m")
    )
    return {
        "up_to_date": up_to_date,
        "fetch_running": any_running,
        "last_fetched_at": latest,
        "checked_at": now,
        "sources": rows,
        "message_key": (
            "running"
            if any_running
            else "up_to_date"
            if up_to_date
            else "stale"
        ),
    }
