from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("system_explanation_services", "0007_project_color_process_color"),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="color",
            field=models.CharField(
                default="default",
                help_text="Card background color shown in the UI.",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="process",
            name="color",
            field=models.CharField(
                default="default",
                help_text="Card background color shown in the UI.",
                max_length=32,
            ),
        ),
    ]
