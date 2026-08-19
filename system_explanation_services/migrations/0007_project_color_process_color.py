from django.db import migrations, models

COLOR_CHOICES = [
    ("default", "Default"),
    ("slate", "Slate"),
    ("navy", "Navy"),
    ("sky", "Sky"),
    ("teal", "Teal"),
    ("green", "Green"),
    ("lime", "Lime"),
    ("amber", "Amber"),
    ("orange", "Orange"),
    ("rose", "Rose"),
    ("purple", "Purple"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("system_explanation_services", "0006_fix_projectmember_index_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="color",
            field=models.CharField(
                choices=COLOR_CHOICES,
                default="default",
                help_text="Card background color shown in the UI.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="process",
            name="color",
            field=models.CharField(
                choices=COLOR_CHOICES,
                default="default",
                help_text="Card background color shown in the UI.",
                max_length=20,
            ),
        ),
    ]
