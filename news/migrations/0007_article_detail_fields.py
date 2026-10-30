from django.db import migrations, models


SOURCE_COLORS = {
    "anthropic-news": "#e8a87c",
    "anthropic-engineering": "#e8a87c",
    "openai-news": "#4ade80",
    "deepmind-blog": "#60a5fa",
    "google-ai-blog": "#60a5fa",
    "meta-ai": "#38bdf8",
    "mit-news-ai": "#f43f5e",
    "stanford-hai": "#fb7185",
    "stanford-ai-lab": "#fb7185",
    "huggingface-blog": "#facc15",
    "techcrunch-ai": "#34d399",
    "theverge-ai": "#c084fc",
    "hacker-news-ai": "#fb923c",
    "nvidia-blog": "#76b900",
    "microsoft-research": "#00a4ef",
    "arxiv-cs-ai": "#b31b1b",
    "arxiv-cs-lg": "#b31b1b",
    "arxiv-cs-cl": "#b31b1b",
}


def seed_colors(apps, schema_editor):
    NewsSource = apps.get_model("news", "NewsSource")
    for slug, color in SOURCE_COLORS.items():
        NewsSource.objects.filter(slug=slug).update(color=color)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("news", "0006_refresh_catalog"),
    ]

    operations = [
        migrations.AddField(
            model_name="newssource",
            name="color",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hex accent for Signal cards/detail (e.g. #e8a87c). Empty → frontend fallback.",
                max_length=7,
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="brief",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Up to 3 EN bullets for the 30-second brief.",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="brief_fa",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Up to 3 FA bullets for the 30-second brief.",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="key_points",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="[{title, text, title_fa, text_fa}, …] — usually 3.",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="paragraphs",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="[{en, fa}, …] story excerpts (or full text when licensed).",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="why_it_matters",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="article",
            name="why_it_matters_fa",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="article",
            name="entities",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="[{type, name}, …] Model / Org / Topic chips.",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="reading_minutes",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(seed_colors, noop),
    ]
