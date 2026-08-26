from django.contrib import admin

from system_explanation_services.models import (
    Process,
    ProcessStep,
    Project,
    ProjectMember,
    StepConnection,
    StepControl,
    StepMedia,
    StepRisk,
)


class SubProjectInline(admin.TabularInline):
    model = Project
    fk_name = "parent"
    extra = 0
    fields = ("name", "status", "owner", "is_active")
    show_change_link = True


class ProcessInline(admin.TabularInline):
    model = Process
    extra = 0
    fields = ("name", "department", "order", "owner")


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0
    autocomplete_fields = ("user", "invited_by")
    fields = ("user", "role", "invited_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "owner__first_name",
        "owner__last_name",
        "name",
        "parent",
        "company_name",
        "status",
        "owner",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "is_active", "is_deleted")
    search_fields = ("name", "company_name", "owner__phone_number", "owner__first_name", "owner__last_name")
    autocomplete_fields = ("parent", "owner")
    inlines = [SubProjectInline, ProcessInline, ProjectMemberInline]


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "role", "invited_by", "created_at")
    list_filter = ("role",)
    search_fields = (
        "project__name",
        "user__phone_number",
        "user__first_name",
        "user__last_name",
    )
    autocomplete_fields = ("project", "user", "invited_by")


class ProcessStepInline(admin.TabularInline):
    model = ProcessStep
    extra = 0
    fields = ("title", "shape_type", "status", "order", "position_x", "position_y")


class StepConnectionInline(admin.TabularInline):
    model = StepConnection
    fk_name = "process"
    extra = 0
    fields = ("from_step", "to_step", "label")


@admin.register(Process)
class ProcessAdmin(admin.ModelAdmin):
    list_display = ("owner__first_name", "owner__last_name", "name", "project", "department", "order", "owner", "created_at")
    list_filter = ("project", "is_deleted")
    search_fields = ("name", "project__name", "owner__first_name", "owner__last_name")
    inlines = [ProcessStepInline, StepConnectionInline]


class StepRiskInline(admin.StackedInline):
    model = StepRisk
    extra = 0


class StepControlInline(admin.StackedInline):
    model = StepControl
    extra = 0


class StepMediaInline(admin.TabularInline):
    model = StepMedia
    extra = 0
    fields = ("section", "kind", "title", "file", "url", "risk", "control", "order")


@admin.register(ProcessStep)
class ProcessStepAdmin(admin.ModelAdmin):
    list_display = ("process__owner__first_name", "process__owner__last_name", "title", "process", "shape_type", "status", "order", "created_at")
    list_filter = ("shape_type", "status", "is_deleted")
    search_fields = ("title", "process__name", "process__owner__first_name", "process__owner__last_name")
    inlines = [StepRiskInline, StepControlInline, StepMediaInline]


@admin.register(StepRisk)
class StepRiskAdmin(admin.ModelAdmin):
    list_display = ("step__process__owner__first_name", "step__process__owner__last_name", "title", "step", "order", "created_at")
    search_fields = ("title", "step__title", "step__process__owner__first_name", "step__process__owner__last_name")


@admin.register(StepControl)
class StepControlAdmin(admin.ModelAdmin):
    list_display = ("step__process__owner__first_name", "step__process__owner__last_name", "title", "step", "order", "created_at")
    search_fields = ("title", "step__title", "step__process__owner__first_name", "step__process__owner__last_name")



@admin.register(StepConnection)
class StepConnectionAdmin(admin.ModelAdmin):
    list_display = ("from_step", "to_step", "process", "label", "created_at")
    list_filter = ("is_deleted",)
    search_fields = ("from_step__title", "to_step__title", "process__name")


@admin.register(StepMedia)
class StepMediaAdmin(admin.ModelAdmin):
    list_display = ("step__process__owner__first_name", "step__process__owner__last_name", "title", "step", "section", "kind", "order", "created_at")
    list_filter = ("section", "kind", "is_deleted")
    search_fields = ("title", "step__title", "url", "step__process__owner__first_name", "step__process__owner__last_name")
