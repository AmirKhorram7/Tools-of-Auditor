from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("system_explanation_services", "0008_card_color_hex"),
    ]

    operations = [
        migrations.AddField(
            model_name="processstep",
            name="status",
            field=models.CharField(
                choices=[
                    ("default", "Default"),
                    ("written", "Written"),
                    ("completed", "Completed"),
                ],
                default="default",
                help_text="Progress state shown as an outline on the process canvas.",
                max_length=20,
            ),
        ),
    ]
