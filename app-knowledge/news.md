# AI Signal (news)

Private AI news room inside Tauditor. It does **not** use the navy/orange product chrome. Palette, type, language, and theme are local to this app so the rest of the company never sees it by accident.

- Product URL: `/news`
- Settings URL: `/news/settings` (superuser only)
- HTTP API: `/api/v1/news/`
- Django app: `news/`
- Next.js UI: `frontend/src/news/` plus routes under `frontend/src/app/news/`

The catalog is **global**, not tenant-scoped. There is no company, desk, or project filter. Every allowed person sees the same sources and the same articles.

---

## Who may use it

| Person | Feed `/news` | Settings `/news/settings` | Start fetch | Change fetch schedule | ClickHouse warehouse |
| --- | --- | --- | --- | --- | --- |
| Anonymous | login redirect | login redirect | 401 | 401 | 401 |
| Logged in, not in **News Team** | “invite-only” empty state; launcher tile hidden | same empty state | 403 | 403 | 403 |
| **News Team** member | yes | redirected to `/news`; Settings button hidden | 403 | GET panel yes, PATCH 403 | GET+PATCH 403 (cannot even read) |
| Django `is_staff` (not superuser) | only if also in News Team | no | 403 | 403 | 403 |
| **Superuser** | yes | yes | yes | yes | yes |

`is_staff` is **not** admin here. Fetch admin is `user.is_superuser` only (`news.permissions.user_is_news_admin`). The settings page reads `GET /news/access/` → `is_fetch_admin` and refuses to render otherwise.

Membership: Django group **`News Team`** (`news.constants.NEWS_GROUP_NAME`). Superusers add/remove people in Django admin. Non-superusers cannot edit that group (`news.admin.LockedGroupAdmin`) and cannot edit `groups` / `is_superuser` on the user admin (`user_management.admin.CustomUserAdmin.get_readonly_fields`).

Frontend hide-list (so outsiders never see a tile):

- `frontend/src/news/useAccess.ts` → dashboard card and `ServiceLauncher`
- Signal is **not** in `APP_SERVICES`. It is appended only when `allowed` is true.

---

## How to use it

### Reader (News Team)

1. Open `/news` (or the dashboard / launcher tile).
2. Search, range chips (24h / 7d / 30d / All), source chips, pulse bars (day filter).
3. Click a card or the hero → drawer. EN / فا / Both. **Read original** opens the source URL.
4. Header **EN / فا** is Signal language, stored on the user (`PATCH /news/settings/`), independent of the rest of Tauditor.
5. Theme **◐** is Signal-only (`localStorage` key `ta_signal_theme`). Default follows OS light/dark, persisted locally. It does not change platform navy/orange.

Keyboard (feed, not while typing): `/` search, `J`/`K` move, `Enter` open, `L` language, `Esc` close.

### Operator (superuser)

**Settings page** `/news/settings` — this is the real control, not Django admin. Two modules:

1. **Fetch** (`FetchModule`)
   - **Manual** (default): Celery beat does nothing. Nothing is scraped until you press **Start fetch**.
   - **Scheduled**: beat ticks every 15 minutes. When `interval_hours` have passed since the last scheduled run, it starts **one** job for every active source. `24` = daily.
   - Interval chips: 1, 3, 6, 12, 24, 48, 72, 168 hours. Only enabled in scheduled mode.
2. **ClickHouse warehouse** (`WarehouseModule`) — superuser only, and the API is superuser-only too (News Team gets `403` even on GET).
   - **Off** (default): no copy.
   - **On**: copy new articles at `run_hour`:`run_minute` in `TIME_ZONE` (`Asia/Tehran`) every 24h / 48h / 72h / weekly / monthly.
   - Pick a quiet hour (02:00 is the default) so the copy does not compete with people using the site. The job never `SELECT FOR UPDATE` on articles; it pages by `id`.
   - **Sync now** runs one incremental copy even if the schedule is off.
3. **Fetch control** (also the dashed panel on the feed via **Admin · Fetch**): source, from, to, Start fetch.
4. **Catalog**: every source, including inactive, with last status.

Django admin → News panel settings / News sources is a backup editor, also superuser-only.

---

## Architecture

```
Browser  /news  (isolated Signal chrome)
    │
    │  JWT  /api/v1/news/*
    ▼
Django  news app  (permissions → services → models)
    │
    ├─ POST /jobs/              → Celery task run_fetch_job  (Redis db 2)
    ├─ beat */15m               → fetch_due_sources  (no-op if manual)
    ├─ beat */10m               → translate_pending_articles  (never blocks fetch)
    └─ beat */15m               → sync_warehouse_if_due
         │                         (no-op if warehouse off or outside run hour)
         ▼
    ClickHouse  tauditor_news.news_articles   (ML / history; feed never reads this)
```

