from django.conf import settings
from django.db import models
from django.utils.html import escape
from modelcluster.fields import ParentalKey
from wagtail.admin.panels import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.api import APIField
from wagtail.fields import RichTextField, StreamField
from wagtail.models import Orderable, Page
from wagtailmedia.edit_handlers import MediaChooserPanel

from cms.blocks import LessonStreamBlock


class HomePage(Page):
    """Root of the course tree. Categories sit under this page."""

    intro = RichTextField(blank=True)
    subpage_types = ["cms.CategoryPage"]
    max_count = 1

    content_panels = Page.content_panels + [FieldPanel("intro")]


class CategoryPage(Page):
    """Education folder. Only an admin creates this. Teachers add a course under it."""

    description = RichTextField(blank=True)

    parent_page_types = ["cms.HomePage"]
    subpage_types = ["cms.SubCategoryPage", "cms.CoursePage"]

    content_panels = Page.content_panels + [FieldPanel("description")]
    api_fields = [APIField("description")]


class SubCategoryPage(Page):
    """Education folder. Only an admin creates this. Teachers add a course under it."""

    description = RichTextField(blank=True)

    parent_page_types = ["cms.CategoryPage"]
    subpage_types = ["cms.CoursePage"]

    content_panels = Page.content_panels + [FieldPanel("description")]
    api_fields = [APIField("description")]


class CoursePage(Page):
    """A course. Teachers write it here. Students see it only after an admin publishes it."""

    class Level(models.TextChoices):
        BASIC = "basic", "مقدماتی / Basic"
        ADVANCED = "advanced", "پیشرفته / Advanced"
        PROFESSIONAL = "professional", "تخصصی / Professional"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cms_courses",
    )
    thumbnail = models.ForeignKey(
        "wagtailimages.Image",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    summary = models.TextField(blank=True)
    review_note = models.TextField(blank=True)
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.BASIC,
        help_text="مقدماتی، پیشرفته یا تخصصی.",
    )

    parent_page_types = ["cms.CategoryPage", "cms.SubCategoryPage"]
    subpage_types = ["cms.ModulePage"]

    content_panels = Page.content_panels + [
        FieldPanel("author"),
        FieldPanel("thumbnail"),
        FieldPanel("level"),
        FieldPanel("summary"),
        FieldPanel("review_note"),
    ]
    api_fields = [
        APIField("author"),
        APIField("thumbnail"),
        APIField("level"),
        APIField("summary"),
    ]

    def thumbnail_url(self) -> str:
        return _file_url(getattr(self.thumbnail, "file", None))

    def get_modules(self):
        return self.get_children().live().public().specific().type(ModulePage).order_by("path")


class ModulePage(Page):
    summary = models.TextField(blank=True)

    parent_page_types = ["cms.CoursePage"]
    subpage_types = ["cms.LessonPage"]

    class Meta:
        verbose_name = "فصل"
        verbose_name_plural = "فصل‌ها"

    content_panels = Page.content_panels + [FieldPanel("summary")]
    api_fields = [APIField("summary")]

    def course(self) -> CoursePage:
        return self.get_parent().specific

    def get_lessons(self):
        return self.get_children().live().public().specific().type(LessonPage).order_by("path")


def _file_url(file_field) -> str:
    if not file_field:
        return ""
    try:
        return file_field.url
    except ValueError:
        return ""


class LessonPage(Page):
    """One lesson. Teachers stack heading, text, image, file and video blocks here."""

    short_description = models.CharField(max_length=200, blank=True)
    featured_image = models.ForeignKey(
        "wagtailimages.Image",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    document_file = models.ForeignKey(
        "wagtaildocs.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="Upload or choose a document from the library.",
    )
    video = models.ForeignKey(
        "wagtailmedia.Media",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="Upload or select a video for this lesson.",
    )
    video_url = models.URLField(
        blank=True,
        help_text="Paste a YouTube, Vimeo, or other video link.",
    )
    content = StreamField(
        LessonStreamBlock(),
        blank=True,
        use_json_field=True,
    )

    parent_page_types = ["cms.ModulePage"]
    subpage_types = []

    content_panels = Page.content_panels + [
        FieldPanel("short_description"),
        FieldPanel("featured_image"),
        FieldPanel("document_file"),
        MediaChooserPanel("video", media_type="video"),
        FieldPanel("video_url"),
        FieldPanel("content"),
        MultiFieldPanel([InlinePanel("quiz", max_num=1, label="Four-option quiz")], heading="Quiz"),
        MultiFieldPanel([InlinePanel("exam", max_num=1, label="Exam")], heading="Exam"),
    ]
    api_fields = [
        APIField("short_description"),
        APIField("video"),
        APIField("video_url"),
        APIField("content"),
    ]

    def module(self) -> ModulePage:
        return self.get_parent().specific

    def course(self) -> CoursePage:
        return self.module().course()

    def featured_image_url(self) -> str:
        return _file_url(getattr(self.featured_image, "file", None))

    def document_url(self) -> str:
        return _file_url(getattr(self.document_file, "file", None))

    def document_title(self) -> str:
        return self.document_file.title if self.document_file_id else ""

    def video_file_url(self) -> str:
        return _file_url(getattr(self.video, "file", None))

    def stream_payload(self) -> list[dict]:
        rows = []
        for block in self.content:
            item = {"type": block.block_type, "value": ""}
            if block.block_type == "image":
                image = block.value
                item["value"] = {
                    "url": _file_url(getattr(image, "file", None)),
                    "title": getattr(image, "title", "") or "",
                }
            elif block.block_type == "document":
                document = block.value
                item["value"] = {
                    "url": _file_url(getattr(document, "file", None)),
                    "title": getattr(document, "title", "") or "",
                }
            else:
                item["value"] = str(block.value)
            rows.append(item)
        return rows

    def body_html(self) -> str:
        parts = []
        for block in self.content:
            if block.block_type == "heading":
                parts.append(f"<h3>{escape(str(block.value))}</h3>")
            elif block.block_type == "paragraph":
                parts.append(str(block.value))
            elif block.block_type == "quote":
                parts.append(f"<blockquote>{escape(str(block.value))}</blockquote>")
            elif block.block_type == "code":
                parts.append(f"<pre><code>{escape(str(block.value))}</code></pre>")
            elif block.block_type == "video_embed":
                parts.append(f'<p><a href="{escape(str(block.value))}">{escape(str(block.value))}</a></p>')
        return "".join(parts)

    @property
    def body(self) -> str:
        return self.body_html()


class LessonQuiz(Orderable):
    class Option(models.TextChoices):
        A = "a", "A"
        B = "b", "B"
        C = "c", "C"
        D = "d", "D"

    page = ParentalKey(LessonPage, on_delete=models.CASCADE, related_name="quiz")
    prompt = models.TextField()
    option_a = models.CharField(max_length=500)
    option_b = models.CharField(max_length=500)
    option_c = models.CharField(max_length=500)
    option_d = models.CharField(max_length=500)
    correct_option = models.CharField(max_length=1, choices=Option.choices)

    panels = [
        FieldPanel("prompt"),
        FieldPanel("option_a"),
        FieldPanel("option_b"),
        FieldPanel("option_c"),
        FieldPanel("option_d"),
        FieldPanel("correct_option"),
    ]


class LessonExam(Orderable):
    page = ParentalKey(LessonPage, on_delete=models.CASCADE, related_name="exam")
    prompt = models.TextField()

    panels = [FieldPanel("prompt")]
