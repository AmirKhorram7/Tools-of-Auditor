from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from news.constants import NEWS_GROUP_NAME
from news.api.v1.serializers import (
    ArticleDetailSerializer,
    ArticleSerializer,
    FetchJobCreateSerializer,
    FetchJobSerializer,
    FreshnessSerializer,
    NewsAccessSerializer,
    NewsPanelSerializer,
    NewsPanelWriteSerializer,
    NewsSettingsSerializer,
    NewsSourceSerializer,
    NewsWarehouseSerializer,
    NewsWarehouseSyncSerializer,
    NewsWarehouseWriteSerializer,
    language_for,
)
from news.services.detail import build_detail
from news.services.freshness import catalog_freshness
from news.models import Article, FetchJob, NewsSource
from news.pagination import NewsPagination
from news.permissions import IsNewsFetchAdmin, IsNewsTeam, user_in_news_team, user_is_news_admin
from news.services.access import preference_for
from news.services.articles import ArticleQueryService
from news.services.ingest import IngestService
from news.services.panel import PanelSettingsService
from news.services.warehouse.settings import WarehouseSettingsService
from news.services.warehouse.sync import WarehouseSyncService

PANEL_NOTE = (
    "The news panel is **global** (not tenant-scoped). "
    "Only members of the Django group `News Team`, plus superusers, may call these endpoints. "
    "Everyone else gets `403`. Superusers start fetch jobs."
)


def _q(name, description, typ=OpenApiTypes.STR, required=False):
    return OpenApiParameter(
        name,
        typ,
        OpenApiParameter.QUERY,
        required=required,
        description=description,
    )


class NewsAccessView(APIView):
    """Base: `GET /api/v1/news/access/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["News"],
        summary="Can I open the news panel?",
        description=(
            "Any logged-in user. Use this to hide the sidebar link.\n\n"
            "- `allowed`: in the **News Team** group or superuser.\n"
            "- `is_fetch_admin`: superuser (can start fetch jobs).\n"
            "- `language`: last EN/FA choice (`en` until they set it).\n\n"
            + PANEL_NOTE
        ),
        responses={200: NewsAccessSerializer},
    )
    def get(self, request):
        pref = preference_for(request.user)
        return Response(
            NewsAccessSerializer(
                {
                    "allowed": user_in_news_team(request.user),
                    "is_fetch_admin": user_is_news_admin(request.user),
                    "language": pref.language,
                    "group": NEWS_GROUP_NAME,
                }
            ).data
        )


class NewsSettingsView(APIView):
    """Base: `/api/v1/news/settings/`"""

    permission_classes = [IsAuthenticated, IsNewsTeam]

    @extend_schema(
        tags=["News"],
        summary="My news language",
        description="`en` (original) or `fa` (Persian when a translation is ready; otherwise English).",
        responses={200: NewsSettingsSerializer},
    )
    def get(self, request):
        return Response({"language": preference_for(request.user).language})

    @extend_schema(
        tags=["News"],
        summary="Set news language",
        description="Body: `{language: \"en\"|\"fa\"}`. Stored on the user, not the tenant.",
        request=NewsSettingsSerializer,
        responses={200: NewsSettingsSerializer},
    )
    def patch(self, request):
        serializer = NewsSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pref = preference_for(request.user)
        pref.language = serializer.validated_data["language"]
        pref.save(update_fields=["language", "updated_at"])
        return Response({"language": pref.language})


class NewsPanelView(APIView):
    """Base: `/api/v1/news/panel/` — how the global fetch job runs."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAuthenticated(), IsNewsFetchAdmin()]
        return [IsAuthenticated(), IsNewsTeam()]

    @extend_schema(
        tags=["News"],
        summary="News panel fetch settings",
        description=(
            "How the scraper job runs. Global, not tenant-scoped.\n\n"
            "- `fetch_mode=manual`: nothing runs until a superuser hits **Start fetch**.\n"
            "- `fetch_mode=scheduled`: Celery beat starts one job for all active sources "
            "every `interval_hours` (24 = daily). Beat ticks every 15 minutes and only "
            "fires when the interval has elapsed.\n"
            "- `interval_presets`: suggested values for the settings page.\n"
            "- `next_run_at`: null in manual mode; now (or last run + interval) when scheduled.\n"
            "- `can_edit`: true only for superusers.\n\n"
            "News Team may **read**. Only superusers **PATCH**.\n\n"
            + PANEL_NOTE
        ),
        responses={200: NewsPanelSerializer},
    )
    def get(self, request):
        return Response(NewsPanelSerializer(PanelSettingsService().snapshot(request.user)).data)

    @extend_schema(
        tags=["News"],
        summary="Update news panel fetch settings",
        description=(
            "Superuser only. Body: `{fetch_mode?: \"manual\"|\"scheduled\", interval_hours?: 1–168}`.\n\n"
            "Example daily: `{fetch_mode: \"scheduled\", interval_hours: 24}`.\n"
            "Example on-demand: `{fetch_mode: \"manual\"}`."
        ),
        request=NewsPanelWriteSerializer,
        responses={200: NewsPanelSerializer},
    )
    def patch(self, request):
        serializer = NewsPanelWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            raise ValidationError("Provide fetch_mode and/or interval_hours.")
        data = PanelSettingsService().update(request.user, **serializer.validated_data)
        return Response(NewsPanelSerializer(data).data)


