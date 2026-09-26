import time

from django.core.cache import cache
from django.test import Client, override_settings
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from cms.models import CategoryPage, CoursePage, ModulePage, SubCategoryPage
from cms.services import access_service, catalog_service
from cms.services.reports import TeacherReportService
from education.models import CourseComment, CourseLike, ExamSubmission, LessonProgress
from education.testing import CourseTree, add_teacher, client_for, make_admin, make_user

API = "/api/v1/education"
CMS_API = "/api/v2/cms"


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "edu-tests"}},
)
class EducationBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = make_user("09127770001")
        self.other_teacher = make_user("09127770002")
        self.student = make_user("09127770003")
        self.outsider = make_user("09127770005")
        self.staff = make_user("09127770006", is_staff=True)
        self.admin = make_admin("09127770004")
        self.group = add_teacher(self.teacher).teacher_group
        add_teacher(self.other_teacher, self.group)
        self.teacher_c = client_for(self.teacher)
        self.other_teacher_c = client_for(self.other_teacher)
        self.student_c = client_for(self.student)
        self.outsider_c = client_for(self.outsider)
        self.staff_c = client_for(self.staff)
        self.admin_c = client_for(self.admin)
        self.tree = CourseTree(self.teacher, modules=1, lessons=1)
        self.course = self.tree.course
        self.lesson = self.tree.lesson


