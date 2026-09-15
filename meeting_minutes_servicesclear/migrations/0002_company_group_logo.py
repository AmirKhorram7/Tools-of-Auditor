from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meeting_minutes_servicesclear", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="minutes/companies/%Y/%m/"),
        ),
        migrations.AddField(
            model_name="group",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="minutes/groups/%Y/%m/"),
        ),
    ]