class NewsWarehouseView(APIView):
    """Base: `/api/v1/news/warehouse/` — ClickHouse copy schedule. Superuser only."""

    permission_classes = [IsAuthenticated, IsNewsFetchAdmin]

    @extend_schema(
        tags=["News warehouse"],
        summary="News ClickHouse warehouse settings",
        description=(
            "Off-peak copy of articles from Postgres to ClickHouse for later ML. "
            "Superuser only — News Team members get `403` on GET and PATCH.\n\n"
            "- `enabled=false` (default): beat does nothing.\n"
            "- `interval_hours`: 24, 48, 72, 168 (weekly), 720 (monthly).\n"
            "- `run_hour` / `run_minute`: clock in `TIME_ZONE` (Asia/Tehran). "
            "Beat ticks every 15 minutes and only fires inside that window.\n"
            "- Copy is incremental: `id > max(id)` already in ClickHouse, plus rows "
            "updated since the last run. Articles are never locked.\n\n"
            + PANEL_NOTE
        ),
        responses={200: NewsWarehouseSerializer},
    )
    def get(self, request):
        return Response(NewsWarehouseSerializer(WarehouseSettingsService().as_dict()).data)

    @extend_schema(
        tags=["News warehouse"],
        summary="Update ClickHouse warehouse settings",
        description=(
            "Superuser only. Body: `{enabled?, interval_hours?, run_hour?, run_minute?}`.\n\n"
            "Example nightly: `{enabled: true, interval_hours: 24, run_hour: 2, run_minute: 0}`."
        ),
        request=NewsWarehouseWriteSerializer,
        responses={200: NewsWarehouseSerializer},
    )
    def patch(self, request):
        serializer = NewsWarehouseWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            raise ValidationError("Provide enabled, interval_hours, run_hour, and/or run_minute.")
        obj = WarehouseSettingsService().update(serializer.validated_data, request.user)
        return Response(NewsWarehouseSerializer(WarehouseSettingsService().as_dict(obj)).data)


