from django.contrib import admin, messages
from django.contrib.auth.admin import GroupAdmin
from django.contrib.auth.models import Group
from django.utils.translation import gettext_lazy as _

from news.constants import NEWS_GROUP_NAME
from news.models import (
    Article,
    FetchJob,
    NewsPanelSettings,
    NewsPreference,
    NewsSource,
    NewsTeamMember,
    NewsWarehouseSettings,
)
from news.permissions import user_is_news_admin

try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass


@admin.register(Group)
class LockedGroupAdmin(GroupAdmin):
    """Protect the legacy News Team group name from accidental delete.

    Membership is managed on **News Team members** — not here.
    """

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.name == NEWS_GROUP_NAME and not request.user.is_superuser:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.name == NEWS_GROUP_NAME:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(NewsTeamMember)
class NewsTeamMemberAdmin(admin.ModelAdmin):
    """Add / remove who can read the news feed and story detail."""

    list_display = ("user", "phone", "full_name", "added_by", "created_at")
    search_fields = (
        "user__phone_number",
        "user__first_name",
        "user__last_name",
        "notes",
    )
    autocomplete_fields = ("user", "added_by")
    readonly_fields = ("created_at",)
    list_select_related = ("user", "added_by")

    @admin.display(description=_("Phone"), ordering="user__phone_number")
    def phone(self, obj):
        return getattr(obj.user, "phone_number", "") or "—"

    @admin.display(description=_("Name"))
    def full_name(self, obj):
        user = obj.user
        name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return name or "—"

    def save_model(self, request, obj, form, change):
        from news.services.team import add_member, sync_user_into_legacy_group

        if not obj.added_by_id:
            obj.added_by = request.user
        if change:
            super().save_model(request, obj, form, change)
            sync_user_into_legacy_group(obj.user)
            return
        member = add_member(obj.user, added_by=obj.added_by, notes=obj.notes or "")
        obj.pk = member.pk

    def delete_model(self, request, obj):
        from news.services.team import remove_membership

        remove_membership(obj)

    def delete_queryset(self, request, queryset):
        from news.services.team import remove_membership

        for member in queryset:
            remove_membership(member)

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(NewsSource)
class NewsSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "source_type",
        "category",
        "region",
        "color",
        "is_active",
        "last_status",
        "last_fetched_at",
    )
    list_filter = ("is_active", "source_type", "category", "region", "last_status")
    search_fields = ("name", "slug", "base_url", "feed_url")
    prepopulated_fields = {"slug": ("name",)}
    actions = ["fetch_now"]
    readonly_fields = ("last_fetched_at", "last_status", "last_error", "last_etag", "last_modified")

    @admin.action(description=_("Fetch now"))
    def fetch_now(self, request, queryset):
        if not user_is_news_admin(request.user):
            self.message_user(request, _("Only superusers can start a fetch."), messages.ERROR)
            return
        from news.services.ingest import IngestService

        n = 0
        service = IngestService()
        for source in queryset:
            service.queue_job(source=source, requested_by=request.user)
            n += 1
        self.message_user(request, _("Queued %(n)s fetch job(s).") % {"n": n})


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "published_at", "translation_status", "reading_minutes", "fetched_at")
    list_filter = ("translation_status", "source", "language")
    search_fields = ("title", "title_fa", "url", "summary")
    date_hierarchy = "published_at"
    readonly_fields = ("content_hash", "fetched_at", "updated_at", "url", "canonical_url", "body")
    raw_id_fields = ("source",)
    fieldsets = (
        (None, {"fields": ("source", "title", "title_fa", "summary", "summary_fa", "image_url", "author")}),
        (
            "Detail reader",
            {
                "fields": (
                    "brief",
                    "brief_fa",
                    "key_points",
                    "paragraphs",
                    "why_it_matters",
                    "why_it_matters_fa",
                    "entities",
                    "reading_minutes",
                )
            },
        ),
        (
            "Meta",
            {
                "fields": (
                    "url",
                    "canonical_url",
                    "published_at",
                    "fetched_at",
                    "updated_at",
                    "language",
                    "translation_status",
                    "content_hash",
                    "tags",
                    "body",
                )
            },
        ),
    )


@admin.register(FetchJob)
class FetchJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "source",
        "trigger",
        "status",
        "found_count",
        "new_count",
        "skipped_count",
        "failed_count",
        "created_at",
    )
    list_filter = ("status", "trigger")
    date_hierarchy = "created_at"
    readonly_fields = (
        "found_count",
        "new_count",
        "skipped_count",
        "failed_count",
        "error_log",
        "created_at",
        "started_at",
        "finished_at",
    )


@admin.register(NewsPanelSettings)
class NewsPanelSettingsAdmin(admin.ModelAdmin):
    """Backup editor. The real settings page is GET/PATCH /api/v1/news/panel/."""

    list_display = (
        "fetch_mode",
        "interval_hours",
        "run_hour",
        "run_minute",
        "last_scheduled_at",
        "updated_at",
        "updated_by",
    )
    readonly_fields = ("last_scheduled_at", "updated_at", "updated_by")

    def has_add_permission(self, request):
        if NewsPanelSettings.objects.exists():
            return False
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(NewsWarehouseSettings)
class NewsWarehouseSettingsAdmin(admin.ModelAdmin):
    """Backup editor. The real control is GET/PATCH /api/v1/news/warehouse/."""

    list_display = (
        "enabled",
        "interval_hours",
        "run_hour",
        "run_minute",
        "last_synced_at",
        "last_sync_count",
        "updated_at",
        "updated_by",
    )
    readonly_fields = (
        "last_synced_at",
        "last_synced_id",
        "last_sync_count",
        "last_error",
        "updated_at",
        "updated_by",
    )

    def has_add_permission(self, request):
        if NewsWarehouseSettings.objects.exists():
            return False
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(NewsPreference)
class NewsPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "language", "updated_at")
    list_filter = ("language",)
    search_fields = ("user__phone_number", "user__first_name")
