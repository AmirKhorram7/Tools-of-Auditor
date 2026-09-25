from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from education.api.v1.serializers import (
    CommentSerializer,
    ExamSubmissionSerializer,
    TeacherProfileSerializer,
)
from education.services import learning_service
from education.services.access import EducationAccessService
from education.services.teachers import can_build_course, default_teacher_password


class PublishedCourseListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(learning_service.list_published())


class PublishedCourseDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, course_id):
        course = learning_service.published_course(course_id)
        return Response(learning_service.course_payload(course))


class PublishedLessonView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lesson_id):
        lesson = learning_service.published_lesson(lesson_id)
        return Response(
            {
                "id": lesson.id,
                "title": lesson.title,
                "body": lesson.body,
                "video_url": lesson.video_url,
            }
        )


class QuizView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lesson_id):
        return Response(learning_service.quiz_for_student(lesson_id))


class QuizAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        return Response(
            learning_service.attempt_quiz(
                request.user,
                lesson_id,
                request.data.get("selected_option"),
            )
        )


class ExamSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        submission, created = learning_service.submit_exam(
            request.user,
            lesson_id,
            request.data.get("answer") or "",
            extra=request.data,
        )
        return Response(
            ExamSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ExamGradeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id, student_id):
        submission = learning_service.grade_exam(
            request.user,
            lesson_id,
            student_id,
            request.data.get("score"),
        )
        return Response(ExamSubmissionSerializer(submission).data)


class LessonCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        return Response(learning_service.complete_lesson(request.user, lesson_id))


class CommentListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, course_id):
        rows = learning_service.list_comments(course_id, request.query_params.get("lesson"))
        return Response(CommentSerializer(rows, many=True).data)

    def post(self, request, course_id):
        comment = learning_service.add_comment(
            request.user,
            course_id,
            request.data.get("body") or "",
            request.data.get("lesson"),
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class CourseLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, course_id):
        like, created = learning_service.like_course(request.user, course_id)
        return Response(
            {"liked": True, "like_id": like.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, course_id):
        learning_service.unlike_course(request.user, course_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeacherProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        profile = learning_service.save_teacher_profile(request.user, request.data.get("bio") or "")
        return Response(TeacherProfileSerializer(profile).data)


class TeacherPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        return Response(learning_service.teacher_page(user_id))


class TeacherMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        access = EducationAccessService()
        builder = can_build_course(request.user)
        default_pw = default_teacher_password()
        uses_default = builder and request.user.check_password(default_pw)
        return Response(
            {
                "user_id": request.user.id,
                "is_teacher": access.is_active_teacher(request.user),
                "is_admin": access.is_platform_admin(request.user),
                "can_build_course": builder,
                "cms_url": "/cms/",
                "login": request.user.phone_number,
                "default_password": default_pw if uses_default else None,
            }
        )
