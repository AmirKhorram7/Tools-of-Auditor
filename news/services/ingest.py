from __future__ import annotations

import logging
from datetime import datetime, time, timezone

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone as dj_tz

from news.models import Article, FetchJob, FetchStatus, JobStatus, JobTrigger, NewsSource, TranslationStatus

from news.constants import HYDRATE_CAP_PER_SOURCE, MAX_BODY_CHARS, MIN_FULL_BODY_CHARS
from news.services.body import hydrate_body
from news.services.detail import seed_reader_fields
from news.services.fetchers import fetcher_for
from news.services.http import FetchError, NewsHttp, NotModified, RobotsBlocked
from news.services.normalize import RawItem, canonicalize_url, clean_text, content_hash

log = logging.getLogger("news")


class IngestService:
    """Run one source or a FetchJob. Per-source errors are swallowed and logged."""

    def run_due(self) -> int:
        """Beat / `fetch_news --due`. Honors News panel settings (manual vs scheduled)."""
        from news.services.panel import PanelSettingsService

        return PanelSettingsService().run_if_due()

    def queue_job(
        self,
        *,
        source=None,
        requested_by=None,
        date_from=None,
        date_to=None,
        trigger: str = JobTrigger.MANUAL,
        delay: bool = True,
    ) -> FetchJob:
        job = FetchJob.objects.create(
            source=source,
            requested_by=requested_by,
            date_from=date_from,
            date_to=date_to,
            trigger=trigger,
        )
        if delay:
            from news.tasks import run_fetch_job

            run_fetch_job.delay(job.pk)
        else:
            self.run_job(job.pk)
        job.refresh_from_db()
        return job

    def run_job(self, job_id: int) -> FetchJob:
        job = FetchJob.objects.select_related("source").get(pk=job_id)
        job.status = JobStatus.RUNNING
        job.started_at = dj_tz.now()
        job.save(update_fields=["status", "started_at"])
        sources = (
            NewsSource.objects.filter(pk=job.source_id)
            if job.source_id
            else NewsSource.objects.filter(is_active=True)
        )
        errors: list[str] = []
        with NewsHttp() as http:
            for source in sources:
                try:
                    counts = self.fetch_source(
                        source,
                        http,
                        date_from=job.date_from,
                        date_to=job.date_to,
                    )
                    job.found_count += counts["found"]
                    job.new_count += counts["new"]
                    job.skipped_count += counts["skipped"]
                    job.failed_count += counts["failed"]
                except Exception as exc:  # noqa: BLE001 - isolate sources
                    job.failed_count += 1
                    errors.append(f"{source.slug}: {exc}")
                    log.exception("source %s failed", source.slug)
                    source.last_status = FetchStatus.ERROR
                    source.last_error = str(exc)[:2000]
                    source.last_fetched_at = dj_tz.now()
                    source.save(update_fields=["last_status", "last_error", "last_fetched_at"])
        job.error_log = "\n".join(errors)[:8000]
        job.status = JobStatus.FAILED if errors and not job.new_count and not job.found_count else JobStatus.DONE
        if errors and job.found_count:
            job.status = JobStatus.DONE
        job.finished_at = dj_tz.now()
        job.save()
        return job

    def fetch_source(
        self,
        source: NewsSource,
        http: NewsHttp,
        *,
        date_from=None,
        date_to=None,
    ) -> dict[str, int]:
        counts = {"found": 0, "new": 0, "skipped": 0, "failed": 0}
        try:
            items = fetcher_for(source.source_type).fetch(source, http)
        except NotModified:
            source.last_status = FetchStatus.NOT_MODIFIED
            source.last_error = ""
            source.last_fetched_at = dj_tz.now()
            source.save(update_fields=["last_status", "last_error", "last_fetched_at", "last_etag", "last_modified"])
            return counts
        except RobotsBlocked as exc:
            source.last_status = FetchStatus.SKIPPED
            source.last_error = str(exc)[:2000]
            source.last_fetched_at = dj_tz.now()
            source.save(update_fields=["last_status", "last_error", "last_fetched_at"])
            counts["skipped"] += 1
            return counts
        except FetchError as exc:
            source.last_status = FetchStatus.ERROR
            source.last_error = str(exc)[:2000]
            source.last_fetched_at = dj_tz.now()
            source.save(update_fields=["last_status", "last_error", "last_fetched_at"])
            counts["failed"] += 1
            return counts

        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
        end = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
        created_ids: list[int] = []
        hydrations = 0
        for item in items:
            counts["found"] += 1
            try:
                article = self._upsert(
                    source,
                    item,
                    start,
                    end,
                    http=http,
                    allow_hydrate=hydrations < HYDRATE_CAP_PER_SOURCE,
                )
            except Exception as exc:  # noqa: BLE001
                counts["failed"] += 1
                log.warning("item failed %s: %s", item.url, exc)
                continue
            if article is None:
                counts["skipped"] += 1
            else:
                counts["new"] += 1
                created_ids.append(article.pk)
                if len(item.body or "") < MIN_FULL_BODY_CHARS:
                    hydrations += 1

        source.last_status = FetchStatus.OK
        source.last_error = ""
        source.last_fetched_at = dj_tz.now()
        source.save(
            update_fields=[
                "last_status",
                "last_error",
                "last_fetched_at",
                "last_etag",
                "last_modified",
            ]
        )
        if created_ids:
            from news.tasks import translate_article

            for pk in created_ids:
                translate_article.delay(pk)
        return counts

    def _upsert(
        self,
        source: NewsSource,
        item: RawItem,
        start: datetime | None,
        end: datetime | None,
        *,
        http: NewsHttp | None = None,
        allow_hydrate: bool = True,
    ) -> Article | None:
        url = canonicalize_url(item.url, source.base_url)
        title = clean_text(item.title, 400)
        if not url or not title:
            return None
        published = item.published_at
        if start and published and published < start:
            return None
        if end and published and published > end:
            return None
        digest = content_hash(title, item.summary, url)
        canonical = canonicalize_url(item.url, source.base_url)
        if Article.objects.filter(url=url).exists():
            return None
        if canonical and Article.objects.filter(canonical_url=canonical).exists():
            return None
        if Article.objects.filter(content_hash=digest).exists():
            return None
        summary = clean_text(item.summary, 2000)
        body = clean_text(item.body or "", MAX_BODY_CHARS) or summary
        hydrate_on = bool(getattr(django_settings, "NEWS_HYDRATE_BODIES", True))
        if hydrate_on and http is not None and allow_hydrate:
            body = hydrate_body(http, url, body)
        now = dj_tz.now()
        reader = seed_reader_fields(body=body, summary=summary, source_name=source.name)
        with transaction.atomic():
            article = Article.objects.create(
                source=source,
                url=url,
                canonical_url=canonical,
                title=title,
                summary=summary,
                body=body,
                image_url=(item.image_url or "")[:700],
                author=clean_text(item.author, 200),
                published_at=published,
                fetched_at=now,
                language=item.language or "en",
                translation_status=TranslationStatus.PENDING,
                content_hash=digest,
                tags=item.tags or [],
                brief=reader["brief"],
                paragraphs=reader["paragraphs"],
                reading_minutes=reader["reading_minutes"],
                entities=reader["entities"],
            )
        return article
