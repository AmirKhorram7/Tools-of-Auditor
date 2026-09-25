from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from wagtail.models import Page, Site

from cms.models import (
    CategoryPage,
    CoursePage,
    HomePage,
    LessonExam,
    LessonPage,
    LessonQuiz,
    ModulePage,
    SubCategoryPage,
)
from education.models import TeacherGroup, TeacherGroupMember

User = get_user_model()
PASSWORD = "EduDemo#2026"


def client_for(user) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def make_user(phone: str, **extra):
    extra.setdefault("is_phone_verified", True)
    return User.objects.create_user(phone_number=phone, password=PASSWORD, **extra)


def make_admin(phone="09120000009"):
    user = User.objects.create_superuser(phone_number=phone, password=PASSWORD)
    user.is_phone_verified = True
    user.save(update_fields=["is_phone_verified"])
    return user


class CourseTree:
    """Computer → Programming → course with modules and lessons."""

    def __init__(self, author, *, title="Python 101", slug="python-101", modules=1, lessons=1):
        root = Page.get_first_root_node()
        home = HomePage.objects.first()
        if home is None:
            home = HomePage(title="Courses", slug="lms")
            root.add_child(instance=home)
        Site.objects.update_or_create(
            is_default_site=True,
            defaults={"hostname": "localhost", "root_page": home, "site_name": "Tauditor"},
        )
        self.home = home
        self.category = CategoryPage(title="Computer", slug=f"computer-{slug}")
        home.add_child(instance=self.category)
        self.subcategory = SubCategoryPage(title="Programming", slug=f"programming-{slug}")
        self.category.add_child(instance=self.subcategory)
        self.course = CoursePage(
            title=title,
            slug=slug,
            author=author,
            summary="Intro",
            live=False,
        )
        self.subcategory.add_child(instance=self.course)
        self.modules = []
        self.lessons = []
        for m in range(1, modules + 1):
            module = ModulePage(title=f"Module {m}", slug=f"module-{m}-{slug}", live=False)
            self.course.add_child(instance=module)
            self.modules.append(module)
            for n in range(1, lessons + 1):
                lesson = LessonPage(
                    title=f"Lesson {m}.{n}",
                    slug=f"lesson-{m}-{n}-{slug}",
                    short_description=f"Body for module {m} lesson {n}.",
                    content=[("paragraph", f"<p>Body for module {m} lesson {n}.</p>")],
                    live=False,
                )
                module.add_child(instance=lesson)
                self.lessons.append(lesson)
        self.lesson = self.lessons[0]

    def publish(self):
        self.course.save_revision().publish()
        for child in self.course.get_descendants().specific():
            child.save_revision().publish()
        self.course.refresh_from_db()
        for lesson in self.lessons:
            lesson.refresh_from_db()
        return self.course


def add_teacher(user, group=None):
    if group is None:
        group, _created = TeacherGroup.objects.get_or_create(
            name="Teachers",
            defaults={"is_active": True},
        )
    return TeacherGroupMember.objects.create(teacher_group=group, member=user)
