from django.apps import AppConfig


class NewsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "news"
    verbose_name = "News"

    def ready(self):
        # Register NewsTeamMember ↔ legacy Group sync receivers.
        from news.services import team as _news_team  # noqa: F401
