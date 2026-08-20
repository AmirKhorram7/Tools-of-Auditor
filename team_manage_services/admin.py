from django.contrib import admin
from django.db.models import Count
from django.utils.translation import gettext_lazy as _

from team_manage_services.models import (
    ActivityLog,
    Attachment,
    Company,
    CompanyMember,
    Invitation,
    Notification,
    Project,
    ProjectMember,
    ProjectTeam,
    Task,
    TaskComment,
    TaskStep,
    Team,
    TeamMember,
)


def person_name(user) -> str:
    if user is None:
        return "—"
    name = f"{user.first_name} {user.last_name}".strip()
    return name or "—"


class CompanyMemberInline(admin.TabularInline):
    model = CompanyMember
    extra = 0
    autocomplete_fields = ("user",)
    fields = ("user", "role", "status", "joined_at")
    readonly_fields = ("joined_at",)
    show_change_link = True


class TeamInline(admin.TabularInline):
    model = Team
    extra = 0
    autocomplete_fields = ("owner",)
    fields = ("name", "owner", "status")
    show_change_link = True


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "parent",
        "owner_name",
        "owner_phone",
        "status",
        "team_count",
        "member_count",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "name",
        "owner__first_name",
        "owner__last_name",
        "owner__phone_number",
        "parent__name",
    )
    autocomplete_fields = ("parent", "owner")
    readonly_fields = ("created_at", "updated_at")
    inlines = [TeamInline, CompanyMemberInline]
    date_hierarchy = "created_at"
    list_select_related = ("parent", "owner")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(
                _team_count=Count("teams", distinct=True),
                _member_count=Count("members", distinct=True),
            )
        )

    @admin.display(description=_("Owner"), ordering="owner__first_name")
    def owner_name(self, obj):
        return person_name(obj.owner)

    @admin.display(description=_("Phone"), ordering="owner__phone_number")
    def owner_phone(self, obj):
        return obj.owner.phone_number

    @admin.display(description=_("Teams"), ordering="_team_count")
    def team_count(self, obj):
        return obj._team_count

    @admin.display(description=_("Members"), ordering="_member_count")
    def member_count(self, obj):
        return obj._member_count


@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "company",
        "user_name",
        "phone",
        "role",
        "status",
        "joined_at",
        "created_at",
    )
    list_filter = ("role", "status", "created_at")
    search_fields = (
        "company__name",
        "user__first_name",
        "user__last_name",
        "user__phone_number",
    )
    autocomplete_fields = ("company", "user")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    list_select_related = ("company", "user")

    @admin.display(description=_("User"), ordering="user__first_name")
    def user_name(self, obj):
        return person_name(obj.user)

    @admin.display(description=_("Phone"), ordering="user__phone_number")
    def phone(self, obj):
        return obj.user.phone_number


class TeamMemberInline(admin.TabularInline):
    model = TeamMember
    extra = 0
    autocomplete_fields = ("user",)
    fields = ("user", "position_title", "status", "joined_at")
    readonly_fields = ("joined_at",)
    show_change_link = True


class InvitationInline(admin.TabularInline):
    model = Invitation
    extra = 0
    autocomplete_fields = ("invited_by", "invited_user")
    fields = (
        "phone_number",
        "position_title",
        "status",
        "invited_by",
        "invited_user",
        "expires_at",
    )
    show_change_link = True


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "company",
        "owner_name",
        "owner_phone",
        "status",
        "member_count",
        "created_at",
    )
    list_filter = ("status", "company", "created_at")
    search_fields = (
        "name",
        "company__name",
        "owner__first_name",
        "owner__last_name",
        "owner__phone_number",
    )
    autocomplete_fields = ("company", "owner")
    readonly_fields = ("created_at", "updated_at")
    inlines = [TeamMemberInline, InvitationInline]
    date_hierarchy = "created_at"
    list_select_related = ("company", "owner")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(_member_count=Count("members", distinct=True))
        )

    @admin.display(description=_("Owner"), ordering="owner__first_name")
    def owner_name(self, obj):
        return person_name(obj.owner)

    @admin.display(description=_("Phone"), ordering="owner__phone_number")
    def owner_phone(self, obj):
        return obj.owner.phone_number

    @admin.display(description=_("Members"), ordering="_member_count")
    def member_count(self, obj):
        return obj._member_count


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "team",
        "company_name",
        "user_name",
        "phone",
        "position_title",
        "status",
        "joined_at",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "team__name",
        "team__company__name",
        "user__first_name",
        "user__last_name",
        "user__phone_number",
        "position_title",
    )
    autocomplete_fields = ("team", "user")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    list_select_related = ("team", "team__company", "user")

    @admin.display(description=_("Company"), ordering="team__company__name")
    def company_name(self, obj):
        return obj.team.company

    @admin.display(description=_("User"), ordering="user__first_name")
    def user_name(self, obj):
        return person_name(obj.user)

    @admin.display(description=_("Phone"), ordering="user__phone_number")
    def phone(self, obj):
        return obj.user.phone_number


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "phone_number",
        "team",
        "position_title",
        "status",
        "invited_by_name",
        "invited_user_name",
        "expires_at",
        "sms_sent_at",
        "created_at",
    )
    list_filter = ("status", "created_at", "expires_at")
    search_fields = (
        "phone_number",
        "team__name",
        "position_title",
        "invited_by__first_name",
        "invited_by__last_name",
        "invited_by__phone_number",
        "invited_user__first_name",
        "invited_user__last_name",
        "invited_user__phone_number",
    )
    autocomplete_fields = ("team", "invited_by", "invited_user")
    readonly_fields = ("created_at", "updated_at", "sms_sent_at")
    date_hierarchy = "created_at"
    list_select_related = ("team", "invited_by", "invited_user")

    @admin.display(description=_("Invited by"), ordering="invited_by__first_name")
    def invited_by_name(self, obj):
        return person_name(obj.invited_by)

    @admin.display(description=_("Invited user"), ordering="invited_user__first_name")
    def invited_user_name(self, obj):
        return person_name(obj.invited_user)


