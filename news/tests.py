"""News API: permissions, fetchers (fixtures, no live network), dedup, jobs, translation."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from news.constants import FETCH_MODE_MANUAL, FETCH_MODE_SCHEDULED, NEWS_GROUP_NAME
from news.models import (
    Article,
    FetchJob,
    FetchStatus,
    JobStatus,
    JobTrigger,
    NewsPanelSettings,
    NewsSource,
    NewsWarehouseSettings,
    SourceType,
    TranslationStatus,
)
from news.services.panel import PanelSettingsService
from news.services.warehouse.client import MemoryClient
from news.services.warehouse.settings import WarehouseSettingsService, is_due
from news.services.warehouse.sync import WarehouseSyncService
from news.services.fetchers.api import APIFetcher
from news.services.fetchers.html import HTMLFetcher
from news.services.fetchers.rss import RSSFetcher
from news.services.fetchers.sitemap import SitemapFetcher
from news.services.http import NewsHttp, NotModified
from news.services.ingest import IngestService
from news.services.normalize import content_hash
from news.services.translation import TranslationService

User = get_user_model()
API = "/api/v1/news"

RSS_XML = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Demo</title>
    <item>
      <title>Claude 4 ships</title>
      <link>https://example.com/claude-4</link>
      <description>A new model from Anthropic.</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <author>Labs</author>
    </item>
    <item>
      <title>Old note</title>
      <link>https://example.com/old</link>
      <description>Ancient.</description>
      <pubDate>Wed, 01 Jan 2020 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""

SITEMAP_XML = """<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://example.com/s1</loc>
    <news:news>
      <news:title>Sitemap story</news:title>
      <news:publication_date>2024-02-02T00:00:00Z</news:publication_date>
    </news:news>
  </url>
</urlset>
"""

HTML_PAGE = """
<html><body>
<article>
  <a href="/post-one">First post</a>
  <p>Excerpt one</p>
  <time datetime="2024-03-03T00:00:00Z">Mar 3</time>
</article>
</body></html>
"""

JSON_FEED = """{"hits":[{"url":"https://example.com/j1","title":"JSON hit","summary":"From API","published_at":"2024-04-04T00:00:00Z"}]}"""

RSS_FULL = """<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Demo</title>
    <item>
      <title>Full Claude brief</title>
      <link>https://example.com/full-brief</link>
      <description>Card excerpt only.</description>
      <content:encoded><![CDATA[<article><p>The complete brief on Claude 4 covers training data, evals, safety, and deployment notes that a card excerpt cannot hold. This paragraph is the warehouse body.</p></article>]]></content:encoded>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""


def _user(phone, **extra):
    return User.objects.create_user(
        phone_number=phone,
        password="News#2026",
        first_name="N",
        is_phone_verified=True,
        **extra,
    )


def _client_for(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(user).access_token)}")
    return client


