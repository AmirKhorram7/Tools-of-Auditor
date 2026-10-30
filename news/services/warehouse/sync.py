"""Incremental Postgres → ClickHouse copy.

Reads articles with keyset pagination (id > last seen in ClickHouse). Never
SELECT FOR UPDATE on articles. Live traffic keeps using Postgres.
"""

from __future__ import annotations

import logging
from datetime import datetime

from django.utils import timezone as dj_tz

from news.constants import WAREHOUSE_SYNC_BATCH
from news.models import Article, NewsSource, NewsWarehouseSettings
from news.services.warehouse.client import WarehouseClient, get_warehouse_client
from news.services.warehouse.settings import WarehouseSettingsService

log = logging.getLogger(__name__)


def _dt(value) -> datetime | None:
    if value is None:
        return None
    if dj_tz.is_naive(value):
        return dj_tz.make_aware(value, dj_tz.utc)
    return value


def article_row(article: Article, synced_at: datetime) -> dict:
    source = article.source
    return {
        "id": int(article.pk),
        "source_id": int(source.pk),
        "source_slug": source.slug,
        "source_name": source.name,
        "source_category": source.category,
        "source_region": source.region,
        "source_type": source.source_type,
        "url": article.url,
        "canonical_url": article.canonical_url or "",
        "title": article.title,
        "summary": article.summary or "",
        "body": article.body or "",
        "title_fa": article.title_fa or "",
        "summary_fa": article.summary_fa or "",
        "author": article.author or "",
        "language": article.language or "en",
        "tags": list(article.tags or []),
        "published_at": _dt(article.published_at),
        "fetched_at": _dt(article.fetched_at) or synced_at,
        "updated_at": _dt(article.updated_at) or synced_at,
        "content_hash": article.content_hash,
        "translation_status": article.translation_status,
        "synced_at": synced_at,
    }


def source_row(source: NewsSource, synced_at: datetime) -> dict:
    return {
        "id": int(source.pk),
        "slug": source.slug,
        "name": source.name,
        "base_url": source.base_url,
        "feed_url": source.feed_url,
        "source_type": source.source_type,
        "region": source.region,
        "category": source.category,
        "is_active": 1 if source.is_active else 0,
        "last_status": source.last_status,
        "last_fetched_at": _dt(source.last_fetched_at),
        "synced_at": synced_at,
    }


class WarehouseSyncService:
    def __init__(self, client: WarehouseClient | None = None):
        self.client = client
        self.settings = WarehouseSettingsService()

    def _client(self) -> WarehouseClient | None:
        if self.client is not None:
            return self.client
        return get_warehouse_client()

    def sync(self, *, force: bool = False, since: datetime | None = None) -> dict:
        """Copy new (and updated) articles. Returns a compact status dict."""
        cfg = self.settings.get()
        if not force and not cfg.enabled:
            return {"ok": True, "skipped": True, "reason": "disabled", "copied": 0}

        client = self._client()
        if client is None:
            message = "ClickHouse is not configured (set CLICKHOUSE_HOST)."
            self._record(cfg, copied=0, last_id=cfg.last_synced_id, error=message)
            return {"ok": False, "skipped": True, "reason": "unconfigured", "copied": 0, "error": message}

        now = dj_tz.now()
        client.ensure_schema()
        # Trust ClickHouse's own max(id) so a stale Django watermark cannot skip rows.
        watermark = int(client.max_article_id() or 0)
        copied = 0
        last_id = watermark
        source_ids: set[int] = set()
        update_since = since if since is not None else cfg.last_synced_at

        qs = (
            Article.objects.filter(id__gt=watermark)
            .select_related("source")
            .order_by("id")
            .iterator(chunk_size=WAREHOUSE_SYNC_BATCH)
        )
        batch: list[dict] = []
        for article in qs:
            batch.append(article_row(article, now))
            source_ids.add(article.source_id)
            last_id = int(article.pk)
            if len(batch) >= WAREHOUSE_SYNC_BATCH:
                copied += client.insert_articles(batch)
                batch = []
        if batch:
            copied += client.insert_articles(batch)

        copied += self._sync_updates(client, watermark, now, source_ids, update_since)

        if source_ids:
            sources = NewsSource.objects.filter(pk__in=source_ids)
            client.upsert_sources([source_row(src, now) for src in sources])

        self._record(cfg, copied=copied, last_id=max(last_id, cfg.last_synced_id), error="")
        return {
            "ok": True,
            "skipped": False,
            "copied": copied,
            "last_id": max(last_id, cfg.last_synced_id),
            "watermark": watermark,
        }

    def _sync_updates(
        self,
        client: WarehouseClient,
        watermark: int,
        now: datetime,
        source_ids: set[int],
        since: datetime | None,
    ) -> int:
        """Rows already in ClickHouse whose Postgres copy changed (title_fa, body)."""
        if not since or watermark <= 0:
            return 0
        qs = (
            Article.objects.filter(id__lte=watermark, updated_at__gt=since)
            .select_related("source")
            .order_by("id")
            .iterator(chunk_size=WAREHOUSE_SYNC_BATCH)
        )
        copied = 0
        batch: list[dict] = []
        for article in qs:
            batch.append(article_row(article, now))
            source_ids.add(article.source_id)
            if len(batch) >= WAREHOUSE_SYNC_BATCH:
                copied += client.insert_articles(batch)
                batch = []
        if batch:
            copied += client.insert_articles(batch)
        return copied

    def _record(self, cfg: NewsWarehouseSettings, *, copied: int, last_id: int, error: str) -> None:
        cfg.last_synced_at = dj_tz.now()
        cfg.last_synced_id = last_id
        cfg.last_sync_count = copied
        cfg.last_error = error[:4000]
        cfg.save(
            update_fields=["last_synced_at", "last_synced_id", "last_sync_count", "last_error"]
        )

    def run_if_due(self) -> dict:
        claimed, previous = self.settings.claim_due()
        if claimed is None:
            return {"ok": True, "skipped": True, "reason": "not_due", "copied": 0}
        try:
            return self.sync(force=True, since=previous)
        except Exception as exc:  # noqa: BLE001
            claimed.last_error = str(exc)[:4000]
            claimed.last_synced_at = previous
            claimed.save(update_fields=["last_error", "last_synced_at"])
            log.exception("warehouse sync failed")
            return {"ok": False, "skipped": False, "reason": "error", "copied": 0, "error": str(exc)[:4000]}
