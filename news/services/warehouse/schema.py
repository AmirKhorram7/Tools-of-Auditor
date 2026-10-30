"""DDL for the news warehouse. Keep this the contract ML trains against."""

ARTICLES_TABLE = "news_articles"
SOURCES_TABLE = "news_sources"

ARTICLES_DDL = """
CREATE TABLE IF NOT EXISTS news_articles
(
    id UInt64,
    source_id UInt32,
    source_slug LowCardinality(String),
    source_name String,
    source_category LowCardinality(String),
    source_region LowCardinality(String),
    source_type LowCardinality(String),
    url String,
    canonical_url String,
    title String,
    summary String,
    body String,
    title_fa String,
    summary_fa String,
    author String,
    language LowCardinality(String),
    tags Array(String),
    published_at Nullable(DateTime64(3, 'UTC')),
    fetched_at DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC'),
    content_hash String,
    translation_status LowCardinality(String),
    synced_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(synced_at)
ORDER BY id
"""

SOURCES_DDL = """
CREATE TABLE IF NOT EXISTS news_sources
(
    id UInt32,
    slug LowCardinality(String),
    name String,
    base_url String,
    feed_url String,
    source_type LowCardinality(String),
    region LowCardinality(String),
    category LowCardinality(String),
    is_active UInt8,
    last_status LowCardinality(String),
    last_fetched_at Nullable(DateTime64(3, 'UTC')),
    synced_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(synced_at)
ORDER BY id
"""

ARTICLE_COLUMNS = [
    "id",
    "source_id",
    "source_slug",
    "source_name",
    "source_category",
    "source_region",
    "source_type",
    "url",
    "canonical_url",
    "title",
    "summary",
    "body",
    "title_fa",
    "summary_fa",
    "author",
    "language",
    "tags",
    "published_at",
    "fetched_at",
    "updated_at",
    "content_hash",
    "translation_status",
    "synced_at",
]

SOURCE_COLUMNS = [
    "id",
    "slug",
    "name",
    "base_url",
    "feed_url",
    "source_type",
    "region",
    "category",
    "is_active",
    "last_status",
    "last_fetched_at",
    "synced_at",
]