class NewsFreshnessView(APIView):
    """Base: `GET /api/v1/news/freshness/` — are sources up to date? Superuser only."""

    permission_classes = [IsAuthenticated, IsNewsFetchAdmin]

    @extend_schema(
        tags=["News fetch jobs"],
        summary="Are news sources up to date?",
        description=(
            "Superuser only. Used by the settings **Update news** popup before starting a job.\n\n"
            "- `up_to_date=true` when every active source (or the one in `source_id`) was polled "
            "successfully inside its freshness window.\n"
            "- `fetch_running=true` if a pending/running job already covers those sources.\n"
            "- `last_fetched_at` is the newest successful poll across active sources.\n\n"
            + PANEL_NOTE
        ),
        parameters=[
            _q("source_id", "Limit check to one source.", OpenApiTypes.INT),
            _q("all", "Include inactive sources.", OpenApiTypes.BOOL),
        ],
        responses={200: FreshnessSerializer},
    )
    def get(self, request):
        source_id = request.query_params.get("source_id")
        sid = int(source_id) if source_id and str(source_id).isdigit() else None
        include_inactive = request.query_params.get("all") in {"1", "true"}
        data = catalog_freshness(source_id=sid, include_inactive=include_inactive)
        return Response(FreshnessSerializer(data).data)


class NewsWarehouseSyncView(APIView):
    """Base: `POST /api/v1/news/warehouse/sync/` — copy now, superuser only."""

    permission_classes = [IsAuthenticated, IsNewsFetchAdmin]

    @extend_schema(
        tags=["News warehouse"],
        summary="Copy news to ClickHouse now",
        description=(
            "Superuser only. Runs one incremental copy even if the schedule is off. "
            "Does not lock article rows. Safe to call while the site is live; prefer "
            "the off-peak hour for large backfills."
        ),
        responses={200: NewsWarehouseSyncSerializer},
    )
    def post(self, request):
        result = WarehouseSyncService().sync(force=True)
        return Response(NewsWarehouseSyncSerializer(result).data)


@extend_schema(tags=["News sources"])
@extend_schema_view(
    list=extend_schema(
        summary="List sources (for filters)",
        description="Active sources by default. Superusers may pass `all=1` to include inactive rows.\n\n"
        + PANEL_NOTE,
        parameters=[_q("all", "Superuser only. Include inactive sources.", OpenApiTypes.BOOL)],
    ),
    retrieve=extend_schema(summary="Get a source"),
)
class NewsSourceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NewsSourceSerializer
    permission_classes = [IsAuthenticated, IsNewsTeam]
    pagination_class = NewsPagination
    queryset = NewsSource.objects.all()

    def get_queryset(self):
        qs = NewsSource.objects.all()
        if self.request.query_params.get("all") in {"1", "true"}:
            if not user_is_news_admin(self.request.user):
                raise PermissionDenied("Only superusers can list inactive sources.")
            return qs
        return qs.filter(is_active=True)


