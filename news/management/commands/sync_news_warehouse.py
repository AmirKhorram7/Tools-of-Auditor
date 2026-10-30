from django.core.management.base import BaseCommand

from news.services.warehouse.sync import WarehouseSyncService


class Command(BaseCommand):
    help = "Copy new news rows from Postgres to ClickHouse (incremental, no article locks)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--due",
            action="store_true",
            help="Honor warehouse settings: no-op if off or outside the run-hour window.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Copy now even if the schedule is off (superuser CLI equivalent of Sync now).",
        )

    def handle(self, *args, **options):
        service = WarehouseSyncService()
        if options.get("due"):
            result = service.run_if_due()
        else:
            result = service.sync(force=True)
        self.stdout.write(
            "warehouse ok={ok} skipped={skipped} copied={copied} reason={reason} error={error}".format(
                ok=result.get("ok"),
                skipped=result.get("skipped"),
                copied=result.get("copied", 0),
                reason=result.get("reason", ""),
                error=result.get("error", ""),
            )
        )
