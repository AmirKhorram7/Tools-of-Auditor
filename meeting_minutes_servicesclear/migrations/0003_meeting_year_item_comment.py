import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def fill_meeting_years(apps, schema_editor):
    Meeting = apps.get_model("meeting_minutes_servicesclear", "Meeting")
    from meeting_minutes_servicesclear.jalali import jalali_year

    for meeting in Meeting.objects.all().only("id", "date"):
        Meeting.objects.filter(pk=meeting.pk).update(year=jalali_year(meeting.date))


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("meeting_minutes_servicesclear", "0002_company_group_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="meeting",
            name="year",
            field=models.PositiveIntegerField(
                default=1405,
                help_text="Jalali year of the meeting date. Numbers restart at 1 each year.",
            ),
            preserve_default=False,
        ),
        migrations.RunPython(fill_meeting_years, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="meeting",
            name="mm_unique_meeting_number_in_group",
        ),
        migrations.AddConstraint(
            model_name="meeting",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("group", "year", "meeting_number"),
                name="mm_unique_meeting_number_per_group_year",
            ),
        ),
        migrations.CreateModel(
            name="MeetingItemComment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("body", models.TextField(max_length=2000)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(app_label)s_%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "deleted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(app_label)s_%(class)s_deleted",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="meeting_minutes_servicesclear.meetingitem",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(app_label)s_%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
    ]
