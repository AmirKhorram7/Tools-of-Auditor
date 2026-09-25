from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from cms.models import CoursePage, LessonPage

from cms.services.courses import CourseCatalogService
from education.models import (
    CourseComment,
    CourseLike,
    ExamSubmission,
    LessonProgress,
    QuizAttempt,
    TeacherProfile,
    clean_http_url,
    plain_text,
)
from education.services.access import EducationAccessService

COMMENT_LIMIT = 10
COMMENT_WINDOW = 600
catalog = CourseCatalogService()
access = EducationAccessService()


class LearningService:
    def published_course(self, course_id: int):
        try:
            return catalog.get_published_course(course_id)
        except CoursePage.DoesNotExist:
            raise NotFound("Course is not published.")

    def published_lesson(self, lesson_id: int):
        try:
            return catalog.get_published_lesson(lesson_id)
        except LessonPage.DoesNotExist:
            raise NotFound("Lesson is not published.")

    def lesson_public(self, lesson):
        return catalog.lesson_payload(lesson)

    def course_payload(self, course):
        modules = []
        for module in catalog.modules_for(course):
            lessons = []
            for lesson in catalog.lessons_for(module):
                lessons.append(catalog.lesson_payload(lesson))
            modules.append(
                {
                    "id": module.id,
                    "title": module.title,
                    "summary": getattr(module, "summary", ""),
                    "lessons": lessons,
                }
            )
        return {
            **catalog.course_card_payload(course),
            "modules": modules,
        }

    def list_published(self):
        return [catalog.course_card_payload(course) for course in catalog.published_courses()]

    def quiz_for_student(self, lesson_id: int):
        lesson = self.published_lesson(lesson_id)
        quiz = catalog.quiz_for(lesson)
        if quiz is None:
            raise ValidationError("This lesson has no quiz.")
        return {
            "id": quiz.id,
            "prompt": quiz.prompt,
            "option_a": quiz.option_a,
            "option_b": quiz.option_b,
            "option_c": quiz.option_c,
            "option_d": quiz.option_d,
        }

    def attempt_quiz(self, user, lesson_id: int, selected_option: str):
        lesson = self.published_lesson(lesson_id)
        quiz = catalog.quiz_for(lesson)
        if quiz is None:
            raise ValidationError("This lesson has no quiz.")
        choice = (selected_option or "").strip().lower()
        if choice not in {"a", "b", "c", "d"}:
            raise ValidationError({"selected_option": "Choose a, b, c, or d."})
        is_correct = choice == quiz.correct_option
        attempt, _created = QuizAttempt.objects.update_or_create(
            quiz=quiz,
            student=user,
            defaults={"selected_option": choice, "is_correct": is_correct},
        )
        if is_correct:
            self.mark_complete(user, lesson)
        return {"is_correct": attempt.is_correct, "selected_option": attempt.selected_option}

    def submit_exam(self, user, lesson_id: int, answer: str, extra=None):
        if extra and "score" in extra:
            raise ValidationError("Students cannot set a score.")
        lesson = self.published_lesson(lesson_id)
        exam = catalog.exam_for(lesson)
        if exam is None:
            raise ValidationError("This lesson has no exam.")
        text = plain_text(answer, max_length=8000)
        submission, created = ExamSubmission.objects.get_or_create(
            exam=exam,
            student=user,
            defaults={"answer": text},
        )
        if not created:
            if submission.score is not None:
                raise ValidationError("This exam is already graded.")
            submission.answer = text
            submission.save(update_fields=["answer", "updated_at"])
        return submission, created

    def grade_exam(self, user, lesson_id: int, student_id: int, score):
        from cms.models import LessonPage

        lesson = get_object_or_404(LessonPage, pk=lesson_id)
        course = lesson.course()
        if not access.can_grade_course(user, course):
            raise PermissionDenied("Not allowed.")
        exam = catalog.exam_for(lesson)
        if exam is None:
            raise ValidationError("This lesson has no exam.")
        try:
            value = int(score)
        except (TypeError, ValueError):
            raise ValidationError({"score": "Enter a number from 0 to 100."})
        if value < 0 or value > 100:
            raise ValidationError({"score": "Enter a number from 0 to 100."})
        submission = get_object_or_404(ExamSubmission, exam=exam, student_id=student_id)
        submission.score = value
        submission.graded_by = user
        submission.graded_at = timezone.now()
        submission.save(update_fields=["score", "graded_by", "graded_at", "updated_at"])
        if submission.passed:
            self.mark_complete(submission.student, lesson)
        return submission

    def requirements_met(self, student, lesson) -> bool:
        quiz = catalog.quiz_for(lesson)
        if quiz and not QuizAttempt.objects.filter(quiz=quiz, student=student, is_correct=True).exists():
            return False
        exam = catalog.exam_for(lesson)
        if exam:
            row = exam.submissions.filter(student=student).first()
            if not row or not row.passed:
                return False
        return True

    def mark_complete(self, student, lesson):
        if not self.requirements_met(student, lesson):
            return None
        progress, _created = LessonProgress.objects.get_or_create(lesson=lesson, student=student)
        if progress.completed_at is None:
            progress.completed_at = timezone.now()
            progress.save(update_fields=["completed_at", "updated_at"])
        return progress

    def complete_lesson(self, user, lesson_id: int):
        lesson = self.published_lesson(lesson_id)
        progress = self.mark_complete(user, lesson)
        if progress is None:
            raise ValidationError("Pass the lesson quiz or exam before marking it complete.")
        return {"lesson": lesson.id, "completed_at": progress.completed_at}

    def list_comments(self, course_id: int, lesson_id=None):
        course = self.published_course(course_id)
        qs = course.comments.select_related("author")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        else:
            qs = qs.filter(lesson__isnull=True)
        return qs

    def add_comment(self, user, course_id: int, body: str, lesson_id=None):
        course = self.published_course(course_id)
        key = f"edu-comment:{user.id}"
        count = cache.get(key, 0)
        if count >= COMMENT_LIMIT:
            raise ValidationError("Too many comments. Try again later.")
        lesson = None
        if lesson_id:
            lesson = self.published_lesson(lesson_id)
        try:
            comment = CourseComment(
                course=course,
                lesson=lesson,
                author=user,
                body=plain_text(body, max_length=CourseComment.MAX_LENGTH),
            )
            comment.full_clean()
            comment.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        cache.set(key, count + 1, COMMENT_WINDOW)
        return comment

    def like_course(self, user, course_id: int):
        course = self.published_course(course_id)
        like, created = CourseLike.objects.get_or_create(course=course, student=user)
        return like, created

    def unlike_course(self, user, course_id: int):
        course = self.published_course(course_id)
        CourseLike.objects.filter(course=course, student=user).delete()

    def own_teacher_profile(self, user):
        if not (access.is_active_teacher(user) or access.is_platform_admin(user)):
            raise PermissionDenied("Not allowed.")
        profile, _created = TeacherProfile.objects.get_or_create(user=user)
        from education.services.teachers import teacher_profile_payload

        return teacher_profile_payload(user, profile)

    @transaction.atomic
    def save_teacher_profile(self, user, data):
        if not (access.is_active_teacher(user) or access.is_platform_admin(user)):
            raise PermissionDenied("Not allowed.")
        profile, _created = TeacherProfile.objects.get_or_create(user=user)
        from education.services.teachers import teacher_profile_payload

        try:
            profile.display_name = plain_text(
                data.get("display_name") or "",
                max_length=TeacherProfile.MAX_NAME,
            ) if data.get("display_name") else ""
            profile.headline = plain_text(
                data.get("headline") or "",
                max_length=TeacherProfile.MAX_HEADLINE,
            ) if data.get("headline") else ""
            profile.bio = plain_text(data.get("bio") or "", max_length=TeacherProfile.MAX_BIO) if data.get("bio") else ""
            profile.website = clean_http_url(data.get("website") or "")
            profile.linkedin_url = clean_http_url(data.get("linkedin_url") or "")
            profile.telegram_url = clean_http_url(data.get("telegram_url") or "")
            profile.instagram_url = clean_http_url(data.get("instagram_url") or "")
            projects = data.get("projects_text")
            if projects is None:
                projects = data.get("projects") or ""
            if isinstance(projects, list):
                projects = "\n".join(str(item) for item in projects)
            profile.projects = (
                plain_text(projects, max_length=TeacherProfile.MAX_PROJECTS) if projects else ""
            )
            photo = data.get("photo")
            if photo and hasattr(photo, "read"):
                profile.photo = photo
            profile.full_clean()
            profile.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return teacher_profile_payload(user, profile)

    def teacher_page(self, user_id: int):
        from django.contrib.auth import get_user_model
        from education.services.teachers import teacher_profile_payload

        user = get_object_or_404(get_user_model(), pk=user_id)
        profile, _created = TeacherProfile.objects.get_or_create(user=user)
        payload = teacher_profile_payload(user, profile)
        payload["courses"] = [
            catalog.course_card_payload(course) for course in catalog.courses_by_author(user_id)
        ]
        return payload