class EducationProcessSmokeTests(EducationBase):
    """Full student path after a teacher writes and an admin publishes."""

    def test_draft_stays_off_catalog_until_admin_publishes(self):
        listed = self.client.get(f"{API}/courses/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data, [])
        self.assertEqual(self.client.get(f"{API}/courses/{self.course.id}/").status_code, 404)
        self.assertEqual(self.client.get(f"{API}/lessons/{self.lesson.id}/").status_code, 404)
        self.tree.publish()
        listed = self.client.get(f"{API}/courses/")
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["title"], "Python 101")
        self.assertIn("thumbnail_url", listed.data[0])
        self.assertEqual(listed.data[0]["level"], "basic")
        self.assertEqual(listed.data[0]["category_title"], "Computer")
        self.assertEqual(listed.data[0]["subcategory_title"], "Programming")
        self.assertEqual(listed.data[0]["chapter_count"], 1)
        self.assertEqual(listed.data[0]["lesson_count"], 1)
        detail = self.client.get(f"{API}/courses/{self.course.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data["modules"]), 1)
        self.assertEqual(len(detail.data["modules"][0]["lessons"]), 1)
        lesson = self.client.get(f"{API}/lessons/{self.lesson.id}/")
        self.assertEqual(lesson.status_code, 200)
        self.assertIn("Lesson 1.1", lesson.data["title"])
        self.assertTrue(lesson.data["content"])
        self.assertEqual(lesson.data["content"][0]["type"], "paragraph")
        self.assertIn("Body for module", lesson.data["body"])
        self.assertIn("video_file_url", lesson.data)
        self.assertEqual(lesson.data["video_file_url"], "")

    def test_five_by_five_course_is_listed_with_all_lessons(self):
        big = CourseTree(self.teacher, title="Python Track", slug="python-track", modules=5, lessons=5)
        started = time.monotonic()
        big.publish()
        listed = self.client.get(f"{API}/courses/")
        detail = self.client.get(f"{API}/courses/{big.course.id}/")
        elapsed = time.monotonic() - started
        self.assertEqual(listed.status_code, 200)
        titles = {row["title"] for row in listed.data}
        self.assertIn("Python Track", titles)
        self.assertEqual(len(detail.data["modules"]), 5)
        lesson_count = sum(len(module["lessons"]) for module in detail.data["modules"])
        self.assertEqual(lesson_count, 25)
        self.assertEqual(catalog_service.published_courses().count(), 1)
        self.assertLess(elapsed, 8, f"publish + catalog took {elapsed:.2f}s")

    def test_student_completes_plain_lesson_then_likes_and_asks(self):
        self.tree.publish()
        done = self.student_c.post(f"{API}/lessons/{self.lesson.id}/complete/", {}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        self.assertTrue(
            LessonProgress.objects.filter(
                lesson=self.lesson, student=self.student, completed_at__isnull=False
            ).exists()
        )
        like = self.student_c.post(f"{API}/courses/{self.course.id}/like/", {}, format="json")
        self.assertEqual(like.status_code, 201)
        again = self.student_c.post(f"{API}/courses/{self.course.id}/like/", {}, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(CourseLike.objects.filter(course=self.course).count(), 1)
        comment = self.student_c.post(
            f"{API}/courses/{self.course.id}/comments/",
            {"body": "How do I start?"},
            format="json",
        )
        self.assertEqual(comment.status_code, 201, comment.data)
        notes = self.client.get(f"{API}/courses/{self.course.id}/comments/")
        self.assertEqual(len(notes.data), 1)
        reply = self.teacher_c.post(
            f"{API}/courses/{self.course.id}/comments/",
            {"body": "Start with chapter one.", "parent": comment.data["id"]},
            format="json",
        )
        self.assertEqual(reply.status_code, 201, reply.data)
        vote = self.student_c.post(f"{API}/comments/{comment.data['id']}/vote/", {"value": 1}, format="json")
        self.assertEqual(vote.status_code, 200, vote.data)
        self.assertEqual(vote.data["like_count"], 1)
        self.assertEqual(vote.data["my_vote"], 1)

    def test_quiz_then_exam_then_teacher_page(self):
        from cms.models import LessonExam, LessonQuiz

        LessonQuiz.objects.create(
            page=self.lesson,
            prompt="2 + 2",
            option_a="3",
            option_b="4",
            option_c="5",
            option_d="6",
            correct_option="b",
        )
        self.tree.publish()
        quiz = self.student_c.get(f"{API}/lessons/{self.lesson.id}/quiz/")
        self.assertEqual(quiz.status_code, 200)
        self.assertNotIn("correct_option", quiz.data)
        self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/quiz/attempt/",
            {"selected_option": "b"},
            format="json",
        )
        self.assertTrue(
            LessonProgress.objects.filter(lesson=self.lesson, student=self.student).exists()
        )
        LessonQuiz.objects.filter(page=self.lesson).delete()
        other = CourseTree(self.teacher, title="Exam course", slug="exam-course")
        LessonExam.objects.create(page=other.lesson, prompt="Explain a class.")
        other.publish()
        sent = self.student_c.post(
            f"{API}/lessons/{other.lesson.id}/exam/submit/",
            {"answer": "A class is a template."},
            format="json",
        )
        self.assertEqual(sent.status_code, 201, sent.data)
        graded = self.teacher_c.post(
            f"{API}/lessons/{other.lesson.id}/exam/grade/{self.student.id}/",
            {"score": 80},
            format="json",
        )
        self.assertEqual(graded.status_code, 200)
        self.assertEqual(ExamSubmission.objects.get(student=self.student).score, 80)
        saved = self.teacher_c.put(
            f"{API}/teacher-profile/",
            {
                "display_name": "Sara Teacher",
                "headline": "Python mentor",
                "bio": "Python teacher",
                "website": "https://example.com",
                "projects": "Bank audit\nTax workshop",
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["name"], "Sara Teacher")
        self.assertEqual(saved.data["projects"], ["Bank audit", "Tax workshop"])
        page = self.client.get(f"{API}/teachers/{self.teacher.id}/")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.data["headline"], "Python mentor")
        self.assertGreaterEqual(len(page.data["courses"]), 1)
        self.assertIn("course_count", page.data)
        self.assertIn("student_count", page.data)
        self.assertIn("like_count", page.data)
        course = self.client.get(f"{API}/courses/{other.course.id}/")
        self.assertEqual(course.data["teacher"]["name"], "Sara Teacher")
        self.assertEqual(course.data["teacher"]["headline"], "Python mentor")


class EducationPermissionTests(EducationBase):
    def test_only_admin_can_publish_and_teacher_cannot_edit_foreign_course(self):
        self.assertTrue(access_service.can_edit_page(self.teacher, self.course))
        self.assertFalse(access_service.can_edit_page(self.other_teacher, self.course))
        self.assertFalse(access_service.can_edit_page(self.student, self.course))
        self.assertFalse(access_service.can_edit_page(self.staff, self.course))
        self.assertTrue(access_service.can_edit_page(self.admin, self.course))
        self.assertFalse(access_service.can_publish_page(self.teacher, self.course))
        self.assertFalse(access_service.can_publish_page(self.other_teacher, self.course))
        self.assertTrue(access_service.can_publish_page(self.admin, self.course))
        with self.assertRaises(PermissionDenied):
            access_service.require_publish(self.teacher, self.course)
        with self.assertRaises(PermissionDenied):
            access_service.require_edit(self.other_teacher, self.course)

    def test_only_admin_creates_category_teacher_creates_course_under_it(self):
        home = self.tree.home
        category = self.tree.category
        sub = self.tree.subcategory
        self.assertTrue(access_service.can_create_page(self.admin, home, CategoryPage))
        self.assertTrue(access_service.can_create_page(self.admin, category, SubCategoryPage))
        self.assertFalse(access_service.can_create_page(self.teacher, home, CategoryPage))
        self.assertFalse(access_service.can_create_page(self.teacher, category, SubCategoryPage))
        self.assertFalse(access_service.can_create_page(self.staff, home, CategoryPage))
        self.assertFalse(access_service.can_create_page(self.student, category, CoursePage))
        self.assertTrue(access_service.can_create_page(self.teacher, category, CoursePage))
        self.assertTrue(access_service.can_create_page(self.teacher, sub, CoursePage))
        self.assertFalse(access_service.can_create_page(self.teacher, home, CoursePage))
        self.assertFalse(access_service.can_edit_page(self.teacher, home))
        self.assertFalse(access_service.can_edit_page(self.teacher, category))
        self.assertFalse(access_service.can_edit_page(self.teacher, sub))
        self.assertTrue(access_service.can_edit_page(self.admin, category))
        self.assertTrue(access_service.can_create_page(self.teacher, self.course, ModulePage))
        self.assertFalse(access_service.can_create_page(self.other_teacher, self.course, ModulePage))
        with self.assertRaises(PermissionDenied):
            access_service.require_create(self.teacher, home, CategoryPage)
        with self.assertRaises(PermissionDenied):
            access_service.require_edit(self.teacher, category)

    def test_teachers_group_can_upload_lesson_video(self):
        from django.contrib.auth.models import Group

        access_service.grant_teachers_admin_access()
        codes = set(Group.objects.get(name="Teachers").permissions.values_list("codename", flat=True))
        self.assertIn("add_media", codes)
        self.assertIn("change_media", codes)

    def test_inactive_teacher_cannot_grade_and_student_cannot_open_cms(self):
        membership = self.teacher.teacher_group_memberships.get()
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        self.assertFalse(access_service.can_open_cms(self.student))
        self.assertTrue(access_service.can_open_cms(self.staff))
        self.assertTrue(access_service.can_open_cms(self.admin))
        self.tree.publish()
        from cms.models import LessonExam

        LessonExam.objects.create(page=self.lesson, prompt="Write.")
        self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/submit/",
            {"answer": "ok"},
            format="json",
        )
        denied = self.teacher_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/grade/{self.student.id}/",
            {"score": 70},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)
        staff_grade = self.staff_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/grade/{self.student.id}/",
            {"score": 70},
            format="json",
        )
        self.assertEqual(staff_grade.status_code, 403)

    def test_other_teacher_cannot_grade_or_set_bio_for_this_course(self):
        from cms.models import LessonExam

        LessonExam.objects.create(page=self.lesson, prompt="Write.")
        self.tree.publish()
        self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/submit/",
            {"answer": "ok"},
            format="json",
        )
        stolen = self.other_teacher_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/grade/{self.student.id}/",
            {"score": 100},
            format="json",
        )
        self.assertEqual(stolen.status_code, 403)
        student_bio = self.student_c.put(
            f"{API}/teacher-profile/",
            {"bio": "I am a teacher"},
            format="json",
        )
        self.assertEqual(student_bio.status_code, 403)

    def test_teacher_me_shows_builder_and_student_does_not(self):
        teacher = self.teacher_c.get(f"{API}/me/")
        self.assertEqual(teacher.status_code, 200)
        self.assertTrue(teacher.data["can_build_course"])
        self.assertEqual(teacher.data["cms_url"], "/cms/")
        student = self.student_c.get(f"{API}/me/")
        self.assertEqual(student.status_code, 200)
        self.assertFalse(student.data["can_build_course"])
        staff = self.staff_c.get(f"{API}/me/")
        self.assertTrue(staff.data["can_build_course"])

    def test_new_teacher_gets_default_password_for_wagtail(self):
        from education.services.teachers import default_teacher_password, provision_teacher

        fresh = make_user("09127770077")
        fresh.set_unusable_password()
        fresh.save(update_fields=["password"])
        self.assertFalse(fresh.has_login_password())
        result = provision_teacher(fresh)
        fresh.refresh_from_db()
        self.assertTrue(fresh.is_staff)
        self.assertTrue(fresh.has_login_password())
        self.assertTrue(fresh.check_password(default_teacher_password()))
        self.assertTrue(result["used_default_password"])

    def test_anonymous_writes_are_rejected(self):
        self.tree.publish()
        self.assertEqual(
            self.client.post(f"{API}/courses/{self.course.id}/like/", {}, format="json").status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                f"{API}/courses/{self.course.id}/comments/",
                {"body": "hi"},
                format="json",
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(f"{API}/lessons/{self.lesson.id}/complete/", {}, format="json").status_code,
            401,
        )


