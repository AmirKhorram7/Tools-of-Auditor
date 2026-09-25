from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.shortcuts import get_object_or_404

from cms.models import CoursePage, LessonExam, LessonPage, LessonQuiz
from cms.services.access import CmsAccessService
from education.models import CourseComment, CourseLike, ExamSubmission, LessonProgress, QuizAttempt

User = get_user_model()
access = CmsAccessService()


def _user_label(user) -> str:
    name = (user.get_full_name() or "").strip()
    if name:
        return f"{name} ({user.phone_number})"
    return user.phone_number


class TeacherReportService:
    """Course numbers a teacher (or admin) can see in Wagtail Reports."""

    def courses_visible_to(self, user):
        qs = CoursePage.objects.all().select_related("author").order_by("title")
        if access.is_admin(user):
            return qs
        if access.is_teacher(user):
            return qs.filter(author=user)
        return qs.none()

    def get_visible_course(self, user, course_id: int) -> CoursePage:
        return get_object_or_404(self.courses_visible_to(user), pk=course_id)

    def lesson_ids_for(self, course: CoursePage) -> list[int]:
        return list(course.get_descendants().type(LessonPage).values_list("id", flat=True))

    def student_ids_for(self, course: CoursePage) -> set[int]:
        lesson_ids = self.lesson_ids_for(course)
        ids: set[int] = set()
        if lesson_ids:
            ids.update(
                LessonProgress.objects.filter(lesson_id__in=lesson_ids).values_list("student_id", flat=True)
            )
            quiz_ids = LessonQuiz.objects.filter(page_id__in=lesson_ids).values_list("id", flat=True)
            ids.update(QuizAttempt.objects.filter(quiz_id__in=quiz_ids).values_list("student_id", flat=True))
            exam_ids = LessonExam.objects.filter(page_id__in=lesson_ids).values_list("id", flat=True)
            ids.update(ExamSubmission.objects.filter(exam_id__in=exam_ids).values_list("student_id", flat=True))
        ids.update(CourseLike.objects.filter(course=course).values_list("student_id", flat=True))
        ids.update(CourseComment.objects.filter(course=course).values_list("author_id", flat=True))
        return ids

    def list_rows(self, user) -> list[dict]:
        courses = list(self.courses_visible_to(user))
        rows = []
        for course in courses:
            parent = course.get_parent()
            rows.append(
                {
                    "course": course,
                    "folder": parent.title if parent else "",
                    "student_count": len(self.student_ids_for(course)),
                    "comment_count": course.comments.count(),
                    "like_count": course.likes.count(),
                    "live": course.live,
                }
            )
        return rows

    def course_detail(self, user, course_id: int) -> dict:
        course = self.get_visible_course(user, course_id)
        lesson_ids = self.lesson_ids_for(course)
        lesson_total = len(lesson_ids)
        student_ids = self.student_ids_for(course)
        students = {row.id: row for row in User.objects.filter(pk__in=student_ids)}

        completed = defaultdict(int)
        if lesson_ids:
            for student_id in (
                LessonProgress.objects.filter(
                    lesson_id__in=lesson_ids,
                    completed_at__isnull=False,
                )
                .values_list("student_id", flat=True)
            ):
                completed[student_id] += 1

        comment_count = defaultdict(int)
        for row in CourseComment.objects.filter(course=course).values("author_id").annotate(n=Count("id")):
            comment_count[row["author_id"]] = row["n"]
        comments = list(
            CourseComment.objects.filter(course=course)
            .select_related("author", "lesson")
            .order_by("-created_at", "-id")[:50]
        )

        liked_ids = set(CourseLike.objects.filter(course=course).values_list("student_id", flat=True))

        student_rows = []
        for student_id in sorted(student_ids):
            student = students.get(student_id)
            if student is None:
                continue
            student_rows.append(
                {
                    "user": student,
                    "label": _user_label(student),
                    "completed_lessons": completed[student_id],
                    "lesson_total": lesson_total,
                    "comment_count": comment_count[student_id],
                    "liked": student_id in liked_ids,
                }
            )
        student_rows.sort(key=lambda row: row["label"])

        parent = course.get_parent()
        return {
            "course": course,
            "folder": parent.title if parent else "",
            "live": course.live,
            "student_count": len(student_ids),
            "comment_count": course.comments.count(),
            "like_count": course.likes.count(),
            "lesson_total": lesson_total,
            "students": student_rows,
            "comments": comments,
        }
