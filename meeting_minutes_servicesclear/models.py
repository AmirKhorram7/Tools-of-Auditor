from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_created",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_updated",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_deleted",
    )

    class Meta:
        abstract = True


class Company(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    name = models.CharField(max_length=255)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="subsidiaries",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_minutes_companies",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    def __str__(self):
        return self.name

    def clean(self):
        if self.parent_id and self.pk and self.parent_id == self.pk:
            raise ValidationError({"parent": _("A company cannot be its own parent.")})
        if self.parent_id and self.parent and self.parent.parent_id:
            raise ValidationError(
                {"parent": _("Sub-companies can only sit under a root (holding) company.")}
            )


class Group(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        ARCHIVED = "archived", _("Archived")

    name = models.CharField(max_length=255)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="groups",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_minutes_groups",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    is_default = models.BooleanField(
        default=False,
        help_text=_("Default group for new meeting minutes in this company. Only one per company."),
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="mm_unique_group_name_in_company",
            ),
            models.UniqueConstraint(
                fields=["company"],
                condition=Q(is_default=True, deleted_at__isnull=True),
                name="mm_unique_default_group_per_company",
            ),
        ]

    def __str__(self):
        return self.name


class GroupMember(BaseModel):
    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")
        MAINTAINER = "maintainer", _("Maintainer")
        GUEST = "guest", _("Guest")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="minutes_group_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.GUEST,
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
                fields=["group", "user"],
                name="mm_unique_group_member",
            ),
        ]

    def __str__(self):
        return f"{self.group} - {self.user}"


class GroupInvitation(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        ACCEPTED = "accepted", _("Accepted")
        REJECTED = "rejected", _("Rejected")
        EXPIRED = "expired", _("Expired")
        CANCELLED = "cancelled", _("Cancelled")

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_minutes_invitations",
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="received_minutes_invitations",
        null=True,
        blank=True,
    )
    phone_number = models.CharField(max_length=15)
    role = models.CharField(
        max_length=20,
        choices=GroupMember.Role.choices,
        default=GroupMember.Role.GUEST,
    )
    position_title = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["group", "phone_number"],
                condition=Q(status="pending"),
                name="mm_unique_pending_invite_per_group_phone",
            ),
        ]

    def __str__(self):
        return f"{self.phone_number} → {self.group}"


class Meeting(BaseModel):
    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        CLOSED = "closed", _("Closed")
        ARCHIVED = "archived", _("Archived")

    name = models.CharField(max_length=255, blank=True, default="")
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="meetings",
    )
    is_default_group_meeting = models.BooleanField(default=False)
    meeting_number = models.PositiveBigIntegerField()
    manual_number_generating = models.BooleanField(default=False)
    date = models.DateField()
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["group", "meeting_number"],
                name="mm_unique_meeting_number_in_group",
            ),
        ]

    def __str__(self):
        return f"{self.name} - {self.meeting_number} - {self.group} - {self.date}"


class MeetingItem(BaseModel):
    class Status(models.TextChoices):
        CREATED = "created", _("Created")
        IN_PROGRESS = "in_progress", _("In progress")
        TEST = "test", _("Test")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")

    class Priority(models.IntegerChoices):
        LOW = 1, _("Low")
        MEDIUM = 2, _("Medium")
        HIGH = 3, _("High")
        CRITICAL = 4, _("Critical")

    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        related_name="items",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    priority = models.IntegerField(
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CREATED,
    )
    assignees = models.ManyToManyField(
        GroupMember,
        related_name="assigned_items",
        blank=True,
    )
    order = models.PositiveBigIntegerField(default=0)
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="completed_minutes_items",
        blank=True,
        null=True,
    )
    cloned_from = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="clones",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.title} - {self.meeting}"