No websocket. Job progress is HTTP poll (~1.5s). Fetch never waits on translation.

---

## Backend: which code owns which job

| Job | Code |
| --- | --- |
| Access flag for the launcher | `news.api.v1.views.NewsAccessView` · `news.permissions.user_in_news_team` |
| Per-user EN/FA | `NewsSettingsView` · model `NewsPreference` |
| Fetch schedule singleton | `NewsPanelView` · `news.services.panel.PanelSettingsService` · model `NewsPanelSettings` (pk=1) |
| ClickHouse warehouse schedule | `NewsWarehouseView` · `news.services.warehouse.settings.WarehouseSettingsService` · model `NewsWarehouseSettings` (pk=1) |
| Incremental PG → CH copy | `WarehouseSyncService` · `news.services.warehouse.sync` · client in `warehouse/client.py` |
| Full article text | `Article.body` · `news.services.body` (feed `content:encoded`, then hydrate original URL) |
| List/filter articles | `ArticleViewSet` · `news.services.articles.ArticleQueryService` (cards: title + summary, **no body**) |
| Source catalog | `NewsSourceViewSet` · seed `news.services.catalog.SOURCE_SEED` |
| Start / list fetch jobs | `FetchJobViewSet` · `news.services.ingest.IngestService.queue_job` |
| HTTP + robots.txt + ETag | `news.services.http.NewsHttp` |
| RSS / Atom / sitemap / HTML / API | `news.services.fetchers.*` registered in `fetchers/__init__.py` |
| Dedup (canonical URL + content hash) | `news.services.normalize` · `IngestService.run_job` |
| Persian titles/summaries | `news.services.translation.TranslationService` |
| Celery tasks | `news.tasks` · beat in `ta_code/celery.py` |
| CLI ingest | `python manage.py fetch_news` |
| OpenAPI | drf-spectacular on the views; enable with `ENABLE_API_DOCS=true` |

### API map

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/v1/news/access/` | any logged-in user (`allowed`, `is_fetch_admin`, `language`) |
| GET/PATCH | `/api/v1/news/settings/` | News Team · body `{language: "en"\|"fa"}` |
| GET | `/api/v1/news/panel/` | News Team |
| PATCH | `/api/v1/news/panel/` | superuser · `{fetch_mode?, interval_hours?}` |
| GET | `/api/v1/news/sources/` | News Team · `all=1` superuser (include inactive) |
| GET | `/api/v1/news/articles/` | News Team · `q`, `source` (slug, repeatable), `date_from`/`date_to`, `category`, `region` |
| GET | `/api/v1/news/articles/{id}/` | News Team |
| POST | `/api/v1/news/jobs/` | superuser · `{source_id?, date_from?, date_to?}` |
| GET | `/api/v1/news/jobs/` · `/jobs/{id}/` | superuser |
| GET/PATCH | `/api/v1/news/warehouse/` | **superuser only** · `{enabled?, interval_hours?, run_hour?, run_minute?}` |
| POST | `/api/v1/news/warehouse/sync/` | **superuser only** · copy now (incremental) |

Default `fetch_mode` is **manual** so a fresh deploy does not scrape the internet until a superuser opts in. Warehouse `enabled` is also **off** until a superuser turns it on.

### Fetch pipeline

1. Superuser POST `/jobs/` **or** beat calls `PanelSettingsService.run_if_due`.
2. `IngestService` loads active sources (or one source). Per-source errors are swallowed so one dead feed cannot stop the others.
3. `NewsHttp` respects robots.txt, `If-None-Match` / `If-Modified-Since`, and a small per-host delay. User-Agent: `TauditorNewsBot/1.0`.
4. The matching fetcher returns `RawItem`s. Items outside `date_from`/`date_to` are skipped.
5. New rows: `Article` with `title`, `summary`, and `body`. The feed card never renders `body`. RSS uses `content:encoded` / Atom `content` when present. If the feed only gave a short excerpt, ingest hydrates the original URL (robots-aware, cap 20 pages per source per job). `NEWS_HYDRATE_BODIES=false` in unit tests.
6. Translation is queued separately (title + summary only — not the full body). Empty `NEWS_ANTHROPIC_API_KEY` → `translation_status=skipped`. Provider `test` is for unit tests only.

### Warehouse pipeline (Postgres → ClickHouse)

Live traffic stays on Postgres. ClickHouse is a copy for later ML, not a read replica for the UI.

1. Superuser PATCH `/warehouse/` `{enabled: true, interval_hours: 24, run_hour: 2}` **or** press **Sync now**.
2. Beat ticks every 15 minutes (`news.tasks.sync_warehouse_if_due`). It only runs when:
   - `enabled` is true,
   - local clock is inside `[run_hour:run_minute, +15 min)` in `TIME_ZONE`,
   - `interval_hours` have elapsed since `last_synced_at`.
3. `WarehouseSyncService` asks ClickHouse `max(id)`, then copies `Article` rows with `id > that` in batches of 250. Rows already in CH whose `updated_at` moved (Persian title, later hydrate) are inserted again (`ReplacingMergeTree(synced_at)`).
4. Articles are read with `.iterator()` — no row locks. Only the one-row settings table is `select_for_update`.
5. Empty `CLICKHOUSE_HOST` → the job records `last_error` and copies nothing. Compose sets `CLICKHOUSE_HOST=clickhouse`.

DDL lives in `news/services/warehouse/schema.py`. Database `tauditor_news`, tables `news_articles` and `news_sources`.

CLI: `python manage.py sync_news_warehouse` (copy now) or `--due` (honor the window).

Add a source: Django admin or a data migration using the same fields as `catalog.py`. Leave `is_active=False` until the URL returns a usable feed. JS-only sites are not scraped (no Playwright).

Add a fetcher: subclass `BaseFetcher`, implement `fetch` and `parse_body`, register on `FETCHERS`.

---

## Frontend: which code owns which job

Isolated on purpose. Routes live **outside** `app/(app)/` so TopBar, footer, and platform CSS never wrap Signal.

| Job | Code |
| --- | --- |
| Scoped designer CSS (dark `#07080c` / lime `#b8ff5c`; light `#f4f5f9` / purple `#5b2bff`) | `frontend/src/news/signal.css` on `.signal-root` |
| Auth gate + Signal provider | `SignalGate.tsx` · `SignalContext.tsx` |
| Invite-only empty state | `SignalShell.tsx` |
| Header: logo, Admin·Fetch, Settings, theme, EN/FA | `SignalHeader.tsx` |
| Feed, hero, chips, keyboard, URL filters | `SignalFeed.tsx` |
| Article drawer | `SignalDrawer.tsx` |
| Fetch panel | `SignalAdmin.tsx` |
| Superuser settings (composer) | `SignalSettings.tsx` |
| Fetch schedule module | `frontend/src/news/settings/FetchModule.tsx` |
| ClickHouse interval module | `frontend/src/news/settings/WarehouseModule.tsx` |
| API client | `frontend/src/news/api.ts` |
| Copy (EN/FA, independent of `lib/i18n`) | `copy.ts` |
| Source colours | `colors.ts` |
| Lightweight `allowed` for dashboard/launcher | `useAccess.ts` |
| Routes | `frontend/src/app/news/layout.tsx`, `page.tsx`, `settings/page.tsx` |