@extend_schema(tags=["News articles"])
@extend_schema_view(
    list=extend_schema(
        summary="List articles",
        description=(
            "Newest first. Cards: image, title, source, date, excerpt, `url` (read original).\n\n"
            "When the user's language is `fa` and `translation_status=done`, `display_title` / "
            "`display_summary` are Persian; otherwise they fall back to English. Original fields "
            "stay on the payload.\n\n"
            "Filters are query params (shareable URLs).\n\n"
            + PANEL_NOTE
        ),
        parameters=[
            _q("q", "Search title and summary (and Persian fields)."),
            _q("source", "Repeatable source slug, e.g. `source=openai-news&source=deepmind-blog`."),
            _q("source_id", "Repeatable source id.", OpenApiTypes.INT),
            _q("category", "lab, academia, media, vc, newsletter, papers."),
            _q("region", "global, us, eu, asia."),
            _q("date_from", "Inclusive published date `YYYY-MM-DD`.", OpenApiTypes.DATE),
            _q("date_to", "Inclusive published date `YYYY-MM-DD`.", OpenApiTypes.DATE),
            _q("page", "Page number (default 1).", OpenApiTypes.INT),
            _q("page_size", "Page size (default 20, max 50).", OpenApiTypes.INT),
        ],
    ),
    retrieve=extend_schema(
        summary="Get one article (story detail)",
        description=(
            "Full reader payload for the story detail page: brief, key points, "
            "paragraphs (excerpts), why-it-matters, entities, related, prev/next.\n\n"
            "`fetch_trace` is included only for staff/superusers.\n\n"
            "Optional `ids=1,2,3` (comma-separated) sets prev/next from the feed list "
            "that opened this story.\n\n"
            "`body` is never returned (warehouse / ML only).\n\n"
            + PANEL_NOTE
        ),
        parameters=[
            _q("ids", "Comma-separated article ids for prev/next order from the feed."),
        ],
        responses={200: ArticleDetailSerializer},
    ),
)
class ArticleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ArticleSerializer
    permission_classes = [IsAuthenticated, IsNewsTeam]
    pagination_class = NewsPagination
    queryset = Article.objects.select_related("source").all()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ArticleDetailSerializer
        return ArticleSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        self.request.news_language = language_for(self.request)
        return ctx

    def get_queryset(self):
        if self.action == "retrieve":
            return Article.objects.select_related("source").all()
        return ArticleQueryService().filtered(self.request.query_params)

    def retrieve(self, request, *args, **kwargs):
        article = self.get_object()
        id_list = None
        raw = (request.query_params.get("ids") or "").strip()
        if raw:
            id_list = [int(x) for x in raw.split(",") if x.strip().isdigit()]
        staff = bool(request.user and (request.user.is_staff or request.user.is_superuser))
        payload = build_detail(article, staff=staff, id_list=id_list)
        return Response(ArticleDetailSerializer(payload).data)


@extend_schema(tags=["News fetch jobs"])
@extend_schema_view(
    list=extend_schema(
        summary="Fetch job history",
        description="Superuser only. Newest first. Poll this (or retrieve) for status and counts.\n\n"
        + PANEL_NOTE,
    ),
    retrieve=extend_schema(summary="Get a fetch job"),
    create=extend_schema(
        summary="Start a fetch",
        description=(
            "Superuser only. Body: `{source_id?, date_from?, date_to?}`.\n\n"
            "- Omit `source_id` (or send `null`) to fetch **all active** sources.\n"
            "- `date_from` / `date_to` drop items outside the published window.\n"
            "- Creates a `FetchJob` (`pending` → `running` → `done`/`failed`) and queues Celery.\n"
            "- Counts: `found`, `new`, `skipped` (dup/out of range/robots), `failed`."
        ),
        request=FetchJobCreateSerializer,
        responses={201: FetchJobSerializer},
    ),
)
class FetchJobViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FetchJobSerializer
    permission_classes = [IsAuthenticated, IsNewsFetchAdmin]
    pagination_class = NewsPagination
    queryset = FetchJob.objects.select_related("source").all()

    def create(self, request, *args, **kwargs):
        serializer = FetchJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        source = None
        source_id = data.get("source_id")
        if source_id:
            try:
                source = NewsSource.objects.get(pk=source_id)
            except NewsSource.DoesNotExist as exc:
                raise ValidationError({"source_id": "Unknown source."}) from exc
        date_from = data.get("date_from")
        date_to = data.get("date_to")
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_to": "Must be on or after date_from."})
        force = bool(data.get("force"))
        if not force:
            snap = catalog_freshness(source_id=source.pk if source else None)
            if snap["fetch_running"]:
                return Response(
                    {
                        "detail": "A fetch is already running.",
                        "message_key": "running",
                        "up_to_date": snap["up_to_date"],
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if snap["up_to_date"]:
                last = snap["last_fetched_at"]
                return Response(
                    {
                        "detail": "News is already up to date.",
                        "message_key": "up_to_date",
                        "up_to_date": True,
                        "last_fetched_at": last.isoformat() if last else None,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
        job = IngestService().queue_job(
            source=source,
            requested_by=request.user,
            date_from=date_from,
            date_to=date_to,
        )
        return Response(FetchJobSerializer(job).data, status=status.HTTP_201_CREATED)
