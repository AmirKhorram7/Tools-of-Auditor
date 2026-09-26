from django.contrib import admin

from education.models import (
    CommentVote,
    CourseComment,
    CourseLike,
    ExamSubmission,
    LessonProgress,
    QuizAttempt,
    TeacherGroup,
    TeacherGroupMember,
    TeacherProfile,
)


class TeacherGroupMemberInline(admin.TabularInline):
    model = TeacherGroupMember
    extra = 0


@admin.register(TeacherGroup)
class TeacherGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    search_fields = ("name",)
    inlines = [TeacherGroupMemberInline]


@admin.register(TeacherGroupMember)
class TeacherGroupMemberAdmin(admin.ModelAdmin):
    list_display = ("member", "teacher_group", "is_active")
    list_filter = ("is_active", "teacher_group")
    search_fields = ("member__phone_number", "member__first_name", "member__last_name")
    autocomplete_fields = ("member", "teacher_group")


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "headline")
    search_fields = ("user__phone_number", "display_name", "headline")


admin.site.register(QuizAttempt)
admin.site.register(ExamSubmission)
admin.site.register(LessonProgress)
admin.site.register(CourseComment)
admin.site.register(CommentVote)
admin.site.register(CourseLike)
