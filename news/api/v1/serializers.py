from rest_framework import serializers

from news.constants import (
    FETCH_MODE_CHOICES,
    INTERVAL_HOURS_MAX,
    INTERVAL_HOURS_MIN,
    LANGUAGE_CHOICES,
    LANGUAGE_EN,
    LANGUAGE_FA,
    WAREHOUSE_INTERVAL_PRESETS,
    WAREHOUSE_MINUTE_PRESETS,
)
from news.models import Article, FetchJob, NewsPreference, NewsSource, TranslationStatus


class NewsAccessSerializer(serializers.Serializer):
    allowed = serializers.BooleanField()
    is_fetch_admin = serializers.BooleanField()
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
    group = serializers.CharField()


class NewsSettingsSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)


class NewsPanelSerializer(serializers.Serializer):
    fetch_mode = serializers.ChoiceField(choices=FETCH_MODE_CHOICES)
    interval_hours = serializers.IntegerField(min_value=INTERVAL_HOURS_MIN, max_value=INTERVAL_HOURS_MAX)
    interval_presets = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    last_scheduled_at = serializers.DateTimeField(read_only=True, allow_null=True)
    next_run_at = serializers.DateTimeField(read_only=True, allow_null=True)
    can_edit = serializers.BooleanField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    updated_by_id = serializers.IntegerField(read_only=True, allow_null=True)


class NewsWarehouseSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    interval_hours = serializers.IntegerField()
    run_hour = serializers.IntegerField()
    run_minute = serializers.IntegerField()
    interval_presets = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    minute_presets = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    timezone = serializers.CharField(read_only=True)
    configured = serializers.BooleanField(read_only=True)
    last_synced_at = serializers.DateTimeField(read_only=True, allow_null=True)
    last_synced_id = serializers.IntegerField(read_only=True)
    last_sync_count = serializers.IntegerField(read_only=True)
    last_error = serializers.CharField(read_only=True, allow_blank=True)
    next_run_at = serializers.DateTimeField(read_only=True, allow_null=True)


class NewsWarehouseWriteSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    interval_hours = serializers.IntegerField(required=False)
    run_hour = serializers.IntegerField(min_value=0, max_value=23, required=False)
    run_minute = serializers.IntegerField(required=False)

    def validate_interval_hours(self, value):
        if value not in WAREHOUSE_INTERVAL_PRESETS:
            raise serializers.ValidationError("Use 24, 48, 72, 168 (weekly), or 720 (monthly).")
        return value

    def validate_run_minute(self, value):
        if value not in WAREHOUSE_MINUTE_PRESETS:
            raise serializers.ValidationError("Use 0, 15, 30, or 45 (beat ticks every 15 minutes).")
        return value


class NewsWarehouseSyncSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    skipped = serializers.BooleanField()
    copied = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True)
    last_id = serializers.IntegerField(required=False)
    watermark = serializers.IntegerField(required=False)
    error = serializers.CharField(required=False, allow_blank=True)


class NewsPanelWriteSerializer(serializers.Serializer):
    fetch_mode = serializers.ChoiceField(choices=FETCH_MODE_CHOICES, required=False)
    interval_hours = serializers.IntegerField(
        min_value=INTERVAL_HOURS_MIN,
        max_value=INTERVAL_HOURS_MAX,
        required=False,
    )


class NewsSourceSerializer(serializers.ModelSerializer):
    color = serializers.SerializerMethodField()

    class Meta:
        model = NewsSource
        fields = [
            "id",
            "name",
            "slug",
            "base_url",
            "feed_url",
            "source_type",
            "region",
            "category",
            "color",
            "is_active",
            "fetch_interval_minutes",
            "last_fetched_at",
            "last_status",
        ]
        read_only_fields = fields

    def get_color(self, obj: NewsSource) -> str:
        from news.services.detail import source_color

        return source_color(obj)


class ArticleDetailSourceSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    slug = serializers.SlugField()
    name = serializers.CharField()
    color = serializers.CharField()
    source_type = serializers.CharField(required=False)
    category = serializers.CharField(required=False)


class ArticleKeyPointSerializer(serializers.Serializer):
    title = serializers.CharField(allow_blank=True)
    text = serializers.CharField(allow_blank=True)
    title_fa = serializers.CharField(allow_blank=True, required=False)
    text_fa = serializers.CharField(allow_blank=True, required=False)


class ArticleParagraphSerializer(serializers.Serializer):
    en = serializers.CharField(allow_blank=True)
    fa = serializers.CharField(allow_blank=True, required=False)


class ArticleEntitySerializer(serializers.Serializer):
    type = serializers.CharField()
    name = serializers.CharField()


class RelatedArticleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    source = ArticleDetailSourceSerializer()
    title = serializers.CharField()
    title_fa = serializers.CharField(allow_blank=True)


