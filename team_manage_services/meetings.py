"""
Isolated Google Meet feature for work projects.

Turn off with MEETINGS_ENABLED = False, then hide the UI import.
Safe to delete this module, the migration, meeting views, and
frontend/src/components/work/meet/ if the feature is cut.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

# Flip this to hide the API without dropping tables.
MEETINGS_ENABLED = True


class ProjectMeeting(models.Model):
    class Audience(models.TextChoices):
        ALL = "all", _("Everyone on the project")
        SELECTED = "selected", _("Selected people")

    class Status(models.TextChoices):
        LIVE = "live", _("Live")
        ENDED = "ended", _("Ended")

    project = models.ForeignKey(
        "team_manage_services.Project",
        on_delete=models.CASCADE,
        related_name="meetings",
    )
    title = models.CharField(max_length=160)
    meet_url = models.URLField(max_length=400)
    audience = models.CharField(
        max_length=16,
        choices=Audience.choices,
        default=Audience.ALL,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.LIVE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_project_meetings",
    )
    guests = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="invited_project_meetings",
        blank=True,
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["project", "status"], name="tm_meet_project_status"),
        ]

    def __str__(self):
        return f"{self.project_id}: {self.title}"
