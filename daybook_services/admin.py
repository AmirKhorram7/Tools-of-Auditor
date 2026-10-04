from django.contrib import admin

from daybook_services.models import Daybook, DayNote, Plan, PlanItem


@admin.register(Daybook)
class DaybookAdmin(admin.ModelAdmin):
    list_display = ("owner", "calendar_system", "default_view", "updated_at")
    list_filter = ("calendar_system", "default_view")
    raw_id_fields = ("owner",)


@admin.register(DayNote)
class DayNoteAdmin(admin.ModelAdmin):
    list_display = ("date", "title", "owner", "is_pinned", "updated_at")
    list_filter = ("is_pinned",)
    search_fields = ("title",)
    date_hierarchy = "date"
    raw_id_fields = ("owner",)


class PlanItemInline(admin.TabularInline):
    model = PlanItem
    extra = 0


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "start_date", "end_date", "status")
    list_filter = ("status",)
    search_fields = ("title",)
    raw_id_fields = ("owner",)
    inlines = [PlanItemInline]
