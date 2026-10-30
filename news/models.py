"""News panel models.

Global (not tenant-scoped): one catalog of sources and articles for the
whole platform. Access is gated by the News Team group, not by company.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from news.constants import (
    DEFAULT_INTERVAL_HOURS,
    DEFAULT_WAREHOUSE_HOUR,
    DEFAULT_WAREHOUSE_INTERVAL_HOURS,
    DEFAULT_WAREHOUSE_MINUTE,
    FETCH_MODE_CHOICES,
    FETCH_MODE_MANUAL,
    FETCH_MODE_SCHEDULED,
    LANGUAGE_CHOICES,
    LANGUAGE_EN,
)


class SourceType(models.TextChoices):
    RSS = "rss", _("RSS")
    ATOM = "atom", _("Atom")
    SITEMAP = "sitemap", _("Sitemap")
    HTML = "html", _("HTML")
    API = "api", _("API")


class FetchStatus(models.TextChoices):
    OK = "ok", _("OK")
    NOT_MODIFIED = "not_modified", _("Not modified")
    ERROR = "error", _("Error")
    SKIPPED = "skipped", _("Skipped")


class JobStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    RUNNING = "running", _("Running")
    DONE = "done", _("Done")
    FAILED = "failed", _("Failed")


class JobTrigger(models.TextChoices):
    MANUAL = "manual", _("Manual")
    SCHEDULED = "scheduled", _("Scheduled")


class TranslationStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    DONE = "done", _("Done")
    FAILED = "failed", _("Failed")
    SKIPPED = "skipped", _("Skipped")


class NewsSource(models.Model):
    """An origin we poll. Failures on one source never stop the others."""

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=80, unique=True)
    base_url = models.URLField()
    feed_url = models.URLField(blank=True, default="")
    source_type = models.CharField(max_length=16, choices=SourceType.choices, default=SourceType.RSS)
    region = models.CharField(max_length=32, default="global")
    category = models.CharField(max_length=32, default="media")
    color = models.CharField(
        max_length=7,
        blank=True,
        default="",
        help_text=_("Hex accent for Signal cards/detail (e.g. #e8a87c). Empty → frontend fallback."),
    )
    is_active = models.BooleanField(default=True)
    fetch_interval_minutes = models.PositiveIntegerField(default=180)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=16, choices=FetchStatus.choices, blank=True, default="")
    last_error = models.TextField(blank=True, default="")
    last_etag = models.CharField(max_length=255, blank=True, default="")
    last_modified = models.CharField(max_length=128, blank=True, default="")
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("Adapter extras: CSS selectors, API kind, keyword filters."),
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_active", "source_type"], name="news_src_active_type"),
            models.Index(fields=["category", "region"], name="news_src_cat_region"),
        ]

    def __str__(self):
        return self.name

    def fetch_target(self) -> str:
        return (self.feed_url or self.base_url).strip()


class Article(models.Model):
    """One story. The Signal card shows title + summary and links out.

    `body` is the full extracted text for ClickHouse / later ML. It is not
    rendered on the feed. Detail page uses brief / key_points / paragraphs
    (excerpts or licensed full text) — never republish `body` wholesale unless
    the source license allows it.
    """

    source = models.ForeignKey(
        NewsSource,
        on_delete=models.PROTECT,
        related_name="articles",
    )
    url = models.URLField(max_length=700, unique=True)
    canonical_url = models.URLField(max_length=700, blank=True, default="")
    title = models.CharField(max_length=400)
    summary = models.TextField(blank=True, default="")
    body = models.TextField(blank=True, default="")
    image_url = models.URLField(max_length=700, blank=True, default="")
    author = models.CharField(max_length=200, blank=True, default="")
    published_at = models.DateTimeField(null=True, blank=True)
    fetched_at = models.DateTimeField()
    updated_at = models.DateTimeField(auto_now=True)
    language = models.CharField(max_length=8, default=LANGUAGE_EN)
    title_fa = models.CharField(max_length=400, blank=True, default="")
    summary_fa = models.TextField(blank=True, default="")
    brief = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Up to 3 EN bullets for the 30-second brief."),
    )
    brief_fa = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Up to 3 FA bullets for the 30-second brief."),
    )
    key_points = models.JSONField(
        default=list,
        blank=True,
        help_text=_("[{title, text, title_fa, text_fa}, …] — usually 3."),
    )
    paragraphs = models.JSONField(
        default=list,
        blank=True,
        help_text=_("[{en, fa}, …] story excerpts (or full text when licensed)."),
    )
    why_it_matters = models.TextField(blank=True, default="")
    why_it_matters_fa = models.TextField(blank=True, default="")
    entities = models.JSONField(
        default=list,
        blank=True,
        help_text=_("[{type, name}, …] Model / Org / Topic chips."),
    )
    reading_minutes = models.PositiveSmallIntegerField(default=0)
    translation_status = models.CharField(
        max_length=16,
        choices=TranslationStatus.choices,
        default=TranslationStatus.PENDING,
    )
    content_hash = models.CharField(max_length=64)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-published_at", "-id"]
        indexes = [
            models.Index(fields=["-published_at"], name="news_art_published"),
            models.Index(fields=["source", "-published_at"], name="news_art_source_pub"),
            models.Index(fields=["content_hash"], name="news_art_hash"),
            models.Index(fields=["canonical_url"], name="news_art_canonical"),
            models.Index(fields=["updated_at"], name="news_art_updated"),
        ]

    def __str__(self):
        return self.title[:80]


class FetchJob(models.Model):
    """One on-demand or beat-triggered ingest run."""

    source = models.ForeignKey(
        NewsSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
        help_text=_("Empty means every active source."),
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_fetch_jobs",
    )
    date_from = models.DateField(null=True, blank=True)
    date_to = models.DateField(null=True, blank=True)
    trigger = models.CharField(
        max_length=16,
        choices=JobTrigger.choices,
        default=JobTrigger.MANUAL,
        help_text=_("manual = Start fetch / admin. scheduled = beat using panel settings."),
    )
    status = models.CharField(max_length=16, choices=JobStatus.choices, default=JobStatus.PENDING)
    found_count = models.PositiveIntegerField(default=0)
    new_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    error_log = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="news_job_created"),
            models.Index(fields=["status"], name="news_job_status"),
        ]

    def __str__(self):
        target = self.source.slug if self.source_id else "all"
        return f"job {self.pk} {target} {self.status}"


class NewsPanelSettings(models.Model):
    """Singleton: how the global news fetch job runs.

    Superusers set this from `GET/PATCH /api/v1/news/panel/` (the settings
    page). Django admin is a backup. Not tenant-scoped.
    """

    SINGLETON_PK = 1

    fetch_mode = models.CharField(
        max_length=16,
        choices=FETCH_MODE_CHOICES,
        default=FETCH_MODE_MANUAL,
        help_text=_("manual: only Start fetch. scheduled: beat runs all active sources on the interval."),
    )
    interval_hours = models.PositiveSmallIntegerField(
        default=DEFAULT_INTERVAL_HOURS,
        help_text=_("Used when fetch_mode is scheduled. 24 = once a day."),
    )
    last_scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("When the last scheduled (beat) run actually started."),
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_panel_updates",
    )

    class Meta:
        verbose_name = _("News panel settings")
        verbose_name_plural = _("News panel settings")

    def __str__(self):
        if self.fetch_mode == FETCH_MODE_MANUAL:
            return "News fetch: manual"
        return f"News fetch: every {self.interval_hours}h"

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_PK
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return None

    def next_run_at(self):
        from datetime import timedelta

        from django.utils import timezone as dj_tz

        if self.fetch_mode != FETCH_MODE_SCHEDULED:
            return None
        if not self.last_scheduled_at:
            return dj_tz.now()
        return self.last_scheduled_at + timedelta(hours=self.interval_hours)


class NewsWarehouseSettings(models.Model):
    """Singleton: off-peak copy of articles from Postgres to ClickHouse.

    Superusers set this from GET/PATCH /api/v1/news/warehouse/. Default is
    off so a fresh deploy does not open a warehouse connection until someone
    opts in. Beat only fires inside the run_hour window.
    """

    SINGLETON_PK = 1

    enabled = models.BooleanField(
        default=False,
        help_text=_("Off: never copy. On: copy new rows on the interval at run_hour."),
    )
    interval_hours = models.PositiveSmallIntegerField(
        default=DEFAULT_WAREHOUSE_INTERVAL_HOURS,
        help_text=_("24, 48, 72, 168 (weekly), 720 (monthly)."),
    )
    run_hour = models.PositiveSmallIntegerField(
        default=DEFAULT_WAREHOUSE_HOUR,
        help_text=_("Hour in TIME_ZONE (Asia/Tehran). 2 = 02:00, off the live site."),
    )
    run_minute = models.PositiveSmallIntegerField(
        default=DEFAULT_WAREHOUSE_MINUTE,
        help_text=_("0–59. Beat ticks every 15 minutes, so 0 is the usual value."),
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_synced_id = models.PositiveBigIntegerField(default=0)
    last_sync_count = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_warehouse_updates",
    )

    class Meta:
        verbose_name = _("News warehouse settings")
        verbose_name_plural = _("News warehouse settings")

    def __str__(self):
        if not self.enabled:
            return "Warehouse: off"
        return f"Warehouse: every {self.interval_hours}h at {self.run_hour:02d}:{self.run_minute:02d}"

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_PK
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return None


class NewsPreference(models.Model):
    """Per-user EN/FA choice for the news panel (not tenant-scoped)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="news_preference",
    )
    language = models.CharField(max_length=8, choices=LANGUAGE_CHOICES, default=LANGUAGE_EN)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"news lang {self.language} user {self.user_id}"