class FetchTraceSerializer(serializers.Serializer):
    method = serializers.CharField()
    job_id = serializers.IntegerField(allow_null=True)
    content_hash = serializers.CharField(allow_blank=True)
    fetched_at = serializers.DateTimeField()
    translation_status = serializers.CharField()
    canonical = serializers.CharField(allow_blank=True)
    source_name = serializers.CharField()
    source_type = serializers.CharField()


class ArticleDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    source = ArticleDetailSourceSerializer()
    category = serializers.CharField()
    url = serializers.URLField()
    canonical_url = serializers.URLField(allow_blank=True)
    title = serializers.CharField()
    title_fa = serializers.CharField(allow_blank=True)
    summary = serializers.CharField(allow_blank=True)
    summary_fa = serializers.CharField(allow_blank=True)
    brief = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    brief_fa = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    key_points = ArticleKeyPointSerializer(many=True)
    paragraphs = ArticleParagraphSerializer(many=True)
    why_it_matters = serializers.CharField(allow_blank=True)
    why_it_matters_fa = serializers.CharField(allow_blank=True)
    entities = ArticleEntitySerializer(many=True)
    reading_minutes = serializers.IntegerField()
    published_at = serializers.DateTimeField(allow_null=True)
    fetched_at = serializers.DateTimeField()
    translation_status = serializers.CharField()
    fetch_trace = FetchTraceSerializer(required=False)
    related = RelatedArticleSerializer(many=True)
    prev_id = serializers.IntegerField(allow_null=True)
    next_id = serializers.IntegerField(allow_null=True)


class ArticleSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source.name", read_only=True)
    source_slug = serializers.SlugField(source="source.slug", read_only=True)
    display_title = serializers.SerializerMethodField()
    display_summary = serializers.SerializerMethodField()
    display_language = serializers.SerializerMethodField()
    original_url = serializers.URLField(source="url", read_only=True)

    class Meta:
        model = Article
        fields = [
            "id",
            "source",
            "source_name",
            "source_slug",
            "url",
            "original_url",
            "canonical_url",
            "title",
            "summary",
            "title_fa",
            "summary_fa",
            "display_title",
            "display_summary",
            "display_language",
            "image_url",
            "author",
            "published_at",
            "fetched_at",
            "language",
            "translation_status",
            "tags",
        ]

    def _want_fa(self) -> bool:
        request = self.context.get("request")
        pref = getattr(request, "news_language", None) if request else None
        return pref == LANGUAGE_FA

    def _use_fa(self, obj: Article) -> bool:
        return (
            self._want_fa()
            and obj.translation_status == TranslationStatus.DONE
            and bool(obj.title_fa)
        )

    def get_display_title(self, obj: Article) -> str:
        return obj.title_fa if self._use_fa(obj) else obj.title

    def get_display_summary(self, obj: Article) -> str:
        return obj.summary_fa if self._use_fa(obj) else obj.summary

    def get_display_language(self, obj: Article) -> str:
        return LANGUAGE_FA if self._use_fa(obj) else LANGUAGE_EN


class FetchJobCreateSerializer(serializers.Serializer):
    source_id = serializers.IntegerField(required=False, allow_null=True)
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    force = serializers.BooleanField(
        required=False,
        default=False,
        help_text="If false, refuse when sources are still fresh (up to date).",
    )


class FreshnessSourceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    slug = serializers.SlugField()
    name = serializers.CharField()
    color = serializers.CharField(allow_blank=True)
    is_active = serializers.BooleanField()
    last_fetched_at = serializers.DateTimeField(allow_null=True)
    last_status = serializers.CharField(allow_blank=True)
    fetch_interval_minutes = serializers.IntegerField()
    fresh_within_minutes = serializers.IntegerField()
    age_minutes = serializers.IntegerField(allow_null=True)
    up_to_date = serializers.BooleanField()
    fetch_running = serializers.BooleanField()


class FreshnessSerializer(serializers.Serializer):
    up_to_date = serializers.BooleanField()
    fetch_running = serializers.BooleanField()
    last_fetched_at = serializers.DateTimeField(allow_null=True)
    checked_at = serializers.DateTimeField()
    message_key = serializers.CharField()
    sources = FreshnessSourceSerializer(many=True)


class FetchJobSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source.name", read_only=True, allow_null=True)
    requested_by_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = FetchJob
        fields = [
            "id",
            "source",
            "source_name",
            "requested_by_id",
            "date_from",
            "date_to",
            "trigger",
            "status",
            "found_count",
            "new_count",
            "skipped_count",
            "failed_count",
            "error_log",
            "created_at",
            "started_at",
            "finished_at",
        ]
        read_only_fields = fields


def language_for(request) -> str:
    if not request.user or not request.user.is_authenticated:
        return LANGUAGE_EN
    try:
        return request.user.news_preference.language
    except NewsPreference.DoesNotExist:
        return LANGUAGE_EN
