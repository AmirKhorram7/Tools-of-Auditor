from __future__ import annotations

import logging

import httpx
from django.conf import settings
from django.core.cache import cache

from news.models import Article, TranslationStatus

log = logging.getLogger("news")

CACHE_TTL = 30 * 24 * 3600
PROMPT = (
    "Translate the following news title and summary into natural Persian (Farsi). "
    "Keep product names, model names, company names and technical terms in Latin script "
    "when that is how they are normally written (Claude, GPT-4, OpenAI, PyTorch, …). "
    "Return exactly two lines: TITLE: ... then SUMMARY: ..."
)


class TranslationService:
    def translate_article(self, article_id: int) -> Article:
        article = Article.objects.get(pk=article_id)
        if article.translation_status == TranslationStatus.DONE and article.title_fa:
            return article
        if article.language == "fa":
            article.title_fa = article.title
            article.summary_fa = article.summary
            article.translation_status = TranslationStatus.DONE
            article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
            return article

        cache_key = f"news:tr:{article.content_hash}"
        cached = cache.get(cache_key)
        if cached:
            article.title_fa = cached.get("title_fa", "")
            article.summary_fa = cached.get("summary_fa", "")
            article.translation_status = TranslationStatus.DONE
            article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
            return article

        provider = getattr(settings, "NEWS_TRANSLATE_PROVIDER", "anthropic")
        key = getattr(settings, "NEWS_ANTHROPIC_API_KEY", "") or ""
        if provider != "test" and not key:
            article.translation_status = TranslationStatus.SKIPPED
            article.save(update_fields=["translation_status"])
            return article
        try:
            title_fa, summary_fa = self._call_provider(provider, article.title, article.summary)
        except Exception as exc:  # noqa: BLE001
            log.warning("translate failed article=%s: %s", article.pk, exc)
            article.translation_status = TranslationStatus.FAILED
            article.save(update_fields=["translation_status"])
            return article

        article.title_fa = title_fa[:400]
        article.summary_fa = summary_fa[:4000]
        article.translation_status = TranslationStatus.DONE
        article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
        cache.set(cache_key, {"title_fa": article.title_fa, "summary_fa": article.summary_fa}, CACHE_TTL)
        return article

    def _call_provider(self, provider: str, title: str, summary: str) -> tuple[str, str]:
        if provider == "test":
            return f"{title} [fa]", (summary or title)
        key = getattr(settings, "NEWS_ANTHROPIC_API_KEY", "") or ""
        if not key:
            raise RuntimeError("NEWS_ANTHROPIC_API_KEY is not set")
        model = getattr(settings, "NEWS_ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        user = f"TITLE: {title}\nSUMMARY: {summary or title}"
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 800,
                "messages": [{"role": "user", "content": f"{PROMPT}\n\n{user}"}],
            },
            timeout=40.0,
        )
        response.raise_for_status()
        data = response.json()
        text = ""
        for block in data.get("content") or []:
            if block.get("type") == "text":
                text += block.get("text") or ""
        return _parse_translated(text, title, summary)


def _parse_translated(text: str, fallback_title: str, fallback_summary: str) -> tuple[str, str]:
    title = ""
    summary = ""
    for line in (text or "").splitlines():
        raw = line.strip()
        if raw.upper().startswith("TITLE:"):
            title = raw.split(":", 1)[1].strip()
        elif raw.upper().startswith("SUMMARY:"):
            summary = raw.split(":", 1)[1].strip()
    if not title:
        title = fallback_title
    if not summary:
        summary = fallback_summary
    return title, summary


