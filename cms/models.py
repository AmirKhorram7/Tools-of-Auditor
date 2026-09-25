from django.conf import settings
from django.db import models
from modelcluster.fields import ParentalKey
from wagtail.admin.panels import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.api import APIField
from wagtail.fields import RichTextField
from wagtail.models import Orderable, Page


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

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cms_courses",
    )
    summary = models.TextField(blank=True)
    review_note = models.TextField(blank=True)

    parent_page_types = ["cms.CategoryPage", "cms.SubCategoryPage"]
    subpage_types = ["cms.ModulePage"]

    content_panels = Page.content_panels + [
        FieldPanel("author"),
        FieldPanel("summary"),
        FieldPanel("review_note"),
    ]
    api_fields = [
        APIField("author"),
        APIField("summary"),
    ]

    def get_modules(self):
        return self.get_children().live().public().specific().type(ModulePage).order_by("path")


class ModulePage(Page):
    summary = models.TextField(blank=True)

    parent_page_types = ["cms.CoursePage"]
    subpage_types = ["cms.LessonPage"]

    content_panels = Page.content_panels + [FieldPanel("summary")]
    api_fields = [APIField("summary")]

    def course(self) -> CoursePage:
        return self.get_parent().specific

    def get_lessons(self):
        return self.get_children().live().public().specific().type(LessonPage).order_by("path")


class LessonPage(Page):
    body = RichTextField(blank=True)
    video_url = models.URLField(blank=True)

    parent_page_types = ["cms.ModulePage"]
    subpage_types = []

    content_panels = Page.content_panels + [
        FieldPanel("body"),
        FieldPanel("video_url"),
        MultiFieldPanel([InlinePanel("quiz", max_num=1, label="Four-option quiz")], heading="Quiz"),
        MultiFieldPanel([InlinePanel("exam", max_num=1, label="Exam")], heading="Exam"),
    ]
    api_fields = [
        APIField("body"),
        APIField("video_url"),
    ]

    def module(self) -> ModulePage:
        return self.get_parent().specific

    def course(self) -> CoursePage:
        return self.module().course()


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
