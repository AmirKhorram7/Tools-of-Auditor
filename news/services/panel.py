"""Global news fetch schedule. One row, superuser writes, beat reads."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone as dj_tz
from rest_framework.exceptions import ValidationError

from news.constants import (
    DEFAULT_INTERVAL_HOURS,
    DEFAULT_PANEL_HOUR,
    DEFAULT_PANEL_MINUTE,
    FETCH_MODE_MANUAL,
    FETCH_MODE_SCHEDULED,
    INTERVAL_HOURS_MAX,
    INTERVAL_HOURS_MIN,
    INTERVAL_PRESETS_HOURS,
    PANEL_MINUTE_PRESETS,
)
from news.models import FetchJob, JobTrigger, NewsPanelSettings
from news.permissions import user_is_news_admin

log = logging.getLogger("news")


def _clamp_hour(value) -> int:
    try:
        hour = int(value)
    except (TypeError, ValueError):
        return DEFAULT_PANEL_HOUR
    return max(0, min(23, hour))


def _clamp_minute(value) -> int:
    try:
        minute = int(value)
    except (TypeError, ValueError):
        return DEFAULT_PANEL_MINUTE
    minute = max(0, min(59, minute))
    return min(PANEL_MINUTE_PRESETS, key=lambda preset: abs(preset - minute))


def in_run_window(obj: NewsPanelSettings, now: datetime) -> bool:
    local = dj_tz.localtime(now)
    scheduled = local.replace(hour=obj.run_hour, minute=obj.run_minute, second=0, microsecond=0)
    return scheduled <= local < scheduled + timedelta(minutes=15)


def interval_elapsed(obj: NewsPanelSettings, now: datetime) -> bool:
    if obj.last_scheduled_at is None:
        return True
    return now - obj.last_scheduled_at >= timedelta(hours=obj.interval_hours)


def is_due(obj: NewsPanelSettings, now: datetime | None = None) -> bool:
    now = now or dj_tz.now()
    if obj.fetch_mode != FETCH_MODE_SCHEDULED:
        return False
    return in_run_window(obj, now) and interval_elapsed(obj, now)


def next_run_at(obj: NewsPanelSettings, now: datetime | None = None) -> datetime:
    now = now or dj_tz.now()
    local = dj_tz.localtime(now)
    candidate = local.replace(hour=obj.run_hour, minute=obj.run_minute, second=0, microsecond=0)
    if candidate <= local:
        candidate += timedelta(days=1)
    if obj.last_scheduled_at is not None:
        earliest = obj.last_scheduled_at + timedelta(hours=obj.interval_hours)
        while candidate < earliest:
            candidate += timedelta(days=1)
    return candidate


class PanelSettingsService:
    def load(self) -> NewsPanelSettings:
        obj, _ = NewsPanelSettings.objects.get_or_create(
            pk=NewsPanelSettings.SINGLETON_PK,
            defaults={
                "fetch_mode": FETCH_MODE_MANUAL,
                "interval_hours": DEFAULT_INTERVAL_HOURS,
                "run_hour": DEFAULT_PANEL_HOUR,
                "run_minute": DEFAULT_PANEL_MINUTE,
            },
        )
        return obj

    def snapshot(self, user=None) -> dict:
        row = self.load()
        return {
            "fetch_mode": row.fetch_mode,
            "interval_hours": row.interval_hours,
            "run_hour": row.run_hour,
            "run_minute": row.run_minute,
            "interval_presets": list(INTERVAL_PRESETS_HOURS),
            "minute_presets": list(PANEL_MINUTE_PRESETS),
            "timezone": django_settings.TIME_ZONE,
            "last_scheduled_at": row.last_scheduled_at,
            "next_run_at": row.next_run_at(),
            "can_edit": user_is_news_admin(user) if user is not None else False,
            "updated_at": row.updated_at,
            "updated_by_id": row.updated_by_id,
        }

    def update(
        self,
        user,
        *,
        fetch_mode=None,
        interval_hours=None,
        run_hour=None,
        run_minute=None,
    ) -> dict:
        data = {}
        if fetch_mode is not None:
            if fetch_mode not in {FETCH_MODE_MANUAL, FETCH_MODE_SCHEDULED}:
                raise ValidationError({"fetch_mode": "Use `manual` or `scheduled`."})
            data["fetch_mode"] = fetch_mode
        if interval_hours is not None:
            try:
                hours = int(interval_hours)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"interval_hours": "Must be an integer."}) from exc
            if hours < INTERVAL_HOURS_MIN or hours > INTERVAL_HOURS_MAX:
                raise ValidationError(
                    {
                        "interval_hours": (
                            f"Must be between {INTERVAL_HOURS_MIN} and {INTERVAL_HOURS_MAX} hours."
                        )
                    }
                )
            data["interval_hours"] = hours
        if run_hour is not None:
            data["run_hour"] = _clamp_hour(run_hour)
        if run_minute is not None:
            data["run_minute"] = _clamp_minute(run_minute)
        if not data:
            raise ValidationError(
                "Provide fetch_mode, interval_hours, run_hour, and/or run_minute."
            )
        row = self.load()
        for key, value in data.items():
            setattr(row, key, value)
        row.updated_by = user
        row.save()
        return self.snapshot(user)

    def run_if_due(self) -> int:
        """Beat entry. 1 if a scheduled job started, else 0. Never runs in manual mode."""
        now = dj_tz.now()
        with transaction.atomic():
            row, _ = NewsPanelSettings.objects.select_for_update().get_or_create(
                pk=NewsPanelSettings.SINGLETON_PK,
                defaults={
                    "fetch_mode": FETCH_MODE_MANUAL,
                    "interval_hours": DEFAULT_INTERVAL_HOURS,
                    "run_hour": DEFAULT_PANEL_HOUR,
                    "run_minute": DEFAULT_PANEL_MINUTE,
                },
            )
            if not is_due(row, now):
                return 0
            job = FetchJob.objects.create(trigger=JobTrigger.SCHEDULED)
            row.last_scheduled_at = now
            row.save(update_fields=["last_scheduled_at", "updated_at"])
        from news.services.ingest import IngestService

        IngestService().run_job(job.pk)
        log.info("scheduled news job %s started", job.pk)
        return 1
