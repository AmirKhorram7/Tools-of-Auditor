import logging

from ta_code.celery import app as celery_app

log = logging.getLogger("news")


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=30, retry_kwargs={"max_retries": 3})
def run_fetch_job(self, job_id: int):
    from news.services.ingest import IngestService

    return IngestService().run_job(job_id).pk


@celery_app.task
def fetch_due_sources():
    from news.services.ingest import IngestService

    return IngestService().run_due()


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=20, retry_kwargs={"max_retries": 4})
def translate_article(self, article_id: int):
    from news.services.translation import TranslationService

    return TranslationService().translate_article(article_id).pk


@celery_app.task
def sync_warehouse_if_due():
    from news.services.warehouse.sync import WarehouseSyncService

    return WarehouseSyncService().run_if_due()


@celery_app.task
def translate_pending_articles(limit: int = 30):
    from news.models import Article, TranslationStatus
    from news.services.translation import TranslationService

    ids = list(
        Article.objects.filter(translation_status=TranslationStatus.PENDING)
        .order_by("id")
        .values_list("pk", flat=True)[:limit]
    )
    service = TranslationService()
    done = 0
    for pk in ids:
        try:
            service.translate_article(pk)
            done += 1
        except Exception:
            log.exception("pending translate failed article=%s", pk)
    return done
