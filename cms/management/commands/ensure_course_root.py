from django.core.management.base import BaseCommand
from wagtail.models import Page, Site

from cms.models import HomePage
from cms.services import access_service


class Command(BaseCommand):
    help = "Create the Wagtail Home page so teachers can build courses under it."

    def handle(self, *args, **options):
        root = Page.get_first_root_node()
        home = HomePage.objects.first()
        if home is None:
            home = HomePage(title="آموزش", slug="lms")
            root.add_child(instance=home)
            home.save_revision().publish()
            self.stdout.write("Created HomePage")
        Site.objects.update_or_create(
            is_default_site=True,
            defaults={
                "hostname": "localhost",
                "port": 8080,
                "root_page": home,
                "site_name": "Tauditor",
            },
        )
        access_service.sync_teacher_explorer_permissions(home)
        self.stdout.write("Wagtail course root is ready.")
