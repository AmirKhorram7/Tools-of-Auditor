from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from system_explanation_services.api.v1.serializers import (
    ProcessSerializer,
    ProcessStepDetailSerializer,
    ProcessStepListSerializer,
    ProcessStepWriteSerializer,
    ProjectDetailSerializer,
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
    StepConnection,
    StepControl,
    StepMedia,
    StepRisk,
)


@extend_schema(tags=["Projects"])
class ProjectViewSet(viewsets.ModelViewSet):
    """
    Project tree:
    - Create root: POST {name, ...} without parent
    - Create sub-project: POST {name, parent: <root_id>}
    - List roots: GET /projects/?roots_only=true
    - List children: GET /projects/?parent=<id>
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectSerializer

    def get_queryset(self):
        qs = (
            Project.objects.filter(owner=self.request.user)
            .annotate(
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
            .order_by("-created_at")
        )

        parent = self.request.query_params.get("parent")
        roots_only = self.request.query_params.get("roots_only", "").lower()

        if parent is not None:
            if parent in ("", "null"):
                qs = qs.filter(parent__isnull=True)
            else:
                qs = qs.filter(parent_id=parent)
        elif roots_only in ("1", "true", "yes"):
            qs = qs.filter(parent__isnull=True)

        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch(
                    "sub_projects",
                    queryset=Project.objects.filter(owner=self.request.user),
                )
            )
        return qs

    def perform_create(self, serializer):
        parent = serializer.validated_data.get("parent")
        if parent and parent.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own the parent project.")
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(tags=["Processes"])
class ProcessViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProcessSerializer

    def get_queryset(self):
        qs = (
            Process.objects.filter(project__owner=self.request.user)
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
        if project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this project.")
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete()


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
            process__project__owner=self.request.user
        ).select_related("process", "process__project")

        process_id = self.request.query_params.get("process")
        if process_id:
            qs = qs.filter(process_id=process_id)

        if self.action == "retrieve":
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
        if process.project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this process.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(tags=["Step Connections"])
class StepConnectionViewSet(viewsets.ModelViewSet):
    """
    Arrows between steps on the process canvas.

    - List for a process: GET /connections/?process=<id>
    - Create: POST {from_step, to_step, label?}
    """

    permission_classes = [IsAuthenticated]
    serializer_class = StepConnectionSerializer

    def get_queryset(self):
        qs = StepConnection.objects.filter(
            process__project__owner=self.request.user
        ).select_related("from_step", "to_step")

        process_id = self.request.query_params.get("process")
        if process_id:
            qs = qs.filter(process_id=process_id)
        return qs

    def perform_create(self, serializer):
        from_step = serializer.validated_data["from_step"]
        if from_step.process.project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this process.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(tags=["Step Risks"])
class StepRiskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepRiskSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = StepRisk.objects.filter(
            step__process__project__owner=self.request.user
        ).prefetch_related("media_items")
        step_id = self.request.query_params.get("step")
        if step_id:
            qs = qs.filter(step_id=step_id)
        return qs

    def perform_create(self, serializer):
        step = serializer.validated_data["step"]
        if step.process.project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this step.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(tags=["Step Controls"])
class StepControlViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StepControlSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = StepControl.objects.filter(
            step__process__project__owner=self.request.user
        ).prefetch_related("media_items")
        step_id = self.request.query_params.get("step")
        if step_id:
            qs = qs.filter(step_id=step_id)
        return qs

    def perform_create(self, serializer):
        step = serializer.validated_data["step"]
        if step.process.project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this step.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(tags=["Step Media"])
class StepMediaViewSet(viewsets.ModelViewSet):
    """
    Attach link / image / file to explanation, risk, or control.

    Examples:
    - Explanation image: multipart {step, section:explanation, kind:image, file, title}
    - Risk link: JSON {step, section:risk, risk:<id>, kind:link, url, title}
    - Control file: multipart {step, section:control, control:<id>, kind:file, file}
    """

    permission_classes = [IsAuthenticated]
    serializer_class = StepMediaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = StepMedia.objects.filter(
            step__process__project__owner=self.request.user
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
        if step.process.project.owner_id != self.request.user.id:
            raise PermissionDenied("You do not own this step.")
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()
