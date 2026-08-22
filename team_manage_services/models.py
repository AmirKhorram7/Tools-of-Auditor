"""
Team manager domain.

Org: Company → Team → Invitation / TeamMember
Work: Project → ProjectTeam / ProjectMember → Task → TaskStep
Comms: TaskComment / Attachment, Notification (inbox), ActivityLog (sidebar)
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    name = models.CharField(max_length=255)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="subsidiaries",
        null=True,
        blank=True,
        help_text=_("Set for a sub-company under a holding."),
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_companies",
        help_text=_("The manager who created this company. Not a platform admin."),
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    require_approval_before_close = models.BooleanField(
        default=False,
        help_text=_("When on, only a manager can move a card to the closed board."),
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "name"],
                name="tm_unique_company_name_under_parent",
            ),
            models.UniqueConstraint(
                fields=["owner", "name"],
                condition=Q(parent__isnull=True),
                name="tm_unique_root_company_name_per_owner",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        if self.parent_id and self.pk and self.parent_id == self.pk:
            raise ValidationError({"parent": _("A company cannot be its own parent.")})
        if self.parent_id and self.parent and self.parent.parent_id:
            raise ValidationError(
                {"parent": _("Sub-companies can only sit under a root (holding) company.")}
            )


class CompanyMember(BaseModel):
    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")
        ADMIN = "admin", _("Admin")
        MANAGER = "manager", _("Manager")
        EMPLOYEE = "employee", _("Employee")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="company_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "user"],
                name="tm_unique_company_member",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "role"], name="tm_cm_company_role"),
            models.Index(fields=["user", "status"], name="tm_cm_user_status"),
        ]

    def __str__(self):
        return f"{self.company} - {self.user}"


class WorkLabel(BaseModel):
    """Company-wide colored tag, same idea as a GitLab label."""

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="work_labels",
    )
    name = models.CharField(max_length=80)
    color = models.CharField(
        max_length=7,
        default="#428BCA",
        help_text=_("Hex color, e.g. #428BCA"),
    )
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="tm_unique_label_name_in_company",
            ),
        ]

    def __str__(self):
        return self.name


class BoardTemplate(BaseModel):
    """Reusable column set. Platform rows have no company and cannot be deleted."""

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="board_templates",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=120)
    is_default = models.BooleanField(default=False)
    is_platform = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_board_templates",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-is_default", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="tm_unique_board_template_name",
            ),
        ]

    def __str__(self):
        return self.name


class BoardTemplateColumn(BaseModel):
    template = models.ForeignKey(
        BoardTemplate,
        on_delete=models.CASCADE,
        related_name="columns",
    )
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=7, default="#1A2B49")
    position = models.PositiveIntegerField(default=0)
    status_key = models.CharField(max_length=20, default="todo")
    is_closed = models.BooleanField(default=False)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.template} / {self.name}"


class Team(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        ARCHIVED = "archived", _("Archived")

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_teams",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="tm_unique_team_name_in_company",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "status"], name="tm_team_company_status"),
        ]

    def __str__(self):
        return self.name


class TeamMember(BaseModel):
    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")
        MAINTAINER = "maintainer", _("Maintainer")
        DEVELOPER = "developer", _("Developer")
        PLANNER = "planner", _("Planner")
        GUEST = "guest", _("Guest")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="team_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.DEVELOPER,
    )
    position_title = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "user"],
                name="tm_unique_team_member",
            ),
        ]
        indexes = [
            models.Index(fields=["team", "status"], name="tm_tm_team_status"),
            models.Index(fields=["user", "status"], name="tm_tm_user_status"),
        ]

    def __str__(self):
        return f"{self.team} - {self.user}"


class Invitation(BaseModel):
    """Invite by phone. Existing users accept/reject; new users match after register."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        ACCEPTED = "accepted", _("Accepted")
        REJECTED = "rejected", _("Rejected")
        EXPIRED = "expired", _("Expired")
        CANCELLED = "cancelled", _("Cancelled")

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_team_invitations",
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="received_team_invitations",
        null=True,
        blank=True,
    )
    phone_number = models.CharField(max_length=15)
    role = models.CharField(
        max_length=20,
        choices=TeamMember.Role.choices,
        default=TeamMember.Role.DEVELOPER,
    )
    position_title = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    expires_at = models.DateTimeField()
    sms_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("Set when invite SMS is sent to a phone not yet registered."),
    )

    class Meta:
        indexes = [
            models.Index(fields=["phone_number", "status"], name="tm_inv_phone_status"),
            models.Index(fields=["team", "status"], name="tm_inv_team_status"),
            models.Index(fields=["invited_user", "status"], name="tm_inv_user_status"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "phone_number"],
                condition=Q(status="pending"),
                name="tm_unique_pending_invite_per_team_phone",
            ),
        ]

    def __str__(self):
        return f"{self.phone_number} → {self.team}"


