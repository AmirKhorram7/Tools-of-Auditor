from django.db import migrations

from news.services.catalog import SOURCE_SEED, source_defaults


def seed_sources(apps, schema_editor):
    NewsSource = apps.get_model("news", "NewsSource")
    for row in SOURCE_SEED:
        data = source_defaults(row)
        slug = data.pop("slug")
        NewsSource.objects.update_or_create(slug=slug, defaults=data)


class Migration(migrations.Migration):
    """Re-apply catalog defaults so HTML selectors (Anthropic) stay current."""

    dependencies = [
        ("news", "0005_article_body_warehouse"),
    ]

    operations = [
        migrations.RunPython(seed_sources, migrations.RunPython.noop),
    ]