class ProjectTeamInline(admin.TabularInline):
    model = ProjectTeam
    extra = 0
    autocomplete_fields = ("team",)
    fields = ("team",)
    show_change_link = True


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0
    autocomplete_fields = ("user", "added_from_team")
    fields = ("user", "role", "status", "added_from_team")
    show_change_link = True


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0
    autocomplete_fields = ("assigned_to", "created_by")
    fields = ("title", "status", "priority", "assigned_to", "due_date")
    show_change_link = True
    classes = ("collapse",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "company",
        "owner_name",
        "owner_phone",
        "status",
        "priority",
        "task_count",
        "start_date",
        "due_date",
        "created_at",
    )
    list_filter = ("status", "priority", "created_at")
    search_fields = (
        "name",
        "description",
        "company__name",
        "owner__first_name",
        "owner__last_name",
        "owner__phone_number",
    )
    autocomplete_fields = ("company", "owner")
    readonly_fields = ("created_at", "updated_at")
    inlines = [ProjectTeamInline, ProjectMemberInline, TaskInline]
    date_hierarchy = "created_at"
    list_select_related = ("company", "owner")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(_task_count=Count("tasks", distinct=True))
        )

    @admin.display(description=_("Owner"), ordering="owner__first_name")
    def owner_name(self, obj):
        return person_name(obj.owner)

    @admin.display(description=_("Phone"), ordering="owner__phone_number")
    def owner_phone(self, obj):
        return obj.owner.phone_number

    @admin.display(description=_("Tasks"), ordering="_task_count")
    def task_count(self, obj):
        return obj._task_count


@admin.register(ProjectTeam)
class ProjectTeamAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "team", "company_name", "created_at")
    search_fields = ("project__name", "team__name", "project__company__name")
    autocomplete_fields = ("project", "team")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("project", "project__company", "team")

    @admin.display(description=_("Company"), ordering="project__company__name")
    def company_name(self, obj):
        return obj.project.company


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "user_name",
        "phone",
        "role",
        "status",
        "added_from_team",
        "created_at",
    )
    list_filter = ("role", "status", "created_at")
    search_fields = (
        "project__name",
        "user__first_name",
        "user__last_name",
        "user__phone_number",
        "added_from_team__name",
    )
    autocomplete_fields = ("project", "user", "added_from_team")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    list_select_related = ("project", "user", "added_from_team")

    @admin.display(description=_("User"), ordering="user__first_name")
    def user_name(self, obj):
        return person_name(obj.user)

    @admin.display(description=_("Phone"), ordering="user__phone_number")
    def phone(self, obj):
        return obj.user.phone_number


class TaskStepInline(admin.TabularInline):
    model = TaskStep
    extra = 0
    autocomplete_fields = ("completed_by",)
    fields = ("order", "title", "is_completed", "completed_by", "completed_at")
    show_change_link = True


