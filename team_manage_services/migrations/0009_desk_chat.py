from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("team_manage_services", "0008_standard_board_colors"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeskChatMessage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("body", models.TextField(max_length=2000)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="desk_chat_messages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="chat_messages",
                        to="team_manage_services.project",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="deskchatmessage",
            index=models.Index(
                fields=["project", "created_at"],
                name="tm_desk_chat_proj_created",
            ),
        ),
    ]
