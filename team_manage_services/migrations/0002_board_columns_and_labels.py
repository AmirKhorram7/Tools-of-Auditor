# Generated manually for board columns and company labels.

import django.db.models.deletion
from django.db import migrations, models


def seed_existing_project_boards(apps, schema_editor):
    Project = apps.get_model("team_manage_services", "Project")
    BoardColumn = apps.get_model("team_manage_services", "BoardColumn")
    Task = apps.get_model("team_manage_services", "Task")
    defaults = (
        ("برای انجام", "#C91C69", "todo", False),
        ("در حال انجام", "#1F75CB", "in_progress", False),
    )
    for project in Project.objects.all():
        if BoardColumn.objects.filter(project=project).exists():
            continue
        by_status = {}
        for index, (name, color, status_key, is_closed) in enumerate(defaults):
            column = BoardColumn.objects.create(
                project=project,
                name=name,
                color=color,
                status_key=status_key,
                is_closed=is_closed,
                position=index,
            )
            by_status[status_key] = column
        for task in Task.objects.filter(project=project, column__isnull=True):
            task.column = by_status.get(task.status) or by_status["todo"]
            task.save(update_fields=["column"])


class Migration(migrations.Migration):

    dependencies = [
        ("team_manage_services", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkLabel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=80)),
                ("color", models.CharField(default="#428BCA", help_text="Hex color, e.g. #428BCA", max_length=7)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="work_labels",
                        to="team_manage_services.company",
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="BoardColumn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=80)),
                ("color", models.CharField(default="#1F75CB", max_length=7)),
                ("position", models.PositiveIntegerField(default=0)),
                (
                    "status_key",
                    models.CharField(
                        default="in_progress",
                        help_text="Kept in sync with Task.status so list view and progress still work.",
                        max_length=20,
                    ),
                ),
                ("is_closed", models.BooleanField(default=False)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="board_columns",
                        to="team_manage_services.project",
                    ),
                ),
            ],
            options={
                "ordering": ["position", "id"],
            },
        ),
        migrations.AddField(
            model_name="task",
            name="column",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tasks",
                to="team_manage_services.boardcolumn",
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="labels",
            field=models.ManyToManyField(blank=True, related_name="tasks", to="team_manage_services.worklabel"),
        ),
        migrations.AddConstraint(
            model_name="worklabel",
            constraint=models.UniqueConstraint(fields=("company", "name"), name="tm_unique_label_name_in_company"),
        ),
        migrations.AddConstraint(
            model_name="boardcolumn",
            constraint=models.UniqueConstraint(fields=("project", "name"), name="tm_unique_column_name_in_project"),
        ),
        migrations.AddIndex(
            model_name="boardcolumn",
            index=models.Index(fields=["project", "position"], name="tm_col_project_pos"),
        ),
        migrations.RunPython(seed_existing_project_boards, migrations.RunPython.noop),
    ]
