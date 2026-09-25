from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0004_lesson_video"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursepage",
            name="level",
            field=models.CharField(
                choices=[
                    ("basic", "مقدماتی / Basic"),
                    ("advanced", "پیشرفته / Advanced"),
                    ("professional", "تخصصی / Professional"),
                ],
                default="basic",
                help_text="مقدماتی، پیشرفته یا تخصصی.",
                max_length=20,
            ),
        ),
        migrations.AlterModelOptions(
            name="modulepage",
            options={"verbose_name": "فصل", "verbose_name_plural": "فصل‌ها"},
        ),
    ]
