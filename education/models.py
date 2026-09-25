from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.html import strip_tags


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def plain_text(value: str, *, max_length: int) -> str:
    raw = value or ""
    if "<" in raw or ">" in raw:
        raise ValidationError("HTML is not allowed.")
    text = strip_tags(raw).replace("\x00", "").strip()
    if len(text) > max_length:
        raise ValidationError(f"Text must be at most {max_length} characters.")
    return text


class TeacherGroup(TimeStamped):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class TeacherGroupMember(TimeStamped):
    teacher_group = models.ForeignKey(
        TeacherGroup,
        on_delete=models.CASCADE,
        related_name="members",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_group_memberships",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["teacher_group", "member"],
                name="uniq_teacher_group_member",
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_active and self.teacher_group.is_active:
            from education.services.teachers import provision_teacher

            provision_teacher(self.member)

    def __str__(self):
        return str(self.member_id)


def clean_http_url(value: str, *, max_length: int = 200) -> str:
    text = plain_text(value, max_length=max_length) if value else ""
    if not text:
        return ""
    if not text.startswith(("http://", "https://")):
        raise ValidationError("Enter a valid http or https link.")
    return text


class TeacherProfile(TimeStamped):
    MAX_NAME = 120
    MAX_HEADLINE = 200
    MAX_BIO = 2000
    MAX_PROJECTS = 4000

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
    )
    display_name = models.CharField(max_length=MAX_NAME, blank=True)
    photo = models.ImageField(upload_to="teachers/", blank=True, null=True)
    headline = models.CharField(max_length=MAX_HEADLINE, blank=True)
    bio = models.TextField(blank=True)
    website = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    telegram_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    projects = models.TextField(blank=True)

    def clean(self):
        self.display_name = (
            plain_text(self.display_name, max_length=self.MAX_NAME) if self.display_name else ""
        )
        self.headline = plain_text(self.headline, max_length=self.MAX_HEADLINE) if self.headline else ""
        self.bio = plain_text(self.bio, max_length=self.MAX_BIO) if self.bio else ""
        self.website = clean_http_url(self.website)
        self.linkedin_url = clean_http_url(self.linkedin_url)
        self.telegram_url = clean_http_url(self.telegram_url)
        self.instagram_url = clean_http_url(self.instagram_url)
        self.projects = plain_text(self.projects, max_length=self.MAX_PROJECTS) if self.projects else ""


class QuizAttempt(TimeStamped):
    quiz = models.ForeignKey(
        "cms.LessonQuiz",
        on_delete=models.CASCADE,
        related_name="attempts",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
    )
    selected_option = models.CharField(max_length=1)
    is_correct = models.BooleanField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["quiz", "student"], name="uniq_quiz_attempt")
        ]


class ExamSubmission(TimeStamped):
    PASSING_SCORE = 50

    exam = models.ForeignKey(
        "cms.LessonExam",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="exam_submissions",
    )
    answer = models.TextField()
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="graded_exam_submissions",
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["exam", "student"], name="uniq_exam_submission")
        ]

    @property
    def passed(self) -> bool:
        return self.score is not None and self.score >= self.PASSING_SCORE


class LessonProgress(TimeStamped):
    lesson = models.ForeignKey(
        "cms.LessonPage",
        on_delete=models.CASCADE,
        related_name="progress_rows",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_progress",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["lesson", "student"], name="uniq_lesson_progress")
        ]


class CourseComment(TimeStamped):
    MAX_LENGTH = 2000

    course = models.ForeignKey(
        "cms.CoursePage",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    lesson = models.ForeignKey(
        "cms.LessonPage",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_comments",
    )
    body = models.TextField(max_length=MAX_LENGTH)

    class Meta:
        ordering = ["created_at", "id"]

    def clean(self):
        self.body = plain_text(self.body, max_length=self.MAX_LENGTH)
        if self.lesson_id and self.lesson.course().pk != self.course_id:
            raise ValidationError("Lesson does not belong to this course.")


class CourseLike(TimeStamped):
    course = models.ForeignKey(
        "cms.CoursePage",
        on_delete=models.CASCADE,
        related_name="likes",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_likes",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["course", "student"], name="uniq_course_like")
        ]