class Project(BaseModel):
    class Status(models.TextChoices):
        PLANNING = "planning", _("Planning")
        IN_PROGRESS = "in_progress", _("In Progress")
        ON_HOLD = "on_hold", _("On Hold")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")

    class Priority(models.IntegerChoices):
        LOW = 1, _("Low")
        MEDIUM = 2, _("Medium")
        HIGH = 3, _("High")
        CRITICAL = 4, _("Critical")

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="work_projects",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_work_projects",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNING,
    )
    priority = models.PositiveSmallIntegerField(
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    require_approval_before_close = models.BooleanField(
        null=True,
        blank=True,
        help_text=_("Null inherits the company policy."),
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "status"], name="tm_proj_company_status"),
            models.Index(fields=["owner", "status"], name="tm_proj_owner_status"),
            models.Index(fields=["company", "due_date"], name="tm_proj_company_due"),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValidationError({"due_date": _("Due date cannot be before start date.")})


class ProjectTeam(BaseModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="project_teams",
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="project_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "team"],
                name="tm_unique_project_team",
            ),
        ]
        indexes = [
            models.Index(fields=["team"], name="tm_pt_team"),
        ]

    def __str__(self):
        return f"{self.project} / {self.team}"


class ProjectMember(BaseModel):
    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")
        MAINTAINER = "maintainer", _("Maintainer")
        DEVELOPER = "developer", _("Developer")
        PLANNER = "planner", _("Planner")
        GUEST = "guest", _("Guest")
        MANAGER = "manager", _("Manager")
        MEMBER = "member", _("Member")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="work_project_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    added_from_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        related_name="project_members_added",
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"],
                name="tm_unique_project_member",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "status"], name="tm_pm_project_status"),
            models.Index(fields=["user", "status"], name="tm_pm_user_status"),
        ]

    def __str__(self):
        return f"{self.project} - {self.user}"


class BoardColumn(BaseModel):
    """One list on a project board (To Do, Testing, Need Merge, …)."""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="board_columns",
    )
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=7, default="#1F75CB")
    position = models.PositiveIntegerField(default=0)
    status_key = models.CharField(
        max_length=20,
        default="in_progress",
        help_text=_("Kept in sync with Task.status so list view and progress still work."),
    )
    is_closed = models.BooleanField(default=False)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="tm_unique_column_name_in_project",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "position"], name="tm_col_project_pos"),
        ]

    def __str__(self):
        return f"{self.project} / {self.name}"