class TaskCommentInline(admin.TabularInline):
    model = TaskComment
    extra = 0
    autocomplete_fields = ("author", "reply_to")
    fields = ("author", "body", "reply_to", "created_at")
    readonly_fields = ("created_at",)
    show_change_link = True
    classes = ("collapse",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "project",
        "assignee_name",
        "status",
        "priority",
        "difficulty",
        "due_date",
        "created_by_name",
        "created_at",
    )
    list_filter = ("status", "priority", "difficulty", "due_date", "created_at")
    search_fields = (
        "title",
        "description",
        "project__name",
        "assigned_to__user__first_name",
        "assigned_to__user__last_name",
        "assigned_to__user__phone_number",
        "created_by__first_name",
        "created_by__last_name",
        "created_by__phone_number",
    )
    autocomplete_fields = (
        "project",
        "assigned_to",
        "created_by",
        "difficulty_set_by",
    )
    readonly_fields = ("created_at", "updated_at", "completed_at")
    inlines = [TaskStepInline, TaskCommentInline]
    date_hierarchy = "due_date"
    list_select_related = (
        "project",
        "assigned_to",
        "assigned_to__user",
        "created_by",
    )

    @admin.display(description=_("Assignee"), ordering="assigned_to__user__first_name")
    def assignee_name(self, obj):
        if obj.assigned_to_id is None:
            return "—"
        return person_name(obj.assigned_to.user)

    @admin.display(description=_("Created by"), ordering="created_by__first_name")
    def created_by_name(self, obj):
        return person_name(obj.created_by)


@admin.register(TaskStep)
class TaskStepAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "task",
        "order",
        "is_completed",
        "completed_by_name",
        "completed_at",
        "created_at",
    )
    list_filter = ("is_completed", "created_at")
    search_fields = (
        "title",
        "task__title",
        "completed_by__first_name",
        "completed_by__last_name",
        "completed_by__phone_number",
    )
    autocomplete_fields = ("task", "completed_by")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("task", "completed_by")

    @admin.display(description=_("Completed by"), ordering="completed_by__first_name")
    def completed_by_name(self, obj):
        return person_name(obj.completed_by)


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    autocomplete_fields = ("uploaded_by",)
    fields = ("file", "original_name", "uploaded_by", "file_size", "created_at")
    readonly_fields = ("created_at",)


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "task",
        "author_name",
        "author_phone",
        "short_body",
        "reply_to",
        "created_at",
    )
    list_filter = ("created_at",)
    search_fields = (
        "body",
        "task__title",
        "author__first_name",
        "author__last_name",
        "author__phone_number",
    )
    autocomplete_fields = ("task", "author", "reply_to")
    readonly_fields = ("created_at", "updated_at")
    inlines = [AttachmentInline]
    date_hierarchy = "created_at"
    list_select_related = ("task", "author", "reply_to")

    @admin.display(description=_("Author"), ordering="author__first_name")
    def author_name(self, obj):
        return person_name(obj.author)

    @admin.display(description=_("Phone"), ordering="author__phone_number")
    def author_phone(self, obj):
        return obj.author.phone_number

    @admin.display(description=_("Comment"))
    def short_body(self, obj):
        text = (obj.body or "").strip().replace("\n", " ")
        return text[:80] + ("…" if len(text) > 80 else "")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "original_name",
        "comment",
        "uploaded_by_name",
        "file_size",
        "created_at",
    )
    search_fields = (
        "original_name",
        "comment__task__title",
        "uploaded_by__first_name",
        "uploaded_by__last_name",
        "uploaded_by__phone_number",
    )
    autocomplete_fields = ("comment", "uploaded_by")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("comment", "uploaded_by")

    @admin.display(description=_("Uploaded by"), ordering="uploaded_by__first_name")
    def uploaded_by_name(self, obj):
        return person_name(obj.uploaded_by)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient_name",
        "recipient_phone",
        "notification_type",
        "title",
        "is_read",
        "send_sms",
        "sms_sent_at",
        "created_at",
    )
    list_filter = ("notification_type", "is_read", "send_sms", "created_at")
    search_fields = (
        "title",
        "message",
        "recipient__first_name",
        "recipient__last_name",
        "recipient__phone_number",
        "reference_type",
    )
    autocomplete_fields = ("recipient",)
    readonly_fields = ("created_at", "updated_at", "sms_sent_at")
    date_hierarchy = "created_at"
    list_select_related = ("recipient",)

    @admin.display(description=_("Recipient"), ordering="recipient__first_name")
    def recipient_name(self, obj):
        return person_name(obj.recipient)

    @admin.display(description=_("Phone"), ordering="recipient__phone_number")
    def recipient_phone(self, obj):
        return obj.recipient.phone_number


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "created_at",
        "action",
        "entity_type",
        "entity_id",
        "actor_name",
        "company",
        "project",
        "short_description",
    )
    list_filter = ("action", "entity_type", "created_at")
    search_fields = (
        "description",
        "entity_type",
        "actor__first_name",
        "actor__last_name",
        "actor__phone_number",
        "company__name",
        "project__name",
    )
    autocomplete_fields = ("actor", "company", "project")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    list_select_related = ("actor", "company", "project")

    @admin.display(description=_("Actor"), ordering="actor__first_name")
    def actor_name(self, obj):
        return person_name(obj.actor)

    @admin.display(description=_("Description"))
    def short_description(self, obj):
        text = (obj.description or "").strip().replace("\n", " ")
        return text[:80] + ("…" if len(text) > 80 else "")
