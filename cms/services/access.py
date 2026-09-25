from django.contrib.auth.models import Group, Permission
from rest_framework.exceptions import PermissionDenied
from wagtail.models import GroupPagePermission

from cms.models import CategoryPage, CoursePage, HomePage, LessonPage, ModulePage, SubCategoryPage

TEACHERS_GROUP = "Teachers"
STRUCTURE_TYPES = (HomePage, CategoryPage, SubCategoryPage)


def _education_access():
    from education.services.access import EducationAccessService

    return EducationAccessService()


def _wagtail_perm(codename):
    return Permission.objects.filter(
        content_type__app_label="wagtailcore",
        codename=codename,
    ).first()


class CmsAccessService:
    """Who may write or publish course pages in Wagtail."""

    def is_admin(self, user) -> bool:
        return _education_access().is_platform_admin(user)

    def is_teacher(self, user) -> bool:
        return _education_access().is_active_teacher(user)

    def can_open_cms(self, user) -> bool:
        if self.is_admin(user) or self.is_teacher(user):
            return True
        return bool(user and user.is_authenticated and user.is_staff)

    def can_view_teacher_report(self, user) -> bool:
        return bool(user and user.is_authenticated and (self.is_admin(user) or self.is_teacher(user)))

    def is_structure_page(self, page) -> bool:
        return isinstance(page.specific, STRUCTURE_TYPES)

    def course_for(self, page):
        specific = page.specific
        if isinstance(specific, CoursePage):
            return specific
        if isinstance(specific, ModulePage):
            return specific.course()
        if isinstance(specific, LessonPage):
            return specific.course()
        return None

    def can_create_page(self, user, parent, page_class) -> bool:
        if self.is_admin(user):
            return True
        if not self.is_teacher(user):
            return False
        if page_class in STRUCTURE_TYPES:
            return False
        if page_class is CoursePage:
            return isinstance(parent.specific, (CategoryPage, SubCategoryPage))
        if page_class in (ModulePage, LessonPage):
            course = self.course_for(parent)
            if course is None and isinstance(parent.specific, CoursePage):
                course = parent.specific
            return course is not None and course.author_id == user.id
        return False

    def can_edit_page(self, user, page) -> bool:
        if self.is_admin(user):
            return True
        if not self.is_teacher(user):
            return False
        if self.is_structure_page(page):
            return False
        course = self.course_for(page)
        if course is None:
            return False
        return course.author_id == user.id

    def can_copy_page(self, user, page) -> bool:
        if self.is_structure_page(page):
            return self.is_admin(user)
        return self.can_edit_page(user, page)

    def can_move_page(self, user, page, destination=None) -> bool:
        if self.is_structure_page(page):
            return self.is_admin(user)
        if not self.can_edit_page(user, page):
            return False
        if destination is None:
            return True
        if isinstance(page.specific, CoursePage):
            return isinstance(destination.specific, (CategoryPage, SubCategoryPage))
        dest_course = self.course_for(destination)
        if dest_course is None and isinstance(destination.specific, CoursePage):
            dest_course = destination.specific
        page_course = self.course_for(page)
        return dest_course is not None and page_course is not None and dest_course.pk == page_course.pk

    def can_publish_page(self, user, page) -> bool:
        return self.is_admin(user)

    def require_create(self, user, parent, page_class):
        if not self.can_create_page(user, parent, page_class):
            raise PermissionDenied("Only an admin can create categories. Teachers add a course under a category.")

    def require_edit(self, user, page):
        if not self.can_edit_page(user, page):
            raise PermissionDenied("You can only edit your own course.")

    def require_publish(self, user, page):
        if not self.can_publish_page(user, page):
            raise PermissionDenied("Only an admin can publish a course.")

    def require_copy(self, user, page):
        if not self.can_copy_page(user, page):
            raise PermissionDenied("Only an admin can copy categories.")

    def require_move(self, user, page, destination=None):
        if not self.can_move_page(user, page, destination):
            raise PermissionDenied("You cannot move this page.")

    def teachers_group(self):
        group, _created = Group.objects.get_or_create(name=TEACHERS_GROUP)
        return group

    def grant_teachers_add_on(self, page):
        """Teachers may add a course (or lesson) under this education folder."""
        group = self.teachers_group()
        for codename in ("add_page", "change_page", "unlock_page"):
            perm = _wagtail_perm(codename)
            if perm:
                GroupPagePermission.objects.get_or_create(
                    group=group,
                    page=page,
                    permission=perm,
                )

    def grant_teachers_admin_access(self):
        group = self.teachers_group()
        perm = Permission.objects.filter(
            content_type__app_label="wagtailadmin",
            codename="access_admin",
        ).first()
        if perm:
            group.permissions.add(perm)

    def sync_teacher_explorer_permissions(self, home):
        """Teachers browse آموزش, but only admin adds Category / SubCategory."""
        self.grant_teachers_admin_access()
        group = self.teachers_group()
        add_perm = _wagtail_perm("add_page")
        if add_perm:
            GroupPagePermission.objects.filter(
                group=group,
                page=home,
                permission=add_perm,
            ).delete()
        for codename in ("change_page", "unlock_page"):
            perm = _wagtail_perm(codename)
            if perm:
                GroupPagePermission.objects.get_or_create(
                    group=group,
                    page=home,
                    permission=perm,
                )
        for page in list(CategoryPage.objects.all()) + list(SubCategoryPage.objects.all()):
            self.grant_teachers_add_on(page)