class NewsPermissionTests(APITestCase):
    def setUp(self):
        self.group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.outsider = _user("09121110001")
        self.member = _user("09121110002")
        self.member.groups.add(self.group)
        self.admin = _user("09121110003", is_staff=True, is_superuser=True)
        self.outsider_c = _client_for(self.outsider)
        self.member_c = _client_for(self.member)
        self.admin_c = _client_for(self.admin)

    def test_anonymous_is_401(self):
        self.assertEqual(self.client.get(f"{API}/access/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(f"{API}/articles/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_outsider_access_flag_but_articles_403(self):
        res = self.outsider_c.get(f"{API}/access/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["allowed"])
        self.assertEqual(self.outsider_c.get(f"{API}/articles/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.outsider_c.get(f"{API}/settings/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.outsider_c.post(f"{API}/jobs/", {}).status_code, status.HTTP_403_FORBIDDEN)

    def test_member_reads_but_cannot_fetch(self):
        self.assertTrue(self.member_c.get(f"{API}/access/").data["allowed"])
        self.assertEqual(self.member_c.get(f"{API}/articles/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.member_c.get(f"{API}/sources/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.member_c.get(f"{API}/panel/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.member_c.post(f"{API}/jobs/", {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.member_c.patch(f"{API}/panel/", {"fetch_mode": "scheduled"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.member_c.get(f"{API}/warehouse/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.member_c.patch(f"{API}/warehouse/", {"enabled": True}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_staff_without_group_is_blocked(self):
        staff = _user("09121110004", is_staff=True)
        client = _client_for(staff)
        self.assertFalse(client.get(f"{API}/access/").data["allowed"])
        self.assertEqual(client.get(f"{API}/articles/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(client.post(f"{API}/jobs/", {}).status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_can_start_job(self):
        with patch("news.tasks.run_fetch_job.delay"):
            res = self.admin_c.post(f"{API}/jobs/", {"source_id": None}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(FetchJob.objects.count(), 1)

    def test_language_persists(self):
        res = self.member_c.patch(f"{API}/settings/", {"language": "fa"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.member_c.get(f"{API}/settings/").data["language"], "fa")
        self.assertEqual(self.admin_c.get(f"{API}/settings/").data["language"], "en")


class FetcherFixtureTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(
            name="Demo",
            slug="demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
            source_type=SourceType.RSS,
        )

    def test_rss(self):
        items = RSSFetcher().parse_body(self.source, RSS_XML)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].title, "Claude 4 ships")
        self.assertTrue(items[0].url.endswith("/claude-4"))

    def test_rss_keeps_full_content(self):
        items = RSSFetcher().parse_body(self.source, RSS_FULL)
        self.assertEqual(items[0].summary, "Card excerpt only.")
        self.assertIn("complete brief on Claude 4", items[0].body)
        self.assertGreater(len(items[0].body), len(items[0].summary))

    def test_sitemap(self):
        self.source.source_type = SourceType.SITEMAP
        items = SitemapFetcher().parse_body(self.source, SITEMAP_XML)
        self.assertEqual(items[0].title, "Sitemap story")

    def test_html(self):
        self.source.source_type = SourceType.HTML
        self.source.config = {"item_selector": "article"}
        items = HTMLFetcher().parse_body(self.source, HTML_PAGE, "https://example.com/")
        self.assertEqual(items[0].title, "First post")
        self.assertTrue(items[0].url.endswith("/post-one"))

    def test_html_skips_section_links_and_scans_payload(self):
        self.source.source_type = SourceType.HTML
        self.source.base_url = "https://www.anthropic.com/news"
        self.source.feed_url = "https://www.anthropic.com/news"
        self.source.config = {
            "item_selector": "a[href*='/news/']",
            "link_pattern": r"/news/[A-Za-z0-9][A-Za-z0-9-]{2,}",
            "skip_slugs": ["announcements"],
            "scan_html": True,
        }
        html = """
        <html><body>
          <a href="/news/announcements">Announcements</a>
          <a href="/news/barclays-scales-claude">Barclays scales Claude</a>
          <script>{"url":"/news/2026-usage-policy-update"}</script>
        </body></html>
        """
        items = HTMLFetcher().parse_body(self.source, html, "https://www.anthropic.com/news")
        urls = [item.url for item in items]
        self.assertTrue(any(u.endswith("/barclays-scales-claude") for u in urls))
        self.assertTrue(any(u.endswith("/2026-usage-policy-update") for u in urls))
        self.assertFalse(any(u.rstrip("/").endswith("/announcements") for u in urls))

    def test_json_api(self):
        self.source.source_type = SourceType.API
        self.source.config = {"list_path": "hits"}
        items = APIFetcher().parse_body(self.source, JSON_FEED)
        self.assertEqual(items[0].title, "JSON hit")


class IngestDedupTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(
            name="Demo",
            slug="demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
            source_type=SourceType.RSS,
            is_active=True,
        )

    def test_dedup_and_date_range(self):
        service = IngestService()
        http = NewsHttp(respect_robots=False)

        class Dummy:
            def fetch(self, source, client):
                return RSSFetcher().parse_body(source, RSS_XML)

        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            ranged = service.fetch_source(
                self.source,
                http,
                date_from=datetime(2023, 1, 1).date(),
                date_to=datetime(2024, 12, 31).date(),
            )
        self.assertEqual(ranged["new"], 1)
        self.assertEqual(Article.objects.count(), 1)
        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            full = service.fetch_source(self.source, http)
        self.assertEqual(full["new"], 1)
        self.assertGreaterEqual(full["skipped"], 1)
        self.assertEqual(Article.objects.count(), 2)
        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            again = service.fetch_source(self.source, http)
        self.assertEqual(again["new"], 0)
        article = Article.objects.get(url__endswith="claude-4")
        self.assertEqual(article.content_hash, content_hash(article.title, article.summary, article.url))
        self.assertTrue(article.body)

    def test_not_modified(self):
        service = IngestService()
        http = NewsHttp(respect_robots=False)

        class Dummy:
            def fetch(self, source, client):
                raise NotModified()

        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            counts = service.fetch_source(self.source, http)
        self.assertEqual(counts["new"], 0)
        self.source.refresh_from_db()
        self.assertEqual(self.source.last_status, FetchStatus.NOT_MODIFIED)


class TranslationTests(TestCase):
    def setUp(self):
        source = NewsSource.objects.create(
            name="Demo",
            slug="demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
        )
        self.article = Article.objects.create(
            source=source,
            url="https://example.com/a",
            canonical_url="https://example.com/a",
            title="Hello Claude",
            summary="A model.",
            fetched_at=datetime.now(timezone.utc),
            content_hash="abc",
            translation_status=TranslationStatus.PENDING,
        )

    def test_provider_test_fills_fa(self):
        with self.settings(NEWS_TRANSLATE_PROVIDER="test", NEWS_ANTHROPIC_API_KEY=""):
            TranslationService().translate_article(self.article.pk)
        self.article.refresh_from_db()
        self.assertEqual(self.article.translation_status, TranslationStatus.DONE)
        self.assertIn("[fa]", self.article.title_fa)

    def test_missing_key_skips(self):
        with self.settings(NEWS_TRANSLATE_PROVIDER="anthropic", NEWS_ANTHROPIC_API_KEY=""):
            TranslationService().translate_article(self.article.pk)
        self.article.refresh_from_db()
        self.assertEqual(self.article.translation_status, TranslationStatus.SKIPPED)


class UserAdminLockTests(TestCase):
    def test_groups_readonly_for_staff(self):
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory

        from user_management.admin import CustomUserAdmin
        from user_management.models import CustomUser

        staff = _user("09121110010", is_staff=True)
        superuser = _user("09121110011", is_staff=True, is_superuser=True)
        model_admin = CustomUserAdmin(CustomUser, AdminSite())
        factory = RequestFactory()
        staff_req = factory.get("/")
        staff_req.user = staff
        super_req = factory.get("/")
        super_req.user = superuser
        self.assertIn("groups", model_admin.get_readonly_fields(staff_req, staff))
        self.assertIn("user_permissions", model_admin.get_readonly_fields(staff_req, staff))
        self.assertNotIn("groups", model_admin.get_readonly_fields(super_req, superuser))


class FetchJobApiTests(APITestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.admin = _user("09121110999", is_staff=True, is_superuser=True)
        self.client_a = _client_for(self.admin)
        self.source = NewsSource.objects.create(
            name="Demo",
            slug="demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
            is_active=True,
        )

    def test_job_runs_eager_and_lists(self):
        class Dummy:
            def fetch(self, source, client):
                return RSSFetcher().parse_body(source, RSS_XML)

        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            res = self.client_a.post(
                f"{API}/jobs/",
                {"source_id": self.source.id, "date_from": "2023-01-01", "date_to": "2025-01-01"},
                format="json",
            )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        job = FetchJob.objects.get()
        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.DONE)
        listing = self.client_a.get(f"{API}/articles/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        rows = listing.data["results"] if isinstance(listing.data, dict) else listing.data
        self.assertTrue(any("Claude" in row["title"] for row in rows))
        q = self.client_a.get(f"{API}/articles/", {"q": "Claude", "source": "demo"})
        rows = q.data["results"] if isinstance(q.data, dict) else q.data
        self.assertEqual(len(rows), 1)
        job.refresh_from_db()
        self.assertEqual(job.trigger, JobTrigger.MANUAL)


class NewsPanelSettingsTests(APITestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.member = _user("09121112001")
        self.member.groups.add(group)
        self.admin = _user("09121112002", is_staff=True, is_superuser=True)
        self.member_c = _client_for(self.member)
        self.admin_c = _client_for(self.admin)
        PanelSettingsService().load()

    def test_default_is_manual(self):
        res = self.admin_c.get(f"{API}/panel/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["fetch_mode"], FETCH_MODE_MANUAL)
        self.assertEqual(res.data["interval_hours"], 24)
        self.assertIsNone(res.data["next_run_at"])
        self.assertTrue(res.data["can_edit"])
        self.assertIn(24, res.data["interval_presets"])
        member = self.member_c.get(f"{API}/panel/")
        self.assertFalse(member.data["can_edit"])

    def test_superuser_sets_daily_schedule(self):
        res = self.admin_c.patch(
            f"{API}/panel/",
            {"fetch_mode": FETCH_MODE_SCHEDULED, "interval_hours": 24},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["fetch_mode"], FETCH_MODE_SCHEDULED)
        self.assertEqual(res.data["interval_hours"], 24)
        self.assertIsNotNone(res.data["next_run_at"])
        row = NewsPanelSettings.objects.get(pk=1)
        self.assertEqual(row.updated_by_id, self.admin.pk)

    def test_switch_back_to_manual(self):
        self.admin_c.patch(f"{API}/panel/", {"fetch_mode": FETCH_MODE_SCHEDULED, "interval_hours": 6}, format="json")
        res = self.admin_c.patch(f"{API}/panel/", {"fetch_mode": FETCH_MODE_MANUAL}, format="json")
        self.assertEqual(res.data["fetch_mode"], FETCH_MODE_MANUAL)
        self.assertIsNone(res.data["next_run_at"])
        self.assertEqual(res.data["interval_hours"], 6)

    def test_rejects_bad_interval(self):
        res = self.admin_c.patch(f"{API}/panel/", {"interval_hours": 0}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.admin_c.patch(f"{API}/panel/", {"interval_hours": 200}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.admin_c.patch(f"{API}/panel/", {"fetch_mode": "hourly"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_outsider_cannot_read_panel(self):
        outsider = _client_for(_user("09121112003"))
        self.assertEqual(outsider.get(f"{API}/panel/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            outsider.patch(f"{API}/panel/", {"fetch_mode": FETCH_MODE_SCHEDULED}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_staff_even_in_news_team_cannot_write_settings(self):
        """Settings page is superuser-only. Django is_staff is not enough."""
        group = Group.objects.get(name=NEWS_GROUP_NAME)
        staff = _user("09121112004", is_staff=True)
        staff.groups.add(group)
        client = _client_for(staff)
        access = client.get(f"{API}/access/")
        self.assertTrue(access.data["allowed"])
        self.assertFalse(access.data["is_fetch_admin"])
        self.assertEqual(client.get(f"{API}/panel/").status_code, status.HTTP_200_OK)
        self.assertFalse(client.get(f"{API}/panel/").data["can_edit"])
        self.assertEqual(
            client.patch(f"{API}/panel/", {"fetch_mode": FETCH_MODE_SCHEDULED}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(client.post(f"{API}/jobs/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(client.get(f"{API}/jobs/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(client.get(f"{API}/warehouse/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            client.patch(f"{API}/warehouse/", {"enabled": True}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(client.post(f"{API}/warehouse/sync/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(NewsPanelSettings.objects.get(pk=1).fetch_mode, FETCH_MODE_MANUAL)

    def test_member_jobs_and_inactive_sources_stay_closed(self):
        self.assertEqual(self.member_c.get(f"{API}/jobs/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.member_c.get(f"{API}/sources/?all=1").status_code, status.HTTP_403_FORBIDDEN)


class ScheduledFetchTests(TestCase):
    def setUp(self):
        self.panel = PanelSettingsService().load()

    def test_manual_mode_never_auto_runs(self):
        self.panel.fetch_mode = FETCH_MODE_MANUAL
        self.panel.save()
        with patch("news.services.ingest.IngestService.run_job") as run_job:
            self.assertEqual(IngestService().run_due(), 0)
        run_job.assert_not_called()
        self.assertEqual(FetchJob.objects.count(), 0)

    def test_scheduled_runs_once_then_waits(self):
        self.panel.fetch_mode = FETCH_MODE_SCHEDULED
        self.panel.interval_hours = 24
        self.panel.last_scheduled_at = None
        self.panel.save()
        with patch("news.services.ingest.IngestService.run_job"):
            self.assertEqual(PanelSettingsService().run_if_due(), 1)
            self.assertEqual(PanelSettingsService().run_if_due(), 0)
        job = FetchJob.objects.get()
        self.assertEqual(job.trigger, JobTrigger.SCHEDULED)
        self.assertIsNone(job.source_id)

    def test_due_after_interval(self):
        self.panel.fetch_mode = FETCH_MODE_SCHEDULED
        self.panel.interval_hours = 24
        self.panel.last_scheduled_at = datetime.now(timezone.utc) - timedelta(hours=25)
        self.panel.save()
        with patch("news.services.ingest.IngestService.run_job"):
            self.assertEqual(PanelSettingsService().run_if_due(), 1)
        self.panel.last_scheduled_at = datetime.now(timezone.utc) - timedelta(hours=2)
        self.panel.save()
        with patch("news.services.ingest.IngestService.run_job"):
            self.assertEqual(PanelSettingsService().run_if_due(), 0)


class NewsBackendSmokeTests(APITestCase):
    """Operating path a superuser hits on the future settings + list pages."""

    def setUp(self):
        group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.admin = _user("09121113001", is_staff=True, is_superuser=True)
        self.client_a = _client_for(self.admin)
        self.source = NewsSource.objects.create(
            name="Smoke",
            slug="smoke-demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
            is_active=True,
        )
        NewsSource.objects.exclude(pk=self.source.pk).update(is_active=False)

    def test_access_panel_language_sources_job_articles(self):
        access = self.client_a.get(f"{API}/access/")
        self.assertTrue(access.data["allowed"])
        self.assertTrue(access.data["is_fetch_admin"])

        panel = self.client_a.patch(
            f"{API}/panel/",
            {"fetch_mode": FETCH_MODE_SCHEDULED, "interval_hours": 24},
            format="json",
        )
        self.assertEqual(panel.status_code, status.HTTP_200_OK, panel.data)
        self.assertEqual(panel.data["fetch_mode"], FETCH_MODE_SCHEDULED)

        lang = self.client_a.patch(f"{API}/settings/", {"language": "fa"}, format="json")
        self.assertEqual(lang.data["language"], "fa")

        sources = self.client_a.get(f"{API}/sources/")
        self.assertEqual(sources.status_code, status.HTTP_200_OK)
        rows = sources.data["results"] if isinstance(sources.data, dict) else sources.data
        self.assertTrue(any(row["slug"] == "smoke-demo" for row in rows))

        class Dummy:
            def fetch(self, source, client):
                return RSSFetcher().parse_body(source, RSS_XML)

        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            job_res = self.client_a.post(
                f"{API}/jobs/",
                {"source_id": self.source.id},
                format="json",
            )
        self.assertEqual(job_res.status_code, status.HTTP_201_CREATED, job_res.data)
        self.assertEqual(job_res.data["trigger"], JobTrigger.MANUAL)
        self.assertEqual(job_res.data["status"], JobStatus.DONE)

        articles = self.client_a.get(f"{API}/articles/", {"source": "smoke-demo"})
        rows = articles.data["results"] if isinstance(articles.data, dict) else articles.data
        self.assertGreaterEqual(len(rows), 1)

        jobs = self.client_a.get(f"{API}/jobs/")
        self.assertEqual(jobs.status_code, status.HTTP_200_OK)

        back = self.client_a.patch(f"{API}/panel/", {"fetch_mode": FETCH_MODE_MANUAL}, format="json")
        self.assertEqual(back.data["fetch_mode"], FETCH_MODE_MANUAL)
        with patch("news.services.ingest.IngestService.run_job") as run_job:
            self.assertEqual(IngestService().run_due(), 0)
        run_job.assert_not_called()

        warehouse = self.client_a.get(f"{API}/warehouse/")
        self.assertEqual(warehouse.status_code, status.HTTP_200_OK, warehouse.data)
        self.assertFalse(warehouse.data["enabled"])
        self.assertEqual(warehouse.data["interval_hours"], 24)
        self.assertEqual(warehouse.data["run_hour"], 2)
        patched = self.client_a.patch(
            f"{API}/warehouse/",
            {"enabled": True, "interval_hours": 24, "run_hour": 2, "run_minute": 0},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertTrue(patched.data["enabled"])
        rows = articles.data["results"] if isinstance(articles.data, dict) else articles.data
        self.assertNotIn("body", rows[0])
        article = Article.objects.get(url__endswith="claude-4")
        self.assertTrue(article.body)


def _article(source, slug, **extra):
    now = datetime.now(timezone.utc)
    return Article.objects.create(
        source=source,
        url=f"https://example.com/{slug}",
        canonical_url=f"https://example.com/{slug}",
        title=extra.pop("title", slug.replace("-", " ")),
        summary=extra.pop("summary", "summary"),
        body=extra.pop("body", "full body text for the warehouse"),
        fetched_at=extra.pop("fetched_at", now),
        content_hash=extra.pop("content_hash", slug),
        **extra,
    )


class ArticleBodyTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(
            name="Demo",
            slug="body-demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
            source_type=SourceType.RSS,
            is_active=True,
        )

    def test_ingest_stores_feed_body(self):
        class Dummy:
            def fetch(self, source, client):
                return RSSFetcher().parse_body(source, RSS_FULL)

        with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
            IngestService().fetch_source(self.source, NewsHttp(respect_robots=False))
        article = Article.objects.get(url__endswith="full-brief")
        self.assertEqual(article.summary, "Card excerpt only.")
        self.assertIn("complete brief on Claude 4", article.body)

    def test_hydrate_fills_short_feed(self):
        class Dummy:
            def fetch(self, source, client):
                return RSSFetcher().parse_body(source, RSS_XML)

        long_text = ("model " * 120).strip()
        with self.settings(NEWS_HYDRATE_BODIES=True):
            with patch("news.services.ingest.fetcher_for", return_value=Dummy()):
                with patch("news.services.ingest.hydrate_body", return_value=long_text) as hydrate:
                    IngestService().fetch_source(
                        self.source,
                        NewsHttp(respect_robots=False),
                        date_from=datetime(2023, 1, 1).date(),
                        date_to=datetime(2024, 12, 31).date(),
                    )
        self.assertTrue(hydrate.called)
        article = Article.objects.get(url__endswith="claude-4")
        self.assertEqual(article.body, long_text)

    def test_extract_main_text(self):
        from news.services.body import extract_main_text

        html = "<html><body><nav>skip</nav><article><p>Real story about a model release.</p></article></body></html>"
        self.assertEqual(extract_main_text(html), "Real story about a model release.")


class WarehouseSyncTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(
            name="Demo",
            slug="wh-demo",
            base_url="https://example.com/",
            feed_url="https://example.com/feed.xml",
        )
        self.memory = MemoryClient()
        self.service = WarehouseSyncService(client=self.memory)
        WarehouseSettingsService().get()

    def test_disabled_skips(self):
        _article(self.source, "skip-me")
        result = self.service.sync(force=False)
        self.assertTrue(result["skipped"])
        self.assertEqual(result["reason"], "disabled")
        self.assertEqual(len(self.memory.articles), 0)

    def test_incremental_copy_then_only_new_rows(self):
        first = _article(self.source, "one", body="body one")
        second = _article(self.source, "two", body="body two")
        result = self.service.sync(force=True)
        self.assertTrue(result["ok"])
        self.assertEqual(result["copied"], 2)
        self.assertEqual(self.memory.articles[first.pk]["body"], "body one")
        self.assertEqual(self.memory.articles[second.pk]["title"], "two")
        again = self.service.sync(force=True)
        self.assertEqual(again["copied"], 0)
        third = _article(self.source, "three", body="body three")
        later = self.service.sync(force=True)
        self.assertEqual(later["copied"], 1)
        self.assertEqual(self.memory.articles[third.pk]["body"], "body three")
        self.assertEqual(len(self.memory.articles), 3)

    def test_updated_row_is_rewritten(self):
        article = _article(self.source, "mutable", body="old body")
        self.service.sync(force=True)
        Article.objects.filter(pk=article.pk).update(
            body="new full body after translation",
            title_fa="عنوان",
            updated_at=datetime.now(timezone.utc) + timedelta(seconds=2),
        )
        result = self.service.sync(force=True)
        self.assertGreaterEqual(result["copied"], 1)
        self.assertEqual(self.memory.articles[article.pk]["body"], "new full body after translation")
        self.assertEqual(self.memory.articles[article.pk]["title_fa"], "عنوان")


class WarehouseScheduleTests(TestCase):
    def setUp(self):
        self.row = WarehouseSettingsService().get()
        self.row.enabled = True
        self.row.interval_hours = 24
        self.row.run_hour = 2
        self.row.run_minute = 0
        self.row.last_synced_at = None
        self.row.save()

    def test_disabled_never_due(self):
        self.row.enabled = False
        self.row.save()
        from zoneinfo import ZoneInfo

        now = datetime(2026, 10, 29, 2, 3, tzinfo=ZoneInfo("Asia/Tehran"))
        self.assertFalse(is_due(self.row, now))
        self.assertEqual(WarehouseSyncService(client=MemoryClient()).run_if_due()["reason"], "not_due")

    def test_due_only_inside_run_window(self):
        from zoneinfo import ZoneInfo

        tehran = ZoneInfo("Asia/Tehran")
        self.assertTrue(is_due(self.row, datetime(2026, 10, 29, 2, 3, tzinfo=tehran)))
        self.assertFalse(is_due(self.row, datetime(2026, 10, 29, 3, 0, tzinfo=tehran)))
        self.assertFalse(is_due(self.row, datetime(2026, 10, 29, 14, 0, tzinfo=tehran)))

    def test_waits_for_interval_after_a_run(self):
        from zoneinfo import ZoneInfo

        tehran = ZoneInfo("Asia/Tehran")
        now = datetime(2026, 10, 29, 2, 3, tzinfo=tehran)
        self.row.last_synced_at = now
        self.row.save()
        self.assertFalse(is_due(self.row, now))
        self.assertTrue(is_due(self.row, datetime(2026, 10, 30, 2, 3, tzinfo=tehran)))


class WarehousePermissionTests(APITestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.member = _user("09121114001")
        self.member.groups.add(group)
        self.staff = _user("09121114002", is_staff=True)
        self.staff.groups.add(group)
        self.admin = _user("09121114003", is_staff=True, is_superuser=True)
        self.member_c = _client_for(self.member)
        self.staff_c = _client_for(self.staff)
        self.admin_c = _client_for(self.admin)

    def test_only_superuser_can_see_or_change_warehouse(self):
        self.assertEqual(self.client.get(f"{API}/warehouse/").status_code, status.HTTP_401_UNAUTHORIZED)
        outsider = _client_for(_user("09121114004"))
        self.assertEqual(outsider.get(f"{API}/warehouse/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.member_c.get(f"{API}/warehouse/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.staff_c.get(f"{API}/warehouse/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.staff_c.patch(f"{API}/warehouse/", {"enabled": True}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.staff_c.post(f"{API}/warehouse/sync/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        res = self.admin_c.get(f"{API}/warehouse/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(res.data["enabled"])
        self.assertEqual(res.data["interval_presets"], [24, 48, 72, 168, 720])
        patched = self.admin_c.patch(
            f"{API}/warehouse/",
            {"enabled": True, "interval_hours": 48, "run_hour": 2, "run_minute": 0},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertTrue(patched.data["enabled"])
        self.assertEqual(patched.data["interval_hours"], 48)
        self.assertEqual(NewsWarehouseSettings.objects.get(pk=1).updated_by_id, self.admin.pk)
        bad = self.admin_c.patch(f"{API}/warehouse/", {"interval_hours": 1}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        sync = self.admin_c.post(f"{API}/warehouse/sync/", {}, format="json")
        self.assertEqual(sync.status_code, status.HTTP_200_OK, sync.data)
        self.assertEqual(sync.data["reason"], "unconfigured")
        self.assertTrue(NewsWarehouseSettings.objects.get(pk=1).enabled)

class ArticleDetailApiTests(APITestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
        self.member = _user("09121115001")
        self.member.groups.add(group)
        self.staff = _user("09121115002", is_staff=True)
        self.staff.groups.add(group)
        self.outsider = _user("09121115003")
        self.member_c = _client_for(self.member)
        self.staff_c = _client_for(self.staff)
        self.outsider_c = _client_for(self.outsider)
        self.source = NewsSource.objects.create(
            name="Anthropic",
            slug="anthropic-news",
            base_url="https://www.anthropic.com/",
            feed_url="https://www.anthropic.com/news",
            source_type=SourceType.HTML,
            category="product",
            color="#e8a87c",
            is_active=True,
        )
        now = datetime.now(timezone.utc)
        self.article = Article.objects.create(
            source=self.source,
            url="https://example.com/detail-story",
            canonical_url="https://example.com/detail-story",
            title="Detail story headline",
            summary="First sentence. Second sentence. Third sentence.",
            body=(
                "Lead paragraph about the model release for developers.\n\n"
                "Second paragraph with more context on evals and safety.\n\n"
                "Third paragraph covering what ships next."
            ),
            brief=["Point A", "Point B", "Point C"],
            brief_fa=["yek", "do", "se"],
            key_points=[
                {"title": "One", "text": "Desc one", "title_fa": "yek", "text_fa": "tozih yek"},
                {"title": "Two", "text": "Desc two", "title_fa": "do", "text_fa": "tozih do"},
                {"title": "Three", "text": "Desc three", "title_fa": "se", "text_fa": "tozih se"},
            ],
            paragraphs=[
                {"en": "Lead paragraph about the model release for developers.", "fa": "para yek."},
                {"en": "Second paragraph with more context on evals and safety.", "fa": "para do."},
            ],
            why_it_matters="This changes how teams ship agents.",
            why_it_matters_fa="why fa sentence.",
            entities=[{"type": "model", "name": "Claude"}, {"type": "org", "name": "Anthropic"}],
            reading_minutes=4,
            published_at=now,
            fetched_at=now,
            content_hash="detail-hash-1",
            translation_status=TranslationStatus.DONE,
            title_fa="title fa",
            summary_fa="summary fa.",
        )
        self.other = Article.objects.create(
            source=self.source,
            url="https://example.com/related-story",
            canonical_url="https://example.com/related-story",
            title="Related story",
            summary="Related summary.",
            body="Related body text for warehouse only.",
            published_at=now - timedelta(hours=2),
            fetched_at=now,
            content_hash="detail-hash-2",
            translation_status=TranslationStatus.PENDING,
        )

    def test_member_gets_detail_without_body_or_trace(self):
        res = self.member_c.get(f"{API}/articles/{self.article.pk}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["title"], "Detail story headline")
        self.assertEqual(res.data["source"]["color"], "#e8a87c")
        self.assertEqual(len(res.data["brief"]), 3)
        self.assertEqual(len(res.data["key_points"]), 3)
        self.assertGreaterEqual(len(res.data["paragraphs"]), 2)
        self.assertEqual(res.data["reading_minutes"], 4)
        self.assertNotIn("body", res.data)
        self.assertNotIn("fetch_trace", res.data)
        self.assertTrue(any(r["id"] == self.other.pk for r in res.data["related"]))

    def test_staff_gets_fetch_trace(self):
        res = self.staff_c.get(f"{API}/articles/{self.article.pk}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertIn("fetch_trace", res.data)
        self.assertEqual(res.data["fetch_trace"]["source_name"], "Anthropic")
        self.assertTrue(res.data["fetch_trace"]["content_hash"].startswith("detail-ha") or res.data["fetch_trace"]["content_hash"] == "detail-hash-1")

    def test_outsider_forbidden_no_leak(self):
        res = self.outsider_c.get(f"{API}/articles/{self.article.pk}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("title", res.data if isinstance(res.data, dict) else {})

    def test_ids_drive_prev_next(self):
        res = self.member_c.get(
            f"{API}/articles/{self.article.pk}/",
            {"ids": f"{self.other.pk},{self.article.pk}"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["prev_id"], self.other.pk)
        self.assertIsNone(res.data["next_id"])
