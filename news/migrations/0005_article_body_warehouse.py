import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

from news.constants import DEFAULT_WAREHOUSE_HOUR, DEFAULT_WAREHOUSE_INTERVAL_HOURS, DEFAULT_WAREHOUSE_MINUTE


def seed_warehouse(apps, schema_editor):
    NewsWarehouseSettings = apps.get_model("news", "NewsWarehouseSettings")
    NewsWarehouseSettings.objects.get_or_create(
        pk=1,
        defaults={
            "enabled": False,
            "interval_hours": DEFAULT_WAREHOUSE_INTERVAL_HOURS,
            "run_hour": DEFAULT_WAREHOUSE_HOUR,
            "run_minute": DEFAULT_WAREHOUSE_MINUTE,
        },
    )


def unseed_warehouse(apps, schema_editor):
    NewsWarehouseSettings = apps.get_model("news", "NewsWarehouseSettings")
    NewsWarehouseSettings.objects.filter(pk=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("news", "0004_panel_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="body",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="article",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="article",
            index=models.Index(fields=["updated_at"], name="news_art_updated"),
        ),
        migrations.CreateModel(
            name="NewsWarehouseSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "enabled",
                    models.BooleanField(
                        default=False,
                        help_text="Off: never copy. On: copy new rows on the interval at run_hour.",
                    ),
                ),
                (
                    "interval_hours",
                    models.PositiveSmallIntegerField(
                        default=24,
                        help_text="24, 48, 72, 168 (weekly), 720 (monthly).",
                    ),
                ),
                (
                    "run_hour",
                    models.PositiveSmallIntegerField(
                        default=2,
                        help_text="Hour in TIME_ZONE (Asia/Tehran). 2 = 02:00, off the live site.",
                    ),
                ),
                (
                    "run_minute",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="0–59. Beat ticks every 15 minutes, so 0 is the usual value.",
                    ),
                ),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_id", models.PositiveBigIntegerField(default=0)),
                ("last_sync_count", models.PositiveIntegerField(default=0)),
                ("last_error", models.TextField(blank=True, default="")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="news_warehouse_updates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "News warehouse settings",
                "verbose_name_plural": "News warehouse settings",
            },
        ),
        migrations.RunPython(seed_warehouse, unseed_warehouse),
    ]
