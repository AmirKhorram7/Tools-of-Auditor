"""Singleton warehouse schedule. Superuser PATCH only."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone as dj_tz

from news.constants import (
    DEFAULT_WAREHOUSE_HOUR,
    DEFAULT_WAREHOUSE_INTERVAL_HOURS,
    DEFAULT_WAREHOUSE_MINUTE,
    WAREHOUSE_INTERVAL_MAX,
    WAREHOUSE_INTERVAL_MIN,
    WAREHOUSE_INTERVAL_PRESETS,
    WAREHOUSE_MINUTE_PRESETS,
)
from news.models import NewsWarehouseSettings


def _clamp_interval(value) -> int:
    try:
        hours = int(value)
    except (TypeError, ValueError):
        hours = DEFAULT_WAREHOUSE_INTERVAL_HOURS
    if hours in WAREHOUSE_INTERVAL_PRESETS:
        return hours
    hours = max(WAREHOUSE_INTERVAL_MIN, min(WAREHOUSE_INTERVAL_MAX, hours))
    return min(WAREHOUSE_INTERVAL_PRESETS, key=lambda preset: abs(preset - hours))


def _clamp_hour(value) -> int:
    try:
        hour = int(value)
    except (TypeError, ValueError):
        return DEFAULT_WAREHOUSE_HOUR
    return max(0, min(23, hour))


def _clamp_minute(value) -> int:
    try:
        minute = int(value)
    except (TypeError, ValueError):
        return DEFAULT_WAREHOUSE_MINUTE
    minute = max(0, min(59, minute))
    return min(WAREHOUSE_MINUTE_PRESETS, key=lambda preset: abs(preset - minute))


class WarehouseSettingsService:
    def get(self) -> NewsWarehouseSettings:
        obj, _ = NewsWarehouseSettings.objects.get_or_create(
            pk=NewsWarehouseSettings.SINGLETON_PK,
            defaults={
                "enabled": False,
                "interval_hours": DEFAULT_WAREHOUSE_INTERVAL_HOURS,
                "run_hour": DEFAULT_WAREHOUSE_HOUR,
                "run_minute": DEFAULT_WAREHOUSE_MINUTE,
            },
        )
        return obj

    def update(self, payload: dict, user=None) -> NewsWarehouseSettings:
        obj = self.get()
        if "enabled" in payload:
            obj.enabled = bool(payload["enabled"])
        if "interval_hours" in payload:
            obj.interval_hours = _clamp_interval(payload["interval_hours"])
        if "run_hour" in payload:
            obj.run_hour = _clamp_hour(payload["run_hour"])
        if "run_minute" in payload:
            obj.run_minute = _clamp_minute(payload["run_minute"])
        obj.updated_by = user if getattr(user, "is_authenticated", False) else None
        obj.save()
        return obj

    def as_dict(self, obj: NewsWarehouseSettings | None = None) -> dict:
        obj = obj or self.get()
        now = dj_tz.now()
        return {
            "enabled": obj.enabled,
            "interval_hours": obj.interval_hours,
            "run_hour": obj.run_hour,
            "run_minute": obj.run_minute,
            "interval_presets": list(WAREHOUSE_INTERVAL_PRESETS),
            "minute_presets": list(WAREHOUSE_MINUTE_PRESETS),
            "timezone": django_settings.TIME_ZONE,
            "configured": _clickhouse_configured(),
            "last_synced_at": obj.last_synced_at,
            "last_synced_id": obj.last_synced_id,
            "last_sync_count": obj.last_sync_count,
            "last_error": obj.last_error,
            "next_run_at": next_run_at(obj, now) if obj.enabled else None,
        }

    def is_due(self, now: datetime | None = None) -> bool:
        return is_due(self.get(), now)

    def claim_due(self) -> tuple[NewsWarehouseSettings | None, datetime | None]:
        """Beat tick: take the singleton if the off-peak window is open.

        Locks only this one-row table, never articles. Returns the previous
        last_synced_at so the copy can still pick up rows updated since then.
        """
        now = dj_tz.now()
        with transaction.atomic():
            obj = (
                NewsWarehouseSettings.objects.select_for_update()
                .filter(pk=NewsWarehouseSettings.SINGLETON_PK)
                .first()
            )
            if obj is None:
                return None, None
            if not is_due(obj, now):
                return None, None
            previous = obj.last_synced_at
            obj.last_synced_at = now
            obj.save(update_fields=["last_synced_at"])
            return obj, previous


def in_run_window(obj: NewsWarehouseSettings, now: datetime) -> bool:
    local = dj_tz.localtime(now)
    scheduled = local.replace(hour=obj.run_hour, minute=obj.run_minute, second=0, microsecond=0)
    return scheduled <= local < scheduled + timedelta(minutes=15)


def interval_elapsed(obj: NewsWarehouseSettings, now: datetime) -> bool:
    if obj.last_synced_at is None:
        return True
    return now - obj.last_synced_at >= timedelta(hours=obj.interval_hours)


def is_due(obj: NewsWarehouseSettings, now: datetime | None = None) -> bool:
    now = now or dj_tz.now()
    if not obj.enabled:
        return False
    return in_run_window(obj, now) and interval_elapsed(obj, now)


def next_run_at(obj: NewsWarehouseSettings, now: datetime | None = None) -> datetime:
    now = now or dj_tz.now()
    local = dj_tz.localtime(now)
    candidate = local.replace(hour=obj.run_hour, minute=obj.run_minute, second=0, microsecond=0)
    if candidate <= local:
        candidate += timedelta(days=1)
    if obj.last_synced_at is not None:
        earliest = obj.last_synced_at + timedelta(hours=obj.interval_hours)
        while candidate < earliest:
            candidate += timedelta(days=1)
    return candidate


def _clickhouse_configured() -> bool:
    from news.services.warehouse.client import clickhouse_configured

    return clickhouse_configured()
