from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

from news.constants import NEWS_GROUP_NAME


def copy_group_members(apps, schema_editor):
    """Seed NewsTeamMember from the legacy Django Group 'News Team'."""
    Group = apps.get_model("auth", "Group")
    NewsTeamMember = apps.get_model("news", "NewsTeamMember")
    group = Group.objects.filter(name=NEWS_GROUP_NAME).first()
    if group is None:
        return
    for user in group.user_set.all():
        NewsTeamMember.objects.get_or_create(user_id=user.pk)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("news", "0008_panel_run_clock"),
    ]

    operations = [
        migrations.CreateModel(
            name="NewsTeamMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notes", models.CharField(blank=True, default="", max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "added_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="news_team_members_added",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        help_text="User who can open /news (feed + detail).",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="news_team_membership",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "News Team member",
                "verbose_name_plural": "News Team members",
                "ordering": ["-created_at"],
            },
        ),
        migrations.RunPython(copy_group_members, noop_reverse),
    ]