URL state (shareable): `q`, `range` (omit when 30d), `source`, `day`, `open`. Range/search are applied on a loaded window of articles (API max 50/page, feed loads up to 4 pages). Source chips stay visible for the current range even when one source is selected.

Fonts: Space Grotesk (`--font-signal` on the news layout) + Vazirmatn from the root layout.

`robots: noindex` on the news layout. This room is not a public page.

---

## Env

| Variable | Role |
| --- | --- |
| `CELERY_BROKER_URL` | Redis **db 2** (cache stays on db 1) |
| `CELERY_RESULT_BACKEND` | same |
| `CELERY_TASK_ALWAYS_EAGER` | `True` in tests / DEBUG so jobs run in-process |
| `NEWS_ANTHROPIC_API_KEY` | Persian translation; empty → skip |
| `NEWS_TRANSLATE_PROVIDER` | `anthropic` (default) or `test` |
| `NEWS_ANTHROPIC_MODEL` | default Haiku |
| `NEWS_HYDRATE_BODIES` | follow original URL when the feed excerpt is short; off in unit tests |
| `CLICKHOUSE_HOST` | empty = warehouse disabled at the client; compose sets `clickhouse` |
| `CLICKHOUSE_PORT` | HTTP `8123` |
| `CLICKHOUSE_DB` | `tauditor_news` |
| `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` | warehouse user |

Compose services: `news-worker` and `news-beat` (`celery -A ta_code.celery`). Scheduled mode needs beat running. Worker/beat set `SKIP_STARTUP_MIGRATE=1`; the API container still runs `migrate` on start.

---

## Tests (permissions + settings)

```
# Host venv, sqlite (avoids Docker DNS for Postgres)
$env:DB_ENGINE="sqlite"
python manage.py test news
```

Last run: **39 tests, OK** (host sqlite).

Settings / permission cases that must stay green:

| Test | Guarantee |
| --- | --- |
| `test_anonymous_is_401` | no token, no panel |
| `test_outsider_access_flag_but_articles_403` | `allowed=false`; articles/settings/jobs 403 |
| `test_member_reads_but_cannot_fetch` | member GET panel 200, PATCH/POST jobs 403 |
| `test_staff_without_group_is_blocked` | `is_staff` alone is not membership |
| `test_staff_even_in_news_team_cannot_write_settings` | staff in News Team: `is_fetch_admin=false`, PATCH panel 403, jobs 403, inactive `?all=1` 403 |
| `test_outsider_cannot_read_panel` | outsider GET+PATCH panel 403 |
| `test_default_is_manual` | member `can_edit=false`; superuser `can_edit=true` |
| `test_superuser_sets_daily_schedule` | PATCH `{scheduled, 24}` writes singleton |
| `test_switch_back_to_manual` | beat becomes no-op |
| `test_rejects_bad_interval` | 0, 200, `"hourly"` → 400 |
| `test_access_panel_language_sources_job_articles` | superuser happy path: panel, language, sources, job, articles, warehouse PATCH, **no `body` on list** |
| `test_html_skips_section_links_and_scans_payload` | Anthropic-style listing drops `/news/announcements`, keeps article slugs from HTML + JSON |
| `test_ingest_stores_feed_body` | ingest writes `Article.body` |
| `test_hydrate_fills_short_feed` | short RSS excerpt is replaced when hydrate returns a long body |
| `test_incremental_copy_then_only_new_rows` | warehouse copies new ids only |
| `test_updated_row_is_rewritten` | CH row is replaced when Postgres `updated_at` moves |
| `test_disabled_skips` / `test_disabled_never_due` | off = no copy |
| `test_due_only_inside_run_window` | 02:03 due, 03:00 not |
| `test_only_superuser_can_see_or_change_warehouse` | member/staff GET+PATCH+sync 403; superuser PATCH presets only |

Frontend typecheck: `npm run typecheck` in `frontend/` (includes `/news` and `/news/settings`).

---

## Run

### Host (this machine, no Compose)

Backend tests as above. Frontend: `cd frontend && npm run dev` then open `/news` (API at `NEXT_PUBLIC_API_BASE_URL`, default `/api/v1` or `http://127.0.0.1:8000/api/v1`).

Apply migrations once on the real database:

```
python manage.py migrate news
```

### Docker Compose

Hub images (Postgres, Redis, nginx, Grafana) use `pull_policy: missing`. Local API/frontend images are tagged `ta_code-backend:latest` / `ta_code-frontend:latest` with `pull_policy: never`. ClickHouse is **built locally** (`ta_code-clickhouse:local`) from `python:3.13-slim` so this network never `docker pull`s `clickhouse/clickhouse-server` (Hub/GCR TLS often times out). `news-worker`, `news-beat`, and `reminder-worker` **reuse** the backend image — they are not built again.

```
# Daily start — no Hub downloads, no rebuild
docker compose up -d --pull missing --no-build

# After code change — rebuild local layers only (python/node bases stay on disk)
docker compose build --pull never backend frontend
docker compose up -d --no-build
```

Do **not** run `docker compose up -d --build` every boot. `--build` rebuilds Dockerfiles (pip/npm cache still helps) and is slower than starting the images you already have. It does **not** re-pull Hub images in this compose file.

ClickHouse is internal (`clickhouse` service, no public port). Backend migrate on start applies `news.0005_article_body_warehouse` and `news.0006_refresh_catalog`.

Open `http://127.0.0.1:8080/news` as a superuser.

Live ingest (inside the API container):

```
docker compose exec backend python manage.py fetch_news --source anthropic-news
docker compose exec backend python manage.py sync_news_warehouse
```

---

## Review notes

What is solid:

- Secret surface is actually secret: own route tree, own CSS, own locale, tile gated on `allowed`.
- Write path for scraping is superuser-only. Staff is not treated as admin. Manual default means production does not crawl until someone opts in.
- One global schedule, not per-source beat math. Interval 24h is daily; beat only ticks the clock.
- Fetch isolation: one source failing does not abort the job. Dedup is URL + content hash. Translation is async.
- Permissions are tested at the API, which is what the settings page actually calls.

Watch:

- The feed loads at most 200 newest articles in the selected range, then filters in the browser. Deep history search needs a larger page budget or server-side `q` while chips stay range-scoped.
- The running **backend image** must include the `news` app. A failed pip rebuild leaves an old image without `/api/v1/news/`. The Next image can be ahead of Django; `/news` then shows invite-only or errors until the API container is updated and migrated.
- `NEWS_ANTHROPIC_API_KEY` empty is correct for “no translation”, not a bug. Persian columns stay blank until a key is set and pending tasks run.
- Do not “fix” Signal into tenant/company scope. The product decision is global on purpose.
