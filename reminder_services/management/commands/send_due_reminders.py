import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from reminder_services.services.reminders import ReminderService

log = logging.getLogger("reminder_services")


class Command(BaseCommand):
    help = "Send reminders whose time has come. Use --loop for the worker container."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="Keep running.")
        parser.add_argument("--interval", type=int, default=30, help="Seconds between runs.")

    def handle(self, *args, **options):
        service = ReminderService()
        while True:
            try:
                count = service.send_due()
                if count:
                    log.info("handled %s reminder(s)", count)
            except Exception:  # noqa: BLE001 - keep the worker alive
                log.exception("reminder run failed")
            finally:
                close_old_connections()
            if not options["loop"]:
                break
            time.sleep(max(5, options["interval"]))
