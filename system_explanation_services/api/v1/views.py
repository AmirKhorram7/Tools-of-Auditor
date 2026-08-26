from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from system_explanation_services.api.v1.serializers import (
    ProcessSerializer,
    ProcessStepDetailSerializer,
    ProcessStepListSerializer,
    ProcessStepWriteSerializer,
    ProjectDetailSerializer,
    ProjectMemberInviteSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
    StepConnectionSerializer,
    StepControlSerializer,
    StepMediaSerializer,
    StepRiskSerializer,
)
from system_explanation_services.models import (
    Process,
    ProcessStep,
    Project,
    ProjectMember,
    StepConnection,
    StepControl,
    StepMedia,
    StepRisk,
)
from system_explanation_services.services.access import (
    can_delete_project,
    can_edit_project,
    can_manage_members,
    can_view_project,
    ensure_owner_membership,
    get_root_project,
    processes_for_user,
    projects_for_user,
)
from system_explanation_services.services.pdf_export import (
    build_process_pdf,
    build_project_pdf,
    build_step_pdf,
)

User = get_user_model()


def _require_view(user, project):
    if not can_view_project(user, project):
        raise PermissionDenied("You do not have access to this project.")


def _require_edit(user, project):
    if not can_edit_project(user, project):
        raise PermissionDenied("You do not have edit access to this project.")


def _project_annotations(qs):
    return qs.annotate(
        process_count=Count(
            "processes",
            filter=Q(processes__is_deleted=False),
            distinct=True,
        ),
        sub_project_count=Count(
            "sub_projects",
            filter=Q(sub_projects__is_deleted=False),
            distinct=True,
        ),
    )


