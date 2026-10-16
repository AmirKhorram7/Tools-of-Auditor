from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from knowledge_management.api.v1.serializers import (
    AttachmentSerializer,
    BacklinkSerializer,
    InkSerializer,
    InkWriteSerializer,
    MoveSerializer,
    NodeCreateSerializer,
    NodeSerializer,
    NodeTreeSerializer,
    NodeUpdateSerializer,
    PlanCreateSerializer,
    PlanDaySerializer,
    PlanDayUpdateSerializer,
    PlanSerializer,
    ReviewDoneSerializer,
    ReviewSerializer,
    SearchHitSerializer,
    ShiftSerializer,
    TemplateSerializer,
    TodaySerializer,
)
from knowledge_management.models import Node
from knowledge_management.services.ink import canvas_size
from knowledge_management.services.nodes import NodeService, VersionConflict
from knowledge_management.services.plans import PlanService

nodes = NodeService()
plans = PlanService()


def _page(request, node, code=status.HTTP_200_OK):
    return Response(NodeSerializer(node, context={"request": request}).data, status=code)


def _save(call):
    try:
        return call(), None
    except VersionConflict as exc:
        return None, Response(
            {
                "detail": "This page changed. Reload it and try again.",
                "version": exc.version,
            },
            status=status.HTTP_409_CONFLICT,
        )


@extend_schema(tags=["Knowledge"])
class TreeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="The whole tree, as a flat list")
    def get(self, request):
        return Response(NodeTreeSerializer(nodes.tree(request.user), many=True).data)


@extend_schema(tags=["Knowledge"])
class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Search titles and page text",
        parameters=[
            OpenApiParameter("q", str, OpenApiParameter.QUERY),
            OpenApiParameter("folder_id", int, OpenApiParameter.QUERY),
        ],
    )
    def get(self, request):
        folder = request.query_params.get("folder_id")
        hits, query = nodes.search(
            request.user,
            request.query_params.get("q", ""),
            int(folder) if folder else None,
        )
        return Response(SearchHitSerializer(hits, many=True, context={"query": query}).data)


@extend_schema(tags=["Knowledge"])
class TitleSearchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Title prefix search, for the wikilink picker")
    def get(self, request):
        rows = nodes.search_titles(request.user, request.query_params.get("q", ""))
        return Response(NodeTreeSerializer(rows, many=True).data)


@extend_schema(tags=["Knowledge"])
class TodayView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Today's plan days, due reviews, and daily note")
    def get(self, request):
        return Response(TodaySerializer(plans.today(request.user), context={"request": request}).data)


@extend_schema(tags=["Knowledge"])
class DailyNoteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get or create the daily note for a date")
    def get(self, request):
        raw = request.query_params.get("date")
        if not raw:
            from django.utils import timezone

            day = timezone.localdate()
        else:
            from datetime import date

            try:
                day = date.fromisoformat(raw)
            except ValueError as exc:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"date": "Use YYYY-MM-DD."}) from exc
        page = nodes.daily(request.user, day)
        return _page(request, page)


@extend_schema(tags=["Knowledge"])
class PlanDayView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Assign a course folder or change the day's status")
    def patch(self, request, pk):
        row = plans.get_day(request.user, pk)
        serializer = PlanDayUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        row = plans.update_day(
            request.user,
            row,
            node_id=data.get("node_id"),
            status=data.get("status"),
            set_node="node_id" in data,
        )
        return Response(PlanDaySerializer(row).data)


