import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

from news.constants import DEFAULT_INTERVAL_HOURS, FETCH_MODE_MANUAL


def seed_panel(apps, schema_editor):
    NewsPanelSettings = apps.get_model("news", "NewsPanelSettings")
    NewsPanelSettings.objects.get_or_create(
        pk=1,
        defaults={
            "fetch_mode": FETCH_MODE_MANUAL,
            "interval_hours": DEFAULT_INTERVAL_HOURS,
        },
    )


def unseed_panel(apps, schema_editor):
    NewsPanelSettings = apps.get_model("news", "NewsPanelSettings")
    NewsPanelSettings.objects.filter(pk=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("news", "0003_seed_sources"),
    ]

    operations = [
        migrations.AddField(
            model_name="fetchjob",
            name="trigger",
            field=models.CharField(
                choices=[("manual", "Manual"), ("scheduled", "Scheduled")],
                default="manual",
                help_text="manual = Start fetch / admin. scheduled = beat using panel settings.",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="NewsPanelSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "fetch_mode",
                    models.CharField(
                        choices=[("manual", "Manual"), ("scheduled", "Scheduled")],
                        default="manual",
                        help_text="manual: only Start fetch. scheduled: beat runs all active sources on the interval.",
                        max_length=16,
                    ),
                ),
                (
                    "interval_hours",
                    models.PositiveSmallIntegerField(
                        default=24,
                        help_text="Used when fetch_mode is scheduled. 24 = once a day.",
                    ),
                ),
                (
                    "last_scheduled_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When the last scheduled (beat) run actually started.",
                        null=True,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="news_panel_updates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "News panel settings",
                "verbose_name_plural": "News panel settings",
            },
        ),
        migrations.RunPython(seed_panel, unseed_panel),
    ]
