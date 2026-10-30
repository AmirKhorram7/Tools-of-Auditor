# News (AI panel) — backend

Global, not tenant-scoped. Access is the Django group **News Team** (`news.constants.NEWS_GROUP_NAME`) plus superusers. Superusers add/remove people from that group in Django admin.

Product UI: `/news` and `/news/settings`. Full map (tech, usage, permissions, code): [`app-knowledge/news.md`](../app-knowledge/news.md).

HTTP API: `/api/v1/news/` (Swagger when `ENABLE_API_DOCS=true`).

## Fetch schedule (settings page)

`GET/PATCH /api/v1/news/panel/` is the operator control. News Team can read it; **only superusers can PATCH**.

| `fetch_mode` | What happens |
| --- | --- |
| `manual` (default) | Beat does nothing. Superuser starts a job with `POST /api/v1/news/jobs/`. |
| `scheduled` | Beat ticks every 15 minutes. When `interval_hours` have passed since the last scheduled run, it starts **one** job for every active source. `24` = daily. |

`interval_hours` is 1–168. `interval_presets` on the GET payload is what the settings page should offer (1, 3, 6, 12, 24, 48, 72, 168).

Manual **Update news** (settings popup, superuser): `GET /api/v1/news/freshness/` checks if active sources are still fresh. `POST /api/v1/news/jobs/` with `force:false` (default) returns `409` + `message_key=up_to_date` when nothing needs polling; pass `force:true` to run anyway.

User language (`en` / `fa`) stays on `GET/PATCH /api/v1/news/settings/` — that is per-user, not the fetch schedule.

Django admin → **News panel settings** is a backup editor, also superuser-only.

## ClickHouse warehouse (ML / history)

Postgres stays the live app database. `news/services/warehouse/` copies articles off-peak.

`GET/PATCH /api/v1/news/warehouse/` and `POST /api/v1/news/warehouse/sync/` are **superuser only** (News Team gets 403 even on GET). Default `enabled=false`.

| Field | Meaning |
| --- | --- |
| `interval_hours` | 24, 48, 72, 168 (weekly), 720 (monthly) |
| `run_hour` / `run_minute` | Clock in `TIME_ZONE` (`Asia/Tehran`). Default 02:00. Beat ticks every 15 minutes and only fires inside that window. |
| Copy | `id > max(id)` already in ClickHouse, plus rows with `updated_at` after the last run. No article row locks. |

`python manage.py sync_news_warehouse` copies now; `--due` honors the window.

Cards still show title + summary. `Article.body` is stored for the warehouse and is **not** on the article list/detail API.

Story detail: `GET /api/v1/news/articles/{id}/` returns brief, key_points, paragraphs (excerpts), why_it_matters, entities, related, prev/next. `fetch_trace` is staff/superuser only. UI route: `/news/{id}`.

Env: `CLICKHOUSE_HOST` (empty = job records an error and copies nothing), `CLICKHOUSE_DB=tauditor_news`. Compose service `clickhouse` is internal only.

## Run ingest

```
python manage.py fetch_news --due          # honors panel settings (no-op if manual)
python manage.py fetch_news --source anthropic-news
python manage.py fetch_news --source openai-news
python manage.py fetch_news --job 12
python manage.py sync_news_warehouse       # Postgres → ClickHouse now
```

Celery (Redis db 2): `news-worker` + `news-beat` in compose (`celery -A ta_code.celery`). Beat polls the schedule every 15 minutes and pending translations every 10. Fetch never waits on translation. **Scheduled mode needs beat running.**

## Add a source

1. Django admin → News sources, or a data migration using the same fields as `news/services/catalog.py`.
2. Set `source_type`: `rss` / `atom` (preferred), `sitemap`, `api`, `html`.
3. `feed_url` is the document to pull. `config` holds selectors / `api_kind`.
4. Leave `is_active` off until the URL returns a usable feed.

## Add a fetcher

1. Subclass `news.services.fetchers.base.BaseFetcher`.
2. Implement `fetch(source, http)` and `parse_body(source, body, base_url)` (fixtures call `parse_body` with no network).
3. Register on `FETCHERS` in `news/services/fetchers/__init__.py`.
4. Playwright is **not** in this stack; JS-only sites stay `is_active=False` or get a real feed.

## Env

| Variable | Role |
| --- | --- |
| `CELERY_BROKER_URL` | Redis db 2 by default |
| `CELERY_TASK_ALWAYS_EAGER` | `True` in tests / DEBUG so jobs run inline |
| `NEWS_ANTHROPIC_API_KEY` | Persian titles/summaries; empty → `translation_status=skipped` |
| `NEWS_TRANSLATE_PROVIDER` | `anthropic` (default) or `test` |
| `NEWS_ANTHROPIC_MODEL` | default Haiku |

## Seeded sources left inactive

No usable public feed at seed time (turn on in admin after verifying): `mistral`, `cohere`, `xai`, `deepseek`, `mit-csail`, `stanford-ai-lab`, `nikkei-asia-tech`, `scmp-tech`.
