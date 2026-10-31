from django.db import migrations, models

from news.constants import DEFAULT_PANEL_HOUR, DEFAULT_PANEL_MINUTE


class Migration(migrations.Migration):

    dependencies = [
        ("news", "0007_article_detail_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="newspanelsettings",
            name="run_hour",
            field=models.PositiveSmallIntegerField(
                default=DEFAULT_PANEL_HOUR,
                help_text="Local hour (TIME_ZONE) when a scheduled fetch may start.",
            ),
        ),
        migrations.AddField(
            model_name="newspanelsettings",
            name="run_minute",
            field=models.PositiveSmallIntegerField(
                default=DEFAULT_PANEL_MINUTE,
                help_text="Local minute. Beat ticks every 15 minutes; use 0, 15, 30, or 45.",
            ),
        ),
    ]
