from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at", "updated_at"])


def retire(queryset, timestamp):
    """Soft-delete a whole related queryset in a single statement."""
    queryset.filter(is_deleted=False).update(
        is_deleted=True, deleted_at=timestamp, updated_at=timestamp
    )


class CardColor(models.TextChoices):
    """
    Legacy named keys kept so existing cards still load.

    New colours are Google Calendar hex strings stored on the CharField
    (no choices), so the frontend can grow the palette without a migration.
    """

    DEFAULT = "default", _("Default")
    SLATE = "slate", _("Slate")
    NAVY = "navy", _("Navy")
    SKY = "sky", _("Sky")
    TEAL = "teal", _("Teal")
    GREEN = "green", _("Green")
    LIME = "lime", _("Lime")
    AMBER = "amber", _("Amber")
    ORANGE = "orange", _("Orange")
    ROSE = "rose", _("Rose")
    PURPLE = "purple", _("Purple")


class Project(BaseModel):
    """
    Documentation project tree. Surfaced to users as «پوشه» (folder).

    - Root project: parent=null  (e.g. dooshe_system)
    - Sub-project: parent=<root> (group under the root)
    - Processes are attached to any project node (usually a sub-project).
    """

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        ACTIVE = "active", _("Active")
        ON_HOLD = "on_hold", _("On Hold")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sub_projects",
        help_text=_("Null = root project. Set to create a sub-project."),
    )
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_projects",
    )
    is_active = models.BooleanField(default=True)
    color = models.CharField(
        max_length=32,
        default=CardColor.DEFAULT,
        help_text=_("Card background color shown in the UI."),
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "is_deleted"]),
            models.Index(fields=["parent", "is_deleted"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        if self.parent_id:
            return f"{self.parent.name} / {self.name}"
        return self.name

    @property
    def is_root(self):
        return self.parent_id is None

    def soft_delete(self):
        # Soft delete does not trigger DB cascades, so walk the tree by hand.
        for sub_project in self.sub_projects.all():
            sub_project.soft_delete()
        for process in self.processes.all():
            process.soft_delete()
        super().soft_delete()

    def clean(self):
        if self.parent_id and self.parent_id == self.pk:
            raise ValidationError({"parent": _("A project cannot be its own parent.")})
        # Keep tree shallow for MVP: only one level of sub-projects.
        if self.parent_id and self.parent and self.parent.parent_id:
            raise ValidationError(
                {"parent": _("Sub-projects can only be created under a root project.")}
            )

    def get_root(self):
        """Sharing is always at root-project level."""
        if self.parent_id is None:
            return self
        return self.parent


class ProjectMember(models.Model):
    """
    Access to a root project (and its full tree).

    Roles:
    - owner: invite/remove members, delete project, full edit
    - editor: create/edit documentation
    - viewer: read + download PDF
    """

    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")
        EDITOR = "editor", _("Editor")
        VIEWER = "viewer", _("Viewer")

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
        help_text=_("Must be a root project (parent is null)."),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_invites_sent",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"],
                name="uniq_project_member",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "role"]),
            models.Index(fields=["project", "role"]),
        ]

    def __str__(self):
        return f"{self.project_id}:{self.user_id}:{self.role}"

    def clean(self):
        if self.project_id and self.project.parent_id is not None:
            raise ValidationError(
                {"project": _("Members can only be attached to a root project.")}
            )