class EducationSecurityAttackTests(EducationBase):
    """Fake attacks: XSS, score tamper, IDOR, leak, flood."""

    def test_xss_and_markup_are_rejected_on_comments_and_bio(self):
        self.tree.publish()
        for payload in (
            "<script>alert(1)</script>",
            "<img src=x onerror=alert(1)>",
            "hello <b>bold</b>",
            "javascript:alert(1)",
        ):
            if "<" not in payload:
                continue
            res = self.student_c.post(
                f"{API}/courses/{self.course.id}/comments/",
                {"body": payload},
                format="json",
            )
            self.assertEqual(res.status_code, 400, payload)
        js = self.student_c.post(
            f"{API}/courses/{self.course.id}/comments/",
            {"body": "javascript:alert(1)"},
            format="json",
        )
        self.assertEqual(js.status_code, 201)
        self.assertEqual(js.data["body"], "javascript:alert(1)")
        bio = self.teacher_c.put(
            f"{API}/teacher-profile/",
            {"bio": "<svg onload=alert(1)>"},
            format="json",
        )
        self.assertEqual(bio.status_code, 400)
        bad_link = self.teacher_c.put(
            f"{API}/teacher-profile/",
            {"website": "javascript:alert(1)"},
            format="json",
        )
        self.assertEqual(bad_link.status_code, 400)

    def test_student_cannot_set_own_score_or_complete_locked_exam(self):
        from cms.models import LessonExam

        LessonExam.objects.create(page=self.lesson, prompt="Write.")
        self.tree.publish()
        cheated = self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/submit/",
            {"answer": "ok", "score": 100},
            format="json",
        )
        self.assertEqual(cheated.status_code, 400)
        sent = self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/submit/",
            {"answer": "ok"},
            format="json",
        )
        self.assertIsNone(sent.data["score"])
        skip = self.student_c.post(f"{API}/lessons/{self.lesson.id}/complete/", {}, format="json")
        self.assertEqual(skip.status_code, 400)
        self.assertFalse(
            LessonProgress.objects.filter(student=self.student, completed_at__isnull=False).exists()
        )

    def test_quiz_does_not_leak_answer_and_rejects_junk_choice(self):
        from cms.models import LessonQuiz

        LessonQuiz.objects.create(
            page=self.lesson,
            prompt="Capital",
            option_a="A",
            option_b="B",
            option_c="C",
            option_d="D",
            correct_option="c",
        )
        self.tree.publish()
        shown = self.outsider_c.get(f"{API}/lessons/{self.lesson.id}/quiz/")
        self.assertNotIn("correct_option", shown.data)
        self.assertNotIn("correct", str(shown.data).lower())
        junk = self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/quiz/attempt/",
            {"selected_option": "e"},
            format="json",
        )
        self.assertEqual(junk.status_code, 400)
        sql = self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/quiz/attempt/",
            {"selected_option": "b OR 1=1"},
            format="json",
        )
        self.assertEqual(sql.status_code, 400)

    def test_idor_guessed_ids_and_invalid_grades(self):
        self.tree.publish()
        missing = self.student_c.get(f"{API}/courses/999999/")
        self.assertEqual(missing.status_code, 404)
        ghost = self.student_c.post(f"{API}/lessons/999999/complete/", {}, format="json")
        self.assertEqual(ghost.status_code, 404)
        from cms.models import LessonExam

        LessonExam.objects.create(page=self.lesson, prompt="Write.")
        self.student_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/submit/",
            {"answer": "ok"},
            format="json",
        )
        for score in (-1, 101, "NaN", None):
            res = self.teacher_c.post(
                f"{API}/lessons/{self.lesson.id}/exam/grade/{self.student.id}/",
                {"score": score},
                format="json",
            )
            self.assertEqual(res.status_code, 400, score)
        other_student = self.teacher_c.post(
            f"{API}/lessons/{self.lesson.id}/exam/grade/{self.outsider.id}/",
            {"score": 90},
            format="json",
        )
        self.assertEqual(other_student.status_code, 404)

    def test_comment_flood_is_rate_limited(self):
        self.tree.publish()
        codes = []
        for i in range(12):
            res = self.student_c.post(
                f"{API}/courses/{self.course.id}/comments/",
                {"body": f"question {i}"},
                format="json",
            )
            codes.append(res.status_code)
        self.assertIn(201, codes)
        self.assertIn(400, codes)
        self.assertGreaterEqual(codes.count(400), 1)

    def test_wagtail_pages_api_hides_draft_course(self):
        anonymous = self.client.get(f"{CMS_API}/pages/?type=cms.CoursePage")
        self.assertIn(anonymous.status_code, {200, 401})
        hidden = self.student_c.get(f"{CMS_API}/pages/?type=cms.CoursePage")
        self.assertIn(hidden.status_code, {200, 401})
        if hidden.status_code == 200:
            items = hidden.data.get("items", hidden.data)
            if isinstance(items, dict):
                items = items.get("items", [])
            titles = [row.get("title") for row in items] if isinstance(items, list) else []
            self.assertNotIn("Python 101", titles)
        self.tree.publish()
        live = self.student_c.get(f"{CMS_API}/pages/?type=cms.CoursePage")
        if live.status_code == 200:
            payload = str(live.data)
            self.assertIn("Python 101", payload)


