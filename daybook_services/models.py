from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import F, Q
from django.utils.translation import gettext_lazy as _

HEX_COLOR = RegexValidator(r"^#[0-9A-Fa-f]{6}$", _("Use a hex colour like #232F3E."))
DEFAULT_COLOR = "#232F3E"


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Daybook(TimeStamped):
    """One per user: how the calendar is shown."""

    class CalendarSystem(models.TextChoices):
        JALALI = "jalali", _("Jalali")
        GREGORIAN = "gregorian", _("Gregorian")

    class View(models.TextChoices):
        DAY = "day", _("Day")
        WEEK = "week", _("Week")
        MONTH = "month", _("Month")

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daybook",
    )
    calendar_system = models.CharField(
        max_length=10,
        choices=CalendarSystem.choices,
        default=CalendarSystem.JALALI,
    )
    default_view = models.CharField(
        max_length=10,
        choices=View.choices,
        default=View.WEEK,
    )

    def __str__(self):
        return f"daybook of {self.owner_id}"


class DayNote(TimeStamped):
    """A rich-text note pinned to one calendar day."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="day_notes",
    )
    date = models.DateField()
    title = models.CharField(max_length=160, blank=True, default="")
    body = models.TextField(blank=True, default="", help_text=_("Sanitised HTML."))
    color = models.CharField(max_length=7, default=DEFAULT_COLOR, validators=[HEX_COLOR])
    is_pinned = models.BooleanField(default=False)

    class Meta:
        ordering = ["date", "-is_pinned", "created_at", "id"]
        indexes = [models.Index(fields=["owner", "date"], name="daybook_note_owner_date")]

    def __str__(self):
        return f"{self.date} · {self.title or 'note'}"


class Plan(TimeStamped):
    """A checklist that covers one day or a period (start → end)."""

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        DONE = "done", _("Done")
        CANCELLED = "cancelled", _("Cancelled")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="day_plans",
    )
    title = models.CharField(max_length=160)
    start_date = models.DateField()
    end_date = models.DateField()
    color = models.CharField(max_length=7, default=DEFAULT_COLOR, validators=[HEX_COLOR])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["start_date", "created_at", "id"]
        indexes = [
            models.Index(fields=["owner", "start_date", "end_date"], name="daybook_plan_owner_range"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="daybook_plan_end_after_start",
            ),
        ]

    def __str__(self):
        return self.title


class PlanItem(TimeStamped):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=240)
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.title
