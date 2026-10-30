from django.core.management.base import BaseCommand

from news.models import NewsSource
from news.services.ingest import IngestService


class Command(BaseCommand):
    help = "Run news ingest now (one source, all due sources, or a job id)."

    def add_arguments(self, parser):
        parser.add_argument("--source", help="Source slug.")
        parser.add_argument("--job", type=int, help="Existing FetchJob id.")
        parser.add_argument(
            "--due",
            action="store_true",
            help="Honor panel settings: no-op in manual mode; run if the scheduled interval elapsed.",
        )

    def handle(self, *args, **options):
        service = IngestService()
        if options.get("job"):
            job = service.run_job(options["job"])
            self.stdout.write(f"job {job.pk} {job.status} new={job.new_count}")
            return
        if options.get("due"):
            n = service.run_due()
            self.stdout.write(f"scheduled runs started: {n}")
            return
        slug = options.get("source")
        source = NewsSource.objects.get(slug=slug) if slug else None
        job = service.queue_job(source=source, delay=False)
        self.stdout.write(f"job {job.pk} {job.status} found={job.found_count} new={job.new_count}")
