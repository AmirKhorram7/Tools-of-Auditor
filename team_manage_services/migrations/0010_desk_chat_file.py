from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("team_manage_services", "0009_desk_chat"),
    ]

    operations = [
        migrations.AddField(
            model_name="deskchatmessage",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="desk-chat/%Y/%m/"),
        ),
        migrations.AddField(
            model_name="deskchatmessage",
            name="file_size",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deskchatmessage",
            name="original_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AlterField(
            model_name="deskchatmessage",
            name="body",
            field=models.TextField(blank=True, default="", max_length=2000),
        ),
    ]
