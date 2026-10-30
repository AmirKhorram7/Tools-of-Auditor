"""Global news fetch schedule. One row, superuser writes, beat reads."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone as dj_tz
from rest_framework.exceptions import ValidationError

from news.constants import (
    DEFAULT_INTERVAL_HOURS,
    FETCH_MODE_MANUAL,
    FETCH_MODE_SCHEDULED,
    INTERVAL_HOURS_MAX,
    INTERVAL_HOURS_MIN,
    INTERVAL_PRESETS_HOURS,
)
from news.models import FetchJob, JobTrigger, NewsPanelSettings
from news.permissions import user_is_news_admin

log = logging.getLogger("news")


class PanelSettingsService:
    def load(self) -> NewsPanelSettings:
        obj, _ = NewsPanelSettings.objects.get_or_create(
            pk=NewsPanelSettings.SINGLETON_PK,
            defaults={
                "fetch_mode": FETCH_MODE_MANUAL,
                "interval_hours": DEFAULT_INTERVAL_HOURS,
            },
        )
        return obj

    def snapshot(self, user=None) -> dict:
        row = self.load()
        return {
            "fetch_mode": row.fetch_mode,
            "interval_hours": row.interval_hours,
            "interval_presets": list(INTERVAL_PRESETS_HOURS),
            "last_scheduled_at": row.last_scheduled_at,
            "next_run_at": row.next_run_at(),
            "can_edit": user_is_news_admin(user) if user is not None else False,
            "updated_at": row.updated_at,
            "updated_by_id": row.updated_by_id,
        }

    def update(self, user, *, fetch_mode=None, interval_hours=None) -> dict:
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
        if not data:
            raise ValidationError("Provide fetch_mode and/or interval_hours.")
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
                },
            )
            if row.fetch_mode != FETCH_MODE_SCHEDULED:
                return 0
            due_at = row.last_scheduled_at + timedelta(hours=row.interval_hours) if row.last_scheduled_at else now
            if due_at > now:
                return 0
            job = FetchJob.objects.create(trigger=JobTrigger.SCHEDULED)
            row.last_scheduled_at = now
            row.save(update_fields=["last_scheduled_at", "updated_at"])
        from news.services.ingest import IngestService

        IngestService().run_job(job.pk)
        log.info("scheduled news job %s started", job.pk)
        return 1
