from education.models import TeacherGroupMember


class EducationAccessService:
    """Teacher-group membership. Staff is not admin — teachers need staff for Wagtail."""

    def is_platform_admin(self, user) -> bool:
        return bool(user and user.is_authenticated and user.is_superuser)

    def is_active_teacher(self, user) -> bool:
        if not user or not user.is_authenticated:
            return False
        return TeacherGroupMember.objects.filter(
            member=user,
            is_active=True,
            teacher_group__is_active=True,
        ).exists()

    def can_open_cms(self, user) -> bool:
        if self.is_platform_admin(user) or self.is_active_teacher(user):
            return True
        return bool(user and user.is_authenticated and user.is_staff)

    def can_grade_course(self, user, course) -> bool:
        if self.is_platform_admin(user):
            return True
        return self.is_active_teacher(user) and course.author_id == user.id
