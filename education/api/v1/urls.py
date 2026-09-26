from django.urls import path

from education.api.v1.views import (
    CommentListCreateView,
    CommentVoteView,
    CourseLikeView,
    ExamGradeView,
    ExamSubmitView,
    LessonCompleteView,
    PublishedCourseDetailView,
    PublishedCourseListView,
    PublishedLessonView,
    QuizAttemptView,
    QuizView,
    TeacherMeView,
    TeacherProfileView,
    TeacherPublicView,
)

urlpatterns = [
    path("courses/", PublishedCourseListView.as_view(), name="education-courses"),
    path("courses/<int:course_id>/", PublishedCourseDetailView.as_view(), name="education-course-detail"),
    path("courses/<int:course_id>/comments/", CommentListCreateView.as_view(), name="education-comments"),
    path("comments/<int:comment_id>/vote/", CommentVoteView.as_view(), name="education-comment-vote"),
    path("courses/<int:course_id>/like/", CourseLikeView.as_view(), name="education-like"),
    path("lessons/<int:lesson_id>/", PublishedLessonView.as_view(), name="education-lesson"),
    path("lessons/<int:lesson_id>/complete/", LessonCompleteView.as_view(), name="education-lesson-complete"),
    path("lessons/<int:lesson_id>/quiz/", QuizView.as_view(), name="education-quiz"),
    path("lessons/<int:lesson_id>/quiz/attempt/", QuizAttemptView.as_view(), name="education-quiz-attempt"),
    path("lessons/<int:lesson_id>/exam/submit/", ExamSubmitView.as_view(), name="education-exam-submit"),
    path(
        "lessons/<int:lesson_id>/exam/grade/<int:student_id>/",
        ExamGradeView.as_view(),
        name="education-exam-grade",
    ),
    path("teachers/<int:user_id>/", TeacherPublicView.as_view(), name="education-teacher"),
    path("teacher-profile/", TeacherProfileView.as_view(), name="education-teacher-profile"),
    path("me/", TeacherMeView.as_view(), name="education-me"),
]
