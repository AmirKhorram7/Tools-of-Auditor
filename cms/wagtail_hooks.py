from django.core.exceptions import PermissionDenied
from django.urls import path, reverse
from django.utils.translation import gettext_lazy as _
from wagtail import hooks
from wagtail.admin.menu import MenuItem

from cms.models import CategoryPage, CoursePage, SubCategoryPage
from cms.services import access_service
from cms.views import TeacherCourseDetailReportView, TeacherCourseReportView


@hooks.register("before_create_page")
def only_admin_creates_education_folders(request, parent_page, page_class):
    if not access_service.can_create_page(request.user, parent_page, page_class):
        raise PermissionDenied("Only an admin can create categories. Teachers add a course under a category.")


@hooks.register("before_publish_page")
def only_admin_publishes_courses(request, page):
    if not access_service.can_publish_page(request.user, page):
        raise PermissionDenied("Only an admin can publish a course.")


@hooks.register("before_unpublish_page")
def only_admin_unpublishes_courses(request, page):
    if not access_service.can_publish_page(request.user, page):
        raise PermissionDenied("Only an admin can publish a course.")


@hooks.register("before_edit_page")
def teacher_edits_own_course(request, page):
    if not access_service.can_edit_page(request.user, page):
        raise PermissionDenied("You can only edit your own course.")


@hooks.register("before_delete_page")
def teacher_deletes_own_course(request, page):
    if not access_service.can_edit_page(request.user, page):
        raise PermissionDenied("You can only edit your own course.")


@hooks.register("before_copy_page")
def teacher_copies_own_course(request, page):
    if not access_service.can_copy_page(request.user, page):
        raise PermissionDenied("Only an admin can copy categories.")


@hooks.register("before_move_page")
def teacher_moves_own_course(request, page, destination):
    if not access_service.can_move_page(request.user, page, destination):
        raise PermissionDenied("You cannot move this page.")


@hooks.register("after_create_page")
def after_education_page_create(request, page):
    specific = page.specific
    if isinstance(specific, (CategoryPage, SubCategoryPage)):
        access_service.grant_teachers_add_on(specific)
        return
    if not isinstance(specific, CoursePage):
        return
    if specific.author_id or not access_service.is_teacher(request.user):
        return
    specific.author = request.user
    specific.save(update_fields=["author"])


@hooks.register("construct_explorer_page_queryset")
def hide_other_teachers_courses(parent_page, pages, request):
    user = request.user
    if access_service.is_admin(user):
        return pages
    if CoursePage.objects.filter(pk=parent_page.pk).exists():
        course = parent_page.specific
        if course.author_id != user.id:
            return pages.none()
        return pages
    others = CoursePage.objects.exclude(author=user).values_list("pk", flat=True)
    return pages.exclude(pk__in=others)


@hooks.register("register_admin_urls")
def register_teacher_report_urls():
    return [
        path(
            "reports/courses/",
            TeacherCourseReportView.as_view(),
            name="cms_teacher_course_report",
        ),
        path(
            "reports/courses/<int:course_id>/",
            TeacherCourseDetailReportView.as_view(),
            name="cms_teacher_course_report_detail",
        ),
    ]


class TeacherCourseReportMenuItem(MenuItem):
    def is_shown(self, request):
        return access_service.can_view_teacher_report(request.user)


@hooks.register("register_reports_menu_item")
def register_teacher_course_report_menu_item():
    return TeacherCourseReportMenuItem(
        _("Course report"),
        reverse("cms_teacher_course_report"),
        name="teacher-course-report",
        icon_name="doc-full",
        order=100,
    )


def _button_url(button):
    return str(getattr(button, "url", "") or "")


@hooks.register("construct_page_listing_buttons")
def hide_folder_edit_for_teachers(buttons, page, user, context=None):
    if access_service.is_admin(user):
        return
    if not access_service.is_structure_page(page):
        return
    keep = []
    for button in buttons:
        url = _button_url(button)
        if any(part in url for part in ("/edit/", "/delete/", "/copy/", "/move/", "/unpublish/")):
            continue
        keep.append(button)
    buttons[:] = keep
