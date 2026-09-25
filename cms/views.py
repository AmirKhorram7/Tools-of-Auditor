from django.core.exceptions import PermissionDenied
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import TemplateView
from wagtail.admin.views.generic.base import WagtailAdminTemplateMixin

from cms.services import access_service
from cms.services.reports import TeacherReportService

report_service = TeacherReportService()


class TeacherReportMixin(WagtailAdminTemplateMixin):
    header_icon = "doc-full"

    def dispatch(self, request, *args, **kwargs):
        if not access_service.can_view_teacher_report(request.user):
            raise PermissionDenied("Only a teacher can open this report.")
        return super().dispatch(request, *args, **kwargs)


class TeacherCourseReportView(TeacherReportMixin, TemplateView):
    template_name = "cms/reports/course_list.html"
    page_title = _("Course report")

    def get_breadcrumbs_items(self):
        return self.breadcrumbs_items + [
            {"url": "", "label": self.get_page_title()},
        ]

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["rows"] = report_service.list_rows(self.request.user)
        return context


class TeacherCourseDetailReportView(TeacherReportMixin, TemplateView):
    template_name = "cms/reports/course_detail.html"
    page_title = _("Course report")

    def get_breadcrumbs_items(self):
        return self.breadcrumbs_items + [
            {"url": reverse("cms_teacher_course_report"), "label": _("Course report")},
            {"url": "", "label": self.page_subtitle or _("Course")},
        ]

    def get_context_data(self, **kwargs):
        detail = report_service.course_detail(self.request.user, self.kwargs["course_id"])
        self.page_subtitle = detail["course"].title
        context = super().get_context_data(**kwargs)
        context.update(detail)
        return context
