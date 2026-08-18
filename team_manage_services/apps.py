from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class TeamManageServicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "team_manage_services"
    verbose_name = _("Team manager")