class Process(BaseModel):
    """
    Business process under a project or sub-project,
    e.g. sales_process, procurement_process.
    """

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="processes",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    process_owner_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text=_("Name of the process owner in the client company"),
    )
    department = models.CharField(max_length=255, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_processes",
    )
    color = models.CharField(
        max_length=32,
        default=CardColor.DEFAULT,
        help_text=_("Card background color shown in the UI."),
    )

    class Meta:
        ordering = ["order", "id"]
        verbose_name_plural = "processes"
        indexes = [
            models.Index(fields=["project", "is_deleted"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"

    def soft_delete(self):
        for step in self.steps.all():
            step.soft_delete()
        retire(self.connections.all(), timezone.now())
        super().soft_delete()


class ProcessStep(BaseModel):
    """
    A step node on the process canvas (e.g. square shape).
    Clicking opens explanation / risks / controls.
    """

    class ShapeType(models.TextChoices):
        SQUARE = "square", _("Square")
        RECTANGLE = "rectangle", _("Rectangle")
        CIRCLE = "circle", _("Circle")
        DIAMOND = "diamond", _("Diamond")
        OVAL = "oval", _("Oval")

    process = models.ForeignKey(
        Process,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    title = models.CharField(max_length=255)
    shape_type = models.CharField(
        max_length=20,
        choices=ShapeType.choices,
        default=ShapeType.SQUARE,
    )
    position_x = models.FloatField(default=0)
    position_y = models.FloatField(default=0)
    order = models.PositiveIntegerField(default=0)
    explanation = models.TextField(
        blank=True,
        default="",
        help_text=_("HTML content from rich text editor (RTL/Farsi supported)"),
    )

    class Meta:
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["process", "is_deleted"]),
        ]

    def __str__(self):
        return f"{self.process.name} / {self.title}"

    def soft_delete(self):
        now = timezone.now()
        retire(self.outgoing_connections.all(), now)
        retire(self.incoming_connections.all(), now)
        retire(self.risks.all(), now)
        retire(self.controls.all(), now)
        retire(self.media_items.all(), now)
        super().soft_delete()


class StepConnection(BaseModel):
    """
    Directed arrow between two steps of the same process,
    used to draw the flow on the canvas (step 1 -> step 2).
    """

    process = models.ForeignKey(
        Process,
        on_delete=models.CASCADE,
        related_name="connections",
    )
    from_step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="outgoing_connections",
    )
    to_step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="incoming_connections",
    )
    label = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text=_("Optional text shown on the arrow, e.g. «تایید شد»"),
    )

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["process", "is_deleted"]),
        ]

    def __str__(self):
        return f"{self.from_step.title} → {self.to_step.title}"

    def clean(self):
        errors = {}

        if self.from_step_id and self.from_step_id == self.to_step_id:
            errors["to_step"] = _("A step cannot be connected to itself.")

        if self.from_step_id and self.to_step_id:
            if self.from_step.process_id != self.to_step.process_id:
                errors["to_step"] = _("Both steps must belong to the same process.")
            elif self.process_id and self.process_id != self.from_step.process_id:
                errors["process"] = _("Connection must belong to the steps' process.")

        if errors:
            raise ValidationError(errors)


class StepRisk(BaseModel):
    """Risk items documented for a process step."""

    step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="risks",
    )
    title = models.CharField(max_length=255)
    content = models.TextField(
        blank=True,
        default="",
        help_text=_("HTML content from rich text editor (RTL/Farsi supported)"),
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class StepControl(BaseModel):
    """Control items documented for a process step."""

    step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="controls",
    )
    title = models.CharField(max_length=255)
    content = models.TextField(
        blank=True,
        default="",
        help_text=_("HTML content from rich text editor (RTL/Farsi supported)"),
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class StepMedia(BaseModel):
    """
    Link / photo / file attached to a step section.

    - section=explanation → media for the explanation tab (risk/control null)
    - section=risk → media for a specific StepRisk (risk required)
    - section=control → media for a specific StepControl (control required)
    """

    class Section(models.TextChoices):
        EXPLANATION = "explanation", _("Explanation")
        RISK = "risk", _("Risk")
        CONTROL = "control", _("Control")

    class Kind(models.TextChoices):
        IMAGE = "image", _("Image")
        FILE = "file", _("File")
        LINK = "link", _("Link")

    step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="media_items",
    )
    section = models.CharField(max_length=20, choices=Section.choices)
    risk = models.ForeignKey(
        StepRisk,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="media_items",
    )
    control = models.ForeignKey(
        StepControl,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="media_items",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=255, blank=True, default="")
    file = models.FileField(
        upload_to="step_media/%Y/%m/",
        blank=True,
        null=True,
        help_text=_("Required for image/file kinds"),
    )
    url = models.URLField(
        blank=True,
        default="",
        help_text=_("Required for link kind; optional external URL for others"),
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name_plural = "step media"
        indexes = [
            models.Index(fields=["step", "section", "is_deleted"]),
        ]

    def __str__(self):
        return self.title or f"{self.section}:{self.kind}"

    def clean(self):
        errors = {}

        if self.section == self.Section.EXPLANATION:
            if self.risk_id or self.control_id:
                errors["section"] = _("Explanation media must not set risk or control.")
        elif self.section == self.Section.RISK:
            if not self.risk_id:
                errors["risk"] = _("Risk media requires a risk.")
            elif self.risk and self.risk.step_id != self.step_id:
                errors["risk"] = _("Risk must belong to the same step.")
            if self.control_id:
                errors["control"] = _("Risk media must not set control.")
        elif self.section == self.Section.CONTROL:
            if not self.control_id:
                errors["control"] = _("Control media requires a control.")
            elif self.control and self.control.step_id != self.step_id:
                errors["control"] = _("Control must belong to the same step.")
            if self.risk_id:
                errors["risk"] = _("Control media must not set risk.")

        if self.kind == self.Kind.LINK:
            if not self.url:
                errors["url"] = _("Link media requires a URL.")
        elif self.kind in (self.Kind.IMAGE, self.Kind.FILE):
            if not self.file and not self.url:
                errors["file"] = _("Image/file media requires an uploaded file or URL.")

        if errors:
            raise ValidationError(errors)
