from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="teacherprofile",
            name="display_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="headline",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="instagram_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="linkedin_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="teachers/"),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="projects",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="telegram_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="teacherprofile",
            name="website",
            field=models.URLField(blank=True),
        ),
    ]
