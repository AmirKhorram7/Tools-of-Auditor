import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0003_course_thumbnail"),
        ("wagtailmedia", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonpage",
            name="video",
            field=models.ForeignKey(
                blank=True,
                help_text="Upload or select a video for this lesson.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="wagtailmedia.media",
            ),
        ),
    ]
