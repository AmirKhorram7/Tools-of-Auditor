"""News panel constants.

The news panel is **global**, not tenant-scoped: every News Team member sees
the same sources and articles. There is no company/desk/project filter.
"""

NEWS_GROUP_NAME = "News Team"

# Honest crawler identity. Used on every outbound fetch.
NEWS_USER_AGENT = "TauditorNewsBot/1.0 (+https://tauditor.com; news@tauditor.com)"

LANGUAGE_EN = "en"
LANGUAGE_FA = "fa"
LANGUAGE_CHOICES = (
    (LANGUAGE_EN, "English"),
    (LANGUAGE_FA, "Persian"),
)

# Global fetch schedule (NewsPanelSettings). Superuser-only to write.
FETCH_MODE_MANUAL = "manual"
FETCH_MODE_SCHEDULED = "scheduled"
FETCH_MODE_CHOICES = (
    (FETCH_MODE_MANUAL, "Manual"),
    (FETCH_MODE_SCHEDULED, "Scheduled"),
)
# Hours the settings page offers. PATCH still accepts any integer in [min, max].
INTERVAL_PRESETS_HOURS = (1, 3, 6, 12, 24, 48, 72, 168)
INTERVAL_HOURS_MIN = 1
INTERVAL_HOURS_MAX = 168
DEFAULT_INTERVAL_HOURS = 24

# ClickHouse warehouse (ML / history). Superuser-only. Off-peak clock time.
WAREHOUSE_INTERVAL_PRESETS = (24, 48, 72, 168, 720)  # 24h, 48h, 72h, weekly, monthly
WAREHOUSE_INTERVAL_MIN = 24
WAREHOUSE_INTERVAL_MAX = 720
DEFAULT_WAREHOUSE_INTERVAL_HOURS = 24
DEFAULT_WAREHOUSE_HOUR = 2  # 02:00 Asia/Tehran — keep load off the live site
DEFAULT_WAREHOUSE_MINUTE = 0
WAREHOUSE_MINUTE_PRESETS = (0, 15, 30, 45)  # beat ticks every 15 minutes
WAREHOUSE_SYNC_BATCH = 250

# Full article text (cards still show title + summary only).
MAX_BODY_CHARS = 100_000
MIN_FULL_BODY_CHARS = 500
HYDRATE_CAP_PER_SOURCE = 20

AI_KEYWORDS = (
    "ai",
    "artificial intelligence",
    "machine learning",
    "llm",
    "gpt",
    "claude",
    "gemini",
    "openai",
    "anthropic",
    "deepmind",
    "neural",
    "transformer",
    "diffusion",
    "agent",
    "model",
)