@extend_schema(tags=["Knowledge"])
class AttachmentView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Upload an image or PDF onto a page")
    def post(self, request):
        node_id = request.data.get("node_id")
        upload = request.FILES.get("file")
        if not node_id or upload is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"file": "Send node_id and a file."})
        row = nodes.add_file(request.user, node_id=int(node_id), upload=upload)
        return Response(AttachmentSerializer(row, context={"request": request}).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Knowledge"])
@extend_schema_view(
    list=extend_schema(summary="List folders and pages"),
    retrieve=extend_schema(summary="Get a folder or page"),
    create=extend_schema(summary="Create a folder or page"),
    partial_update=extend_schema(summary="Rename, change the icon, or save page content"),
    destroy=extend_schema(summary="Move a node and its children to the trash"),
)
class NodeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        return Response(NodeTreeSerializer(nodes.tree(request.user), many=True).data)

    def retrieve(self, request, pk=None):
        return _page(request, nodes.get(request.user, pk))

    def create(self, request):
        serializer = NodeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        node = nodes.create(request.user, **serializer.validated_data)
        return _page(request, node, status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        node = nodes.get(request.user, pk)
        serializer = NodeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        node, conflict = _save(lambda: nodes.update(request.user, node, **serializer.validated_data))
        if conflict is not None:
            return conflict
        return _page(request, node)

    def destroy(self, request, pk=None):
        nodes.delete(request.user, nodes.get(request.user, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(summary="Move a node under another parent", request=MoveSerializer)
    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        serializer = MoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        node = nodes.move(request.user, nodes.get(request.user, pk), **serializer.validated_data)
        return _page(request, node)

    @extend_schema(summary="Duplicate a node and its children")
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        node = nodes.duplicate(request.user, nodes.get(request.user, pk))
        return _page(request, node, status.HTTP_201_CREATED)

    @extend_schema(summary="Restore a node from the trash (30 days)")
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        node = nodes.restore(request.user, pk)
        return _page(request, node)

    @extend_schema(summary="Pages that link here")
    @action(detail=True, methods=["get"])
    def backlinks(self, request, pk=None):
        node = nodes.get(request.user, pk)
        return Response(BacklinkSerializer(nodes.backlinks(request.user, node), many=True).data)

    @extend_schema(summary="Export a page as Markdown, or a folder as a zip")
    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        node = nodes.get(request.user, pk)
        if node.type == Node.Type.FOLDER:
            payload = nodes.export_zip(request.user, node)
            response = HttpResponse(payload, content_type="application/zip")
            response["Content-Disposition"] = f'attachment; filename="{node.id}.zip"'
            return response
        body = nodes.export_page(request.user, node)
        response = HttpResponse(body, content_type="text/markdown; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{node.id}.md"'
        return response


@extend_schema(tags=["Knowledge"])
class PlanViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        return Response(PlanSerializer(plans.list(request.user), many=True).data)

    def retrieve(self, request, pk=None):
        return Response(PlanSerializer(plans.get(request.user, pk)).data)

    def create(self, request):
        serializer = PlanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = plans.create(request.user, **serializer.validated_data)
        return Response(PlanSerializer(plan).data, status=status.HTTP_201_CREATED)

    @extend_schema(summary="Move the remaining days by N days", request=ShiftSerializer)
    @action(detail=True, methods=["post"])
    def shift(self, request, pk=None):
        serializer = ShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = plans.shift(request.user, plans.get(request.user, pk), serializer.validated_data["days"])
        return Response(PlanSerializer(plan).data)


@extend_schema(tags=["Knowledge"])
class TemplateViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        return Response(TemplateSerializer(nodes.templates(request.user), many=True).data)

    def retrieve(self, request, pk=None):
        return Response(TemplateSerializer(nodes.get_template(request.user, pk)).data)

    def create(self, request):
        serializer = TemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = nodes.save_template(request.user, None, **serializer.validated_data)
        return Response(TemplateSerializer(row).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        row = nodes.get_template(request.user, pk)
        serializer = TemplateSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        row = nodes.save_template(request.user, row, **serializer.validated_data)
        return Response(TemplateSerializer(row).data)

    def destroy(self, request, pk=None):
        nodes.delete_template(request.user, nodes.get_template(request.user, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Knowledge"])
class ReviewViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        from django.utils import timezone

        day = timezone.localdate()
        return Response(ReviewSerializer(plans.due(request.user, day), many=True).data)

    def partial_update(self, request, pk=None):
        serializer = ReviewDoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data["done"]:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"done": "Send done=true to finish a review."})
        review = plans.finish_review(request.user, pk)
        return Response(ReviewSerializer(review).data)


@extend_schema(tags=["Knowledge"])
class InkViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, pk=None):
        return Response(InkSerializer(nodes.get_ink(request.user, pk)).data)

    def create(self, request):
        serializer = InkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        drawing = nodes.save_ink(
            request.user,
            None,
            node_id=data["node_id"],
            strokes=data["strokes"],
            width=canvas_size(data["width"], "width"),
            height=canvas_size(data["height"], "height"),
        )
        return Response(InkSerializer(drawing).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        drawing = nodes.get_ink(request.user, pk)
        serializer = InkWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        drawing = nodes.save_ink(
            request.user,
            drawing,
            node_id=data.get("node_id", drawing.node_id),
            strokes=data.get("strokes", drawing.strokes),
            width=canvas_size(data.get("width", drawing.width), "width"),
            height=canvas_size(data.get("height", drawing.height), "height"),
        )
        return Response(InkSerializer(drawing).data)
