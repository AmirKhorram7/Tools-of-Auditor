from django.contrib import admin

from knowledge_management.models import (
    Attachment,
    InkDrawing,
    Link,
    Node,
    PlanDay,
    Review,
    StudyPlan,
    Template,
)


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "owner", "parent", "depth", "is_daily", "is_deleted")
    list_filter = ("type", "is_daily", "is_deleted")
    search_fields = ("title", "content_text")
    raw_id_fields = ("owner", "parent")


@admin.register(StudyPlan)
class StudyPlanAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "start_date", "days")
    raw_id_fields = ("owner",)


class PlanDayInline(admin.TabularInline):
    model = PlanDay
    extra = 0
    raw_id_fields = ("node",)


StudyPlanAdmin.inlines = [PlanDayInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("node", "due_date", "step", "done_at")
    raw_id_fields = ("owner", "node", "plan_day")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "owner")
    raw_id_fields = ("owner",)


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ("source", "target", "owner")
    raw_id_fields = ("owner", "source", "target")


@admin.register(InkDrawing)
class InkDrawingAdmin(admin.ModelAdmin):
    list_display = ("id", "node", "width", "height", "updated_at")
    raw_id_fields = ("owner", "node")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "size", "node", "owner")
    raw_id_fields = ("owner", "node")
