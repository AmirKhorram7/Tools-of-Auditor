import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_owner_memberships(apps, schema_editor):
    Project = apps.get_model("system_explanation_services", "Project")
    ProjectMember = apps.get_model("system_explanation_services", "ProjectMember")
    for project in Project.objects.filter(parent__isnull=True, is_deleted=False):
        ProjectMember.objects.get_or_create(
            project_id=project.id,
            user_id=project.owner_id,
            defaults={"role": "owner", "invited_by_id": project.owner_id},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("system_explanation_services", "0004_stepconnection"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectMember",
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
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("owner", "Owner"),
                            ("editor", "Editor"),
                            ("viewer", "Viewer"),
                        ],
                        default="viewer",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "invited_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="project_invites_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        help_text="Must be a root project (parent is null).",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="system_explanation_services.project",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="projectmember",
            index=models.Index(fields=["user", "role"], name="system_expl_user_id_6e2a8a_idx"),
        ),
        migrations.AddIndex(
            model_name="projectmember",
            index=models.Index(
                fields=["project", "role"], name="system_expl_project_8c1f4e_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="projectmember",
            constraint=models.UniqueConstraint(
                fields=("project", "user"), name="uniq_project_member"
            ),
        ),
        migrations.RunPython(create_owner_memberships, noop_reverse),
    ]