class CmsTeacherReportTests(EducationBase):
    def setUp(self):
        super().setUp()
        self.reports = TeacherReportService()
        CourseLike.objects.create(course=self.course, student=self.student)
        CourseComment.objects.create(course=self.course, author=self.student, body="How do I start?")
        LessonProgress.objects.create(lesson=self.lesson, student=self.student)

    def test_teacher_sees_only_own_course_counts(self):
        rows = self.reports.list_rows(self.teacher)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["course"].id, self.course.id)
        self.assertEqual(rows[0]["student_count"], 1)
        self.assertEqual(rows[0]["comment_count"], 1)
        self.assertEqual(rows[0]["like_count"], 1)
        self.assertEqual(self.reports.list_rows(self.other_teacher), [])
        admin_titles = {row["course"].title for row in self.reports.list_rows(self.admin)}
        self.assertIn("Python 101", admin_titles)

    def test_other_teacher_cannot_open_course_detail(self):
        detail = self.reports.course_detail(self.teacher, self.course.id)
        self.assertEqual(detail["student_count"], 1)
        self.assertEqual(detail["students"][0]["user"].id, self.student.id)
        self.assertTrue(detail["students"][0]["liked"])
        from django.http import Http404

        with self.assertRaises(Http404):
            self.reports.course_detail(self.other_teacher, self.course.id)

    def test_wagtail_report_pages_hide_foreign_course(self):
        teacher = Client()
        teacher.force_login(self.teacher)
        listed = teacher.get("/cms/reports/courses/")
        self.assertEqual(listed.status_code, 200)
        self.assertContains(listed, "Python 101")
        self.assertContains(listed, str(self.course.id))
        detail = teacher.get(f"/cms/reports/courses/{self.course.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, self.student.phone_number)
        other = Client()
        other.force_login(self.other_teacher)
        hidden = other.get("/cms/reports/courses/")
        self.assertEqual(hidden.status_code, 200)
        self.assertNotContains(hidden, "Python 101")
        stolen = other.get(f"/cms/reports/courses/{self.course.id}/")
        self.assertEqual(stolen.status_code, 404)


class CmsAccessTests(EducationBase):
    def test_teacher_membership_sets_staff_for_wagtail(self):
        self.teacher.refresh_from_db()
        self.assertTrue(self.teacher.is_staff)
        self.assertTrue(access_service.is_teacher(self.teacher))
        self.assertFalse(access_service.is_admin(self.teacher))

    def test_catalog_ignores_unpublished_children(self):
        self.course.save_revision().publish()
        self.course.refresh_from_db()
        listed = catalog_service.published_courses()
        self.assertEqual(listed.count(), 1)
        modules = list(catalog_service.modules_for(self.course))
        self.assertEqual(modules, [])
        self.tree.publish()
        modules = list(catalog_service.modules_for(self.course))
        self.assertEqual(len(modules), 1)
        self.assertEqual(len(list(catalog_service.lessons_for(modules[0]))), 1)
