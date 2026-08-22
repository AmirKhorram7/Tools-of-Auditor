from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


def seed_platform_board(apps, schema_editor):
    BoardTemplate = apps.get_model("team_manage_services", "BoardTemplate")
    BoardTemplateColumn = apps.get_model("team_manage_services", "BoardTemplateColumn")
    if BoardTemplate.objects.filter(is_platform=True).exists():
        return
    template = BoardTemplate.objects.create(
        company=None,
        name="بورد استاندارد",
        is_default=False,
        is_platform=True,
        requires_approval=True,
        created_by=None,
    )
    columns = (
        ("برای انجام", "#14233A", "todo", False),
        ("در حال انجام", "#1A2B49", "in_progress", False),
        ("تست", "#243656", "in_progress", False),
        ("در انتظار تأیید", "#3A2430", "in_review", False),
        ("بسته", "#1E3328", "done", True),
    )
    for index, (name, color, status_key, is_closed) in enumerate(columns):
        BoardTemplateColumn.objects.create(
            template=template,
            name=name,
            color=color,
            position=index,
            status_key=status_key,
            is_closed=is_closed,
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("team_manage_services", "0004_team_owner_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="require_approval_before_close",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="project",
            name="require_approval_before_close",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="boardtemplate",
            name="is_platform",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="boardtemplate",
            name="requires_approval",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="boardtemplate",
            name="company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="board_templates",
                to="team_manage_services.company",
            ),
        ),
        migrations.AlterField(
            model_name="boardtemplate",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="created_board_templates",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(seed_platform_board, migrations.RunPython.noop),
    ]