@extend_schema(tags=["Projects"])
class ProjectViewSet(viewsets.ModelViewSet):
    """
    Project tree with root-level sharing (owner / editor / viewer).

    - List roots: GET /projects/?roots_only=true
    - Shared with me: GET /projects/?roots_only=true&shared=true
    - Whole tree: GET /projects/tree/ (optionally ?root={id})
    - Members: GET/POST /projects/{id}/members/
    - Export PDF: GET /projects/{id}/export-pdf/
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectSerializer

    def get_queryset(self):
        qs = _project_annotations(projects_for_user(self.request.user)).order_by(
            "-created_at"
        )

        parent = self.request.query_params.get("parent")
        roots_only = self.request.query_params.get("roots_only", "").lower()
        shared = self.request.query_params.get("shared", "").lower()

        if parent is not None:
            if parent in ("", "null"):
                qs = qs.filter(parent__isnull=True)
            else:
                qs = qs.filter(parent_id=parent)
        elif roots_only in ("1", "true", "yes"):
            qs = qs.filter(parent__isnull=True)

        if shared in ("1", "true", "yes"):
            qs = qs.filter(parent__isnull=True).exclude(owner=self.request.user)

        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch(
                    "sub_projects",
                    queryset=_project_annotations(
                        projects_for_user(self.request.user).filter(
                            parent__isnull=False
                        )
                    ),
                )
            )
        return qs

    def perform_create(self, serializer):
        parent = serializer.validated_data.get("parent")
        if parent:
            _require_edit(self.request.user, parent)
            project = serializer.save(owner=parent.owner)
        else:
            project = serializer.save(owner=self.request.user)
            ensure_owner_membership(project, self.request.user)

    def perform_update(self, serializer):
        _require_edit(self.request.user, serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        if not can_delete_project(self.request.user, instance):
            raise PermissionDenied("Only the project owner can delete this project.")
        instance.soft_delete()

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """
        Full hierarchy for the visual tree view, in a single request:
        folder -> sub-folder -> process -> step.
        """
        visible = projects_for_user(request.user)
        project_ids = list(visible.values_list("id", flat=True))

        processes = (
            Process.objects.filter(project_id__in=project_ids)
            .order_by("order", "id")
            .values("id", "project_id", "name", "color")
        )
        steps = (
            ProcessStep.objects.filter(
                process_id__in=[row["id"] for row in processes]
            )
            .order_by("order", "id")
            .values("id", "process_id", "title", "shape_type", "status")
        )

        steps_by_process = defaultdict(list)
        for step in steps:
            steps_by_process[step["process_id"]].append(
                {
                    "id": step["id"],
                    "title": step["title"],
                    "shape_type": step["shape_type"],
                    "status": step["status"],
                }
            )

        processes_by_project = defaultdict(list)
        for process in processes:
            process_steps = steps_by_process.get(process["id"], [])
            processes_by_project[process["project_id"]].append(
                {
                    "id": process["id"],
                    "name": process["name"],
                    "color": process["color"] or "default",
                    "step_count": len(process_steps),
                    "steps": process_steps,
                }
            )

        nodes = {}
        for project in visible.order_by("name"):
            nodes[project.id] = {
                "id": project.id,
                "parent": project.parent_id,
                "name": project.name,
                "company_name": project.company_name,
                "status": project.status,
                "color": project.color or "default",
                "processes": processes_by_project.get(project.id, []),
                "children": [],
            }

        roots = []
        for node in nodes.values():
            parent = nodes.get(node["parent"]) if node["parent"] else None
            # A node whose parent is not visible is shown as a root of its own.
            if parent is None:
                roots.append(node)
            else:
                parent["children"].append(node)

        root_param = request.query_params.get("root")
        if root_param:
            roots = [node for node in roots if str(node["id"]) == str(root_param)]

        return Response(roots)

    @extend_schema(responses=ProjectMemberSerializer(many=True))
    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()
        root = get_root_project(project)
        ensure_owner_membership(root)

        if request.method == "GET":
            _require_view(request.user, root)
            members = root.memberships.select_related("user", "user__profile").order_by(
                "created_at"
            )
            return Response(ProjectMemberSerializer(members, many=True).data)

        if not can_manage_members(request.user, root):
            raise PermissionDenied("Only the owner can invite members.")

        invite = ProjectMemberInviteSerializer(data=request.data)
        invite.is_valid(raise_exception=True)
        phone = invite.validated_data["phone_number"]
        role = invite.validated_data["role"]
        user = User.objects.get(phone_number=phone)

        if user.id == root.owner_id:
            raise ValidationError({"phone_number": "Owner is already a member."})

        member, created = ProjectMember.objects.update_or_create(
            project=root,
            user=user,
            defaults={"role": role, "invited_by": request.user},
        )
        return Response(
            ProjectMemberSerializer(member).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(responses=ProjectMemberSerializer)
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"members/(?P<member_id>[0-9]+)",
    )
    def member_detail(self, request, pk=None, member_id=None):
        project = self.get_object()
        root = get_root_project(project)
        if not can_manage_members(request.user, root):
            raise PermissionDenied("Only the owner can manage members.")

        try:
            member = root.memberships.select_related("user").get(pk=member_id)
        except ProjectMember.DoesNotExist as exc:
            raise ValidationError({"member_id": "Member not found."}) from exc

        if member.role == ProjectMember.Role.OWNER or member.user_id == root.owner_id:
            raise ValidationError({"detail": "Cannot change or remove the owner."})

        if request.method == "DELETE":
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        role = request.data.get("role")
        if role not in (ProjectMember.Role.EDITOR, ProjectMember.Role.VIEWER):
            raise ValidationError({"role": "Role must be editor or viewer."})
        member.role = role
        member.save(update_fields=["role", "updated_at"])
        return Response(ProjectMemberSerializer(member).data)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        project = self.get_object()
        _require_view(request.user, project)
        root = get_root_project(project)
        pdf = build_project_pdf(root)
        filename = f"project-{root.id}-{root.name[:40]}.pdf".replace(" ", "_")
        return FileResponse(pdf, as_attachment=True, filename=filename, content_type="application/pdf")


@extend_schema(tags=["Processes"])
class ProcessViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProcessSerializer

    def get_queryset(self):
        qs = (
            processes_for_user(self.request.user)
            .select_related("project")
            .annotate(
                step_count=Count(
                    "steps",
                    filter=Q(steps__is_deleted=False),
                    distinct=True,
                )
            )
        )
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        _require_edit(self.request.user, project)
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        _require_edit(self.request.user, serializer.instance.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.project)
        instance.soft_delete()

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        process = self.get_object()
        _require_view(request.user, process.project)
        pdf = build_process_pdf(process)
        filename = f"process-{process.id}-{process.name[:40]}.pdf".replace(" ", "_")
        return FileResponse(pdf, as_attachment=True, filename=filename, content_type="application/pdf")


@extend_schema_view(
    list=extend_schema(tags=["Process Steps"]),
    retrieve=extend_schema(tags=["Process Steps"]),
    create=extend_schema(tags=["Process Steps"]),
    update=extend_schema(tags=["Process Steps"]),
    partial_update=extend_schema(tags=["Process Steps"]),
    destroy=extend_schema(tags=["Process Steps"]),
)
class ProcessStepViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ProcessStep.objects.filter(
            process_id__in=processes_for_user(self.request.user).values("id")
        ).select_related("process", "process__project")

        process_id = self.request.query_params.get("process")
        if process_id:
            qs = qs.filter(process_id=process_id)

        if self.action in ("retrieve", "export_pdf"):
            qs = qs.prefetch_related(
                Prefetch(
                    "risks",
                    queryset=StepRisk.objects.prefetch_related("media_items"),
                ),
                Prefetch(
                    "controls",
                    queryset=StepControl.objects.prefetch_related("media_items"),
                ),
                Prefetch("media_items", queryset=StepMedia.objects.all()),
            )
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProcessStepDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return ProcessStepWriteSerializer
        return ProcessStepListSerializer

    def perform_create(self, serializer):
        process = serializer.validated_data["process"]
        _require_edit(self.request.user, process.project)
        serializer.save()

    def perform_update(self, serializer):
        _require_edit(self.request.user, serializer.instance.process.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.process.project)
        instance.soft_delete()

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        step = self.get_object()
        _require_view(request.user, step.process.project)
        pdf = build_step_pdf(step)
        filename = f"step-{step.id}-{step.title[:40]}.pdf".replace(" ", "_")
        return FileResponse(
            pdf,
            as_attachment=True,
            filename=filename,
            content_type="application/pdf",
        )


@extend_schema(tags=["Step Connections"])
class StepConnectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepConnectionSerializer

    def get_queryset(self):
        qs = StepConnection.objects.filter(
            process_id__in=processes_for_user(self.request.user).values("id")
        ).select_related("from_step", "to_step")

        process_id = self.request.query_params.get("process")
        if process_id:
            qs = qs.filter(process_id=process_id)
        return qs

    def perform_create(self, serializer):
        from_step = serializer.validated_data["from_step"]
        _require_edit(self.request.user, from_step.process.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.process.project)
        instance.soft_delete()


@extend_schema(tags=["Step Risks"])
class StepRiskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepRiskSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = StepRisk.objects.filter(
            step__process_id__in=processes_for_user(self.request.user).values("id")
        ).prefetch_related("media_items")
        step_id = self.request.query_params.get("step")
        if step_id:
            qs = qs.filter(step_id=step_id)
        return qs

    def perform_create(self, serializer):
        step = serializer.validated_data["step"]
        _require_edit(self.request.user, step.process.project)
        serializer.save()

    def perform_update(self, serializer):
        _require_edit(self.request.user, serializer.instance.step.process.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.step.process.project)
        instance.soft_delete()


@extend_schema(tags=["Step Controls"])
class StepControlViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepControlSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = StepControl.objects.filter(
            step__process_id__in=processes_for_user(self.request.user).values("id")
        ).prefetch_related("media_items")
        step_id = self.request.query_params.get("step")
        if step_id:
            qs = qs.filter(step_id=step_id)
        return qs

    def perform_create(self, serializer):
        step = serializer.validated_data["step"]
        _require_edit(self.request.user, step.process.project)
        serializer.save()

    def perform_update(self, serializer):
        _require_edit(self.request.user, serializer.instance.step.process.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.step.process.project)
        instance.soft_delete()


@extend_schema(tags=["Step Media"])
class StepMediaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepMediaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = StepMedia.objects.filter(
            step__process_id__in=processes_for_user(self.request.user).values("id")
        ).select_related("step", "risk", "control")

        step_id = self.request.query_params.get("step")
        section = self.request.query_params.get("section")
        risk_id = self.request.query_params.get("risk")
        control_id = self.request.query_params.get("control")

        if step_id:
            qs = qs.filter(step_id=step_id)
        if section:
            qs = qs.filter(section=section)
        if risk_id:
            qs = qs.filter(risk_id=risk_id)
        if control_id:
            qs = qs.filter(control_id=control_id)
        return qs

    def perform_create(self, serializer):
        step = serializer.validated_data["step"]
        _require_edit(self.request.user, step.process.project)
        serializer.save()

    def perform_destroy(self, instance):
        _require_edit(self.request.user, instance.step.process.project)
        instance.soft_delete()
