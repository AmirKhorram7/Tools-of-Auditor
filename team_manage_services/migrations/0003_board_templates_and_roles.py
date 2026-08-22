from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("team_manage_services", "0002_board_columns_and_labels"),
    ]

    operations = [
        migrations.CreateModel(
            name="BoardTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("is_default", models.BooleanField(default=False)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="board_templates",
                        to="team_manage_services.company",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_board_templates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-is_default", "name"]},
        ),
        migrations.CreateModel(
            name="BoardTemplateColumn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=80)),
                ("color", models.CharField(default="#1A2B49", max_length=7)),
                ("position", models.PositiveIntegerField(default=0)),
                ("status_key", models.CharField(default="todo", max_length=20)),
                ("is_closed", models.BooleanField(default=False)),
                (
                    "template",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="columns",
                        to="team_manage_services.boardtemplate",
                    ),
                ),
            ],
            options={"ordering": ["position", "id"]},
        ),
        migrations.AddConstraint(
            model_name="boardtemplate",
            constraint=models.UniqueConstraint(
                fields=("company", "name"),
                name="tm_unique_board_template_name",
            ),
        ),
        migrations.AddField(
            model_name="teammember",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("maintainer", "Maintainer"),
                    ("developer", "Developer"),
                    ("planner", "Planner"),
                    ("guest", "Guest"),
                ],
                default="developer",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="invitation",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("maintainer", "Maintainer"),
                    ("developer", "Developer"),
                    ("planner", "Planner"),
                    ("guest", "Guest"),
                ],
                default="developer",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="projectmember",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("maintainer", "Maintainer"),
                    ("developer", "Developer"),
                    ("planner", "Planner"),
                    ("guest", "Guest"),
                    ("manager", "Manager"),
                    ("member", "Member"),
                ],
                default="member",
                max_length=20,
            ),
        ),
    ]
