from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("team_manage_services", "0006_project_meetings"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="prerequisites",
            field=models.ManyToManyField(
                blank=True,
                help_text="Up to two earlier tasks. Shown on the flow view only — does not block work.",
                related_name="dependents",
                to="team_manage_services.task",
            ),
        ),
    ]
