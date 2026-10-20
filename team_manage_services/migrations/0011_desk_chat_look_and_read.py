from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("team_manage_services", "0010_desk_chat_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="chat_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="project",
            name="chat_theme",
            field=models.CharField(blank=True, default="navy", max_length=16),
        ),
        migrations.AddField(
            model_name="project",
            name="chat_wallpaper",
            field=models.CharField(blank=True, default="plain", max_length=16),
        ),
        migrations.CreateModel(
            name="DeskChatCursor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("last_read_id", models.PositiveIntegerField(default=0)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chat_cursors",
                        to="team_manage_services.project",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="desk_chat_cursors",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="deskchatcursor",
            constraint=models.UniqueConstraint(
                fields=("project", "user"),
                name="tm_unique_desk_chat_cursor",
            ),
        ),
        migrations.AddIndex(
            model_name="deskchatcursor",
            index=models.Index(fields=["project", "last_read_id"], name="tm_desk_chat_cursor_read"),
        ),
    ]
