from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("user_management", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="BuilderContactClick",
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
                (
                    "channel",
                    models.CharField(
                        choices=[("linkedin", "LinkedIn"), ("telegram", "Telegram")],
                        max_length=16,
                    ),
                ),
                ("page", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="builder_contact_clicks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Builder contact click",
                "verbose_name_plural": "Builder contact clicks",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="buildercontactclick",
            index=models.Index(
                fields=["channel", "-created_at"],
                name="user_manage_channel_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="buildercontactclick",
            index=models.Index(
                fields=["user", "-created_at"],
                name="user_manage_user_id_created_idx",
            ),
        ),
    ]
