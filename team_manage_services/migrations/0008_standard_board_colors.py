from django.db import migrations

# Recolor the platform standard board (and matching uncustomized columns)
# to the Google Calendar semantic palette.
NAME_COLORS = {
    "برای انجام": "#4285F4",
    "در حال انجام": "#F4511E",
    "تست": "#F6BF26",
    "در انتظار تأیید": "#8E24AA",
    "بسته": "#0B8043",
}

OLD_DEFAULTS = {
    "#14233A",
    "#1A2B49",
    "#243656",
    "#3A2430",
    "#1E3328",
    "#C91C69",
    "#1F75CB",
}


def _recolor(qs):
    for row in qs:
        next_color = NAME_COLORS.get((row.name or "").strip())
        if not next_color:
            continue
        current = (row.color or "").strip().upper()
        if current in OLD_DEFAULTS or current == next_color.upper():
            if row.color != next_color:
                row.color = next_color
                row.save(update_fields=["color"])


def forwards(apps, schema_editor):
    BoardTemplateColumn = apps.get_model("team_manage_services", "BoardTemplateColumn")
    BoardColumn = apps.get_model("team_manage_services", "BoardColumn")
    _recolor(BoardTemplateColumn.objects.all())
    _recolor(BoardColumn.objects.all())


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("team_manage_services", "0007_task_prerequisites"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
