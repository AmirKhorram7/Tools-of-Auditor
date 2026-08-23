from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("team_manage_services", "0005_approval_policy_and_platform_board"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectMeeting",
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
                ("title", models.CharField(max_length=160)),
                ("meet_url", models.URLField(max_length=400)),
                (
                    "audience",
                    models.CharField(
                        choices=[
                            ("all", "Everyone on the project"),
                            ("selected", "Selected people"),
                        ],
                        default="all",
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("live", "Live"), ("ended", "Ended")],
                        default="live",
                        max_length=16,
                    ),
                ),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="created_project_meetings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "guests",
                    models.ManyToManyField(
                        blank=True,
                        related_name="invited_project_meetings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="meetings",
                        to="team_manage_services.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-started_at"],
            },
        ),
        migrations.AddIndex(
            model_name="projectmeeting",
            index=models.Index(
                fields=["project", "status"],
                name="tm_meet_project_status",
            ),
        ),
    ]
