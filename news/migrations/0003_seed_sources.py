from django.db import migrations

from news.services.catalog import SOURCE_SEED, source_defaults


def seed_sources(apps, schema_editor):
    NewsSource = apps.get_model("news", "NewsSource")
    for row in SOURCE_SEED:
        data = source_defaults(row)
        slug = data.pop("slug")
        NewsSource.objects.update_or_create(slug=slug, defaults=data)


def unseed_sources(apps, schema_editor):
    NewsSource = apps.get_model("news", "NewsSource")
    NewsSource.objects.filter(slug__in=[row["slug"] for row in SOURCE_SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("news", "0002_news_team_group"),
    ]

    operations = [
        migrations.RunPython(seed_sources, unseed_sources),
    ]
