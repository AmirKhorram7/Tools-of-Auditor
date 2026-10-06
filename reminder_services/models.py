from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Channel(models.TextChoices):
    EMAIL = "email", _("Email")
    TELEGRAM = "telegram", _("Telegram")
    WHATSAPP = "whatsapp", _("WhatsApp")
    SMS = "sms", _("SMS")


class Mode(models.TextChoices):
    BEFORE = "before", _("Days before the due date, at a time")
    AT = "at", _("At an exact date and time")


class ReminderContact(models.Model):
    """Where this user's reminders go. SMS always uses the account phone."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reminder_contact",
    )
    email = models.EmailField(blank=True, default="")
    telegram_chat_id = models.CharField(max_length=32, blank=True, default="")
    whatsapp_number = models.CharField(max_length=20, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"contact of {self.user_id}"


class ScheduleSpec(models.Model):
    """When and how to send. Shared by groups and by single reminders."""

    channels = models.JSONField(default=list, help_text=_("Subset of email, telegram, whatsapp, sms."))
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.BEFORE)
    offset_days = models.PositiveSmallIntegerField(default=1)
    at_time = models.TimeField(null=True, blank=True, help_text=_("Local time of day for `before` mode."))
    fixed_at = models.DateTimeField(null=True, blank=True, help_text=_("Exact moment for `at` mode."))

    class Meta:
        abstract = True


class ReminderGroup(ScheduleSpec):
    """A reusable preset, e.g. "Force messages: SMS + Telegram, 1 day before at 08:00"."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reminder_groups",
    )
    name = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="reminder_group_unique_name"),
        ]

    def __str__(self):
        return self.name


class Reminder(ScheduleSpec):
    """One scheduled message for one target (a daybook plan, a note, later a meeting item)."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", _("Scheduled")
        SENT = "sent", _("Sent")
        FAILED = "failed", _("Failed")
        SKIPPED = "skipped", _("Skipped")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reminders",
    )
    target_type = models.CharField(max_length=40, help_text=_("Registered key, e.g. daybook.plan."))
    target_id = models.PositiveBigIntegerField()
    group = models.ForeignKey(
        ReminderGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reminders",
    )
    send_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    attempts = models.PositiveSmallIntegerField(default=0)
    results = models.JSONField(default=dict, blank=True, help_text=_("Per-channel outcome."))
    message = models.TextField(blank=True, default="", help_text=_("Text that was sent."))
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["send_at", "id"]
        indexes = [
            models.Index(fields=["status", "send_at"], name="reminder_due"),
            models.Index(fields=["target_type", "target_id"], name="reminder_target"),
        ]

    def __str__(self):
        return f"{self.target_type}#{self.target_id} @ {self.send_at:%Y-%m-%d %H:%M}"
