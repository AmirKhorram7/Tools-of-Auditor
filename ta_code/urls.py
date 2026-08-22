from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from ta_code.views import health

urlpatterns = [
    path("amirkhorram7/", admin.site.urls),
    path("healthz/", health, name="health"),
    path("api/v1/", include("user_management.api.v1.urls")),
    path("api/v1/", include("system_explanation_services.api.v1.urls")),
    path("api/v1/work/", include("team_manage_services.api.v1.urls")),
]

if settings.ENABLE_API_DOCS:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
