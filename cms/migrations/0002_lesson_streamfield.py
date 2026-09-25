import uuid

import django.db.models.deletion
import wagtail.blocks
import wagtail.documents.blocks
import wagtail.fields
import wagtail.images.blocks
from django.db import migrations, models


def copy_body_into_stream(apps, schema_editor):
    LessonPage = apps.get_model("cms", "LessonPage")
    for lesson in LessonPage.objects.all():
        text = (getattr(lesson, "body", None) or "").strip()
        if not text:
            continue
        html = text if "<" in text else f"<p>{text}</p>"
        lesson.content = [{"id": str(uuid.uuid4()), "type": "paragraph", "value": html}]
        lesson.save(update_fields=["content"])


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0001_initial"),
        ("wagtaildocs", "0014_alter_document_file_size"),
        ("wagtailimages", "0027_image_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonpage",
            name="short_description",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="lessonpage",
            name="featured_image",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="wagtailimages.image",
            ),
        ),
        migrations.AddField(
            model_name="lessonpage",
            name="document_file",
            field=models.ForeignKey(
                blank=True,
                help_text="Upload or choose a document from the library.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="wagtaildocs.document",
            ),
        ),
        migrations.AddField(
            model_name="lessonpage",
            name="content",
            field=wagtail.fields.StreamField(
                [
                    ("heading", wagtail.blocks.CharBlock(form_classname="title")),
                    (
                        "paragraph",
                        wagtail.blocks.RichTextBlock(
                            features=["bold", "italic", "link", "ol", "ul", "h3", "h4"]
                        ),
                    ),
                    ("image", wagtail.images.blocks.ImageChooserBlock()),
                    ("document", wagtail.documents.blocks.DocumentChooserBlock()),
                    ("quote", wagtail.blocks.BlockQuoteBlock()),
                    ("code", wagtail.blocks.TextBlock()),
                    ("video_embed", wagtail.blocks.URLBlock()),
                ],
                blank=True,
                use_json_field=True,
            ),
        ),
        migrations.RunPython(copy_body_into_stream, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="lessonpage",
            name="body",
        ),
        migrations.AlterField(
            model_name="lessonpage",
            name="video_url",
            field=models.URLField(
                blank=True,
                help_text="Paste a YouTube, Vimeo, or other video link.",
            ),
        ),
    ]