class Task(BaseModel):
    class Status(models.TextChoices):
        TODO = "todo", _("To Do")
        IN_PROGRESS = "in_progress", _("In Progress")
        IN_REVIEW = "in_review", _("In Review")
        BLOCKED = "blocked", _("Blocked")
        DONE = "done", _("Done")
        CANCELLED = "cancelled", _("Cancelled")

    class Priority(models.IntegerChoices):
        LOW = 1, _("Low")
        MEDIUM = 2, _("Medium")
        HIGH = 3, _("High")
        CRITICAL = 4, _("Critical")

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    assigned_to = models.ForeignKey(
        ProjectMember,
        on_delete=models.SET_NULL,
        related_name="assigned_tasks",
        null=True,
        blank=True,
        help_text=_("Optional. Plan first, assign a project member later."),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_work_tasks",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
    )
    priority = models.PositiveSmallIntegerField(
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    difficulty = models.PositiveSmallIntegerField(
        default=1,
        help_text=_("1 easiest … 5 hardest. Weight for project progress. Manager-only."),
    )
    difficulty_set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tasks_with_set_difficulty",
    )
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    column = models.ForeignKey(
        BoardColumn,
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    labels = models.ManyToManyField(
        WorkLabel,
        related_name="tasks",
        blank=True,
    )

    class Meta:
        ordering = ["due_date", "-created_at"]
        indexes = [
            models.Index(fields=["project", "status"], name="tm_task_project_status"),
            models.Index(fields=["project", "assigned_to"], name="tm_task_project_assignee"),
            models.Index(fields=["assigned_to", "status"], name="tm_task_assignee_status"),
            models.Index(fields=["assigned_to", "due_date"], name="tm_task_assignee_due"),
            models.Index(fields=["project", "due_date"], name="tm_task_project_due"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(difficulty__gte=1, difficulty__lte=5),
                name="tm_task_difficulty_1_to_5",
            ),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        if self.assigned_to_id and self.project_id:
            if self.assigned_to.project_id != self.project_id:
                raise ValidationError(
                    {"assigned_to": _("Assignee must be a member of this project.")}
                )
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValidationError({"due_date": _("Due date cannot be before start date.")})


class TaskStep(BaseModel):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField()
    is_completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="completed_task_steps",
        null=True,
        blank=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["task", "order"],
                name="tm_unique_task_step_order",
            ),
        ]

    def __str__(self):
        return self.title


class TaskComment(BaseModel):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="work_task_comments",
    )
    body = models.TextField()
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="replies",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["task", "created_at"], name="tm_comment_task_created"),
        ]

    def __str__(self):
        return f"Comment on {self.task_id}"

    def clean(self):
        if self.reply_to_id and self.reply_to and self.reply_to.task_id != self.task_id:
            raise ValidationError({"reply_to": _("Reply must belong to the same task.")})


class Attachment(BaseModel):
    comment = models.ForeignKey(
        TaskComment,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="team-tasks/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_work_attachments",
    )
    file_size = models.PositiveBigIntegerField(null=True, blank=True)

    def __str__(self):
        return self.original_name or f"Attachment {self.pk}"


class Notification(BaseModel):
    """Per-user inbox. SMS is opt-in per event, not for every notification."""

    class Type(models.TextChoices):
        TASK_ASSIGNED = "task_assigned", _("Task Assigned")
        TASK_UPDATED = "task_updated", _("Task Updated")
        TASK_COMMENT = "task_comment", _("Task Comment")
        TASK_COMPLETED = "task_completed", _("Task Completed")
        PROJECT_UPDATED = "project_updated", _("Project Updated")
        INVITATION = "invitation", _("Invitation")
        DEADLINE = "deadline", _("Deadline")
        MEMBER_CHANGED = "member_changed", _("Member Changed")

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="work_notifications",
    )
    notification_type = models.CharField(max_length=50, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    reference_type = models.CharField(max_length=50, blank=True, default="")
    reference_id = models.PositiveBigIntegerField(null=True, blank=True)
    send_sms = models.BooleanField(default=False)
    sms_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "created_at"],
                name="tm_notif_inbox",
            ),
        ]

    def __str__(self):
        return f"{self.recipient_id}: {self.title}"


class ActivityLog(BaseModel):
    """Project/task audit trail for the right-side فعالیت panel."""

    class Action(models.TextChoices):
        CREATED = "created", _("Created")
        UPDATED = "updated", _("Updated")
        DELETED = "deleted", _("Deleted")
        ASSIGNED = "assigned", _("Assigned")
        COMPLETED = "completed", _("Completed")
        COMMENTED = "commented", _("Commented")
        STATUS_CHANGED = "status_changed", _("Status Changed")
        MEMBER_ADDED = "member_added", _("Member Added")
        MEMBER_REMOVED = "member_removed", _("Member Removed")

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="work_activity_logs",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="activity_logs",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="activity_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=50, choices=Action.choices)
    entity_type = models.CharField(max_length=50)
    entity_id = models.PositiveBigIntegerField()
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"], name="tm_act_project_created"),
            models.Index(fields=["actor", "created_at"], name="tm_act_actor_created"),
            models.Index(fields=["entity_type", "entity_id"], name="tm_act_entity"),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type}:{self.entity_id}"
