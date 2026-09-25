from cms.models import CoursePage, LessonExam, LessonPage, LessonQuiz


class CourseCatalogService:
    """Published course tree. Draft pages never appear here."""

    def published_courses(self):
        return (
            CoursePage.objects.live()
            .public()
            .specific()
            .select_related("author")
            .order_by("-last_published_at", "-id")
        )

    def get_published_course(self, course_id: int) -> CoursePage:
        return self.published_courses().get(pk=course_id)

    def published_lessons(self):
        return LessonPage.objects.live().public().specific()

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

    def courses_by_author(self, user_id: int):
        return self.published_courses().filter(author_id=user_id)
