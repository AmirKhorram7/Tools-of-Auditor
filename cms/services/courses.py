from cms.models import CoursePage, LessonExam, LessonPage, LessonQuiz


class CourseCatalogService:
    """Published course tree. Draft pages never appear here."""

    def published_courses(self):
        return (
            CoursePage.objects.live()
            .public()
            .specific()
            .select_related("author", "author__teacher_profile", "author__profile", "thumbnail")
            .order_by("-last_published_at", "-id")
        )

    def get_published_course(self, course_id: int) -> CoursePage:
        return self.published_courses().get(pk=course_id)

    def published_lessons(self):
        return (
            LessonPage.objects.live()
            .public()
            .specific()
            .select_related("video", "featured_image", "document_file")
        )

    def get_published_lesson(self, lesson_id: int) -> LessonPage:
        return self.published_lessons().get(pk=lesson_id)

    def modules_for(self, course: CoursePage):
        return course.get_children().live().public().specific().order_by("path")

    def lessons_for(self, module):
        return module.get_children().live().public().specific().order_by("path")

    def quiz_for(self, lesson: LessonPage) -> LessonQuiz | None:
        return lesson.quiz.first()

    def exam_for(self, lesson: LessonPage) -> LessonExam | None:
        return lesson.exam.first()

    def lesson_payload(self, lesson: LessonPage, *, with_flags: bool = True) -> dict:
        row = {
            "id": lesson.id,
            "title": lesson.title,
            "short_description": lesson.short_description,
            "body": lesson.body_html(),
            "video_url": lesson.video_url,
            "video_file_url": lesson.video_file_url(),
            "featured_image_url": lesson.featured_image_url(),
            "document_url": lesson.document_url(),
            "document_title": lesson.document_title(),
            "content": lesson.stream_payload(),
        }
        if with_flags:
            row["has_quiz"] = self.quiz_for(lesson) is not None
            row["has_exam"] = self.exam_for(lesson) is not None
        return row

    def course_card_payload(self, course: CoursePage) -> dict:
        from education.services.teachers import teacher_card_payload

        return {
            "id": course.id,
            "title": course.title,
            "slug": course.slug,
            "summary": course.summary,
            "author_id": course.author_id,
            "like_count": course.likes.count(),
            "thumbnail_url": course.thumbnail_url(),
            "level": course.level or CoursePage.Level.BASIC,
            "teacher": teacher_card_payload(course.author),
        }

    def courses_by_author(self, user_id: int):
        return self.published_courses().filter(author_id=user_id)
