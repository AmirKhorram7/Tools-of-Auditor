from django.apps import AppConfig


class DaybookServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'daybook_services'

    def ready(self):
        from daybook_services.reminders import register

        register()
