import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ta_code.settings")

app = Celery("tauditor")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.conf.beat_schedule = {
    "news-fetch-due": {
        "task": "news.tasks.fetch_due_sources",
        "schedule": crontab(minute="*/15"),
    },
    # Persian translation is on-demand from the story detail page — no batch beat.
    "news-warehouse-due": {
        "task": "news.tasks.sync_warehouse_if_due",
        "schedule": crontab(minute="*/15"),
    },
}
