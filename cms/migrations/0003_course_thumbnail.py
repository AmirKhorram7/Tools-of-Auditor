import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0002_lesson_streamfield"),
        ("wagtailimages", "0027_image_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursepage",
            name="thumbnail",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="wagtailimages.image",
            ),
        ),
    ]
