from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def empty_doc():
    return {"type": "doc", "content": []}


class Node(TimeStamped):
    """A folder or a page in one owner's tree."""

    class Type(models.TextChoices):
        FOLDER = "folder", _("Folder")
        PAGE = "page", _("Page")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_nodes",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    title = models.CharField(max_length=200)
    icon = models.CharField(max_length=32, blank=True, default="")
    content = models.JSONField(default=empty_doc)
    schema_version = models.PositiveSmallIntegerField(default=1)
    content_text = models.TextField(blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    position = models.PositiveIntegerField(default=0)
    # Materialised path of ids, including this node: "5/8/".
    path = models.CharField(max_length=2000, blank=True, default="")
    depth = models.PositiveIntegerField(default=0)
    is_daily = models.BooleanField(default=False)
    daily_date = models.DateField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        base_manager_name = "all_objects"
        ordering = ["path", "position", "id"]
        indexes = [
            models.Index(fields=["owner", "is_deleted"], name="know_node_owner_alive"),
            models.Index(fields=["owner", "parent", "position"], name="know_node_siblings"),
            models.Index(fields=["owner", "path"], name="know_node_path"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "daily_date"],
                condition=Q(is_daily=True, is_deleted=False),
                name="uniq_knowledge_daily_note",
            ),
        ]

    def __str__(self):
        return self.title

    def soft_delete(self):
        now = timezone.now()
        Node.objects.filter(owner_id=self.owner_id, path__startswith=self.path).update(
            is_deleted=True,
            deleted_at=now,
        )
        self.is_deleted = True
        self.deleted_at = now


class Link(models.Model):
    """A wikilink from one page to another. The row stays if the target is deleted."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_links",
    )
    source = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="outgoing_links")
    target = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="incoming_links")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["source", "target"], name="uniq_knowledge_link"),
        ]
        indexes = [
            models.Index(fields=["target"], name="know_link_target"),
        ]

    def __str__(self):
        return f"{self.source_id} → {self.target_id}"


class Template(TimeStamped):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_templates",
    )
    title = models.CharField(max_length=200)
    content = models.JSONField(default=empty_doc)

    class Meta:
        ordering = ["title", "id"]

    def __str__(self):
        return self.title


class StudyPlan(TimeStamped):
    """A run of study days. Named StudyPlan so it is not the daybook Plan."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_plans",
    )
    title = models.CharField(max_length=200)
    start_date = models.DateField()
    days = models.PositiveSmallIntegerField(default=30)

    class Meta:
        ordering = ["-start_date", "-id"]

    def __str__(self):
        return self.title


class PlanDay(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", _("To do")
        DOING = "doing", _("Doing")
        DONE = "done", _("Done")

    plan = models.ForeignKey(StudyPlan, on_delete=models.CASCADE, related_name="days_rows")
    day_number = models.PositiveSmallIntegerField()
    date = models.DateField()
    node = models.ForeignKey(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plan_days",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.TODO)

    class Meta:
        ordering = ["day_number"]
        constraints = [
            models.UniqueConstraint(fields=["plan", "day_number"], name="uniq_study_plan_day"),
        ]
        indexes = [
            models.Index(fields=["date", "status"], name="know_planday_date"),
        ]

    def __str__(self):
        return f"{self.plan_id} day {self.day_number}"


class Review(models.Model):
    """A short review scheduled after a plan day is finished."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_reviews",
    )
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="reviews")
    plan_day = models.ForeignKey(
        PlanDay,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    due_date = models.DateField()
    step = models.PositiveSmallIntegerField(help_text=_("Days after the work was finished: 1, 3 or 7."))
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["plan_day", "step"], name="uniq_review_step"),
        ]
        indexes = [
            models.Index(fields=["owner", "due_date", "done_at"], name="know_review_due"),
        ]

    def __str__(self):
        return f"review +{self.step} of {self.node_id}"


class InkDrawing(TimeStamped):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_ink",
    )
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="ink_drawings")
    strokes = models.JSONField(default=list)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"ink {self.id} on {self.node_id}"


def attachment_path(instance, filename):
    return f"knowledge/{instance.owner_id}/{timezone.now():%Y/%m}/{filename}"


class Attachment(TimeStamped):
    class Kind(models.TextChoices):
        IMAGE = "image", _("Image")
        PDF = "pdf", _("PDF")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_files",
    )
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_path)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    size = models.PositiveIntegerField()
    name = models.CharField(max_length=255)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.name
