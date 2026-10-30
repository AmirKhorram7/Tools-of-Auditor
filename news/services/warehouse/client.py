"""Warehouse backends. Tests use MemoryClient; production uses ClickHouse."""

from __future__ import annotations

from typing import Protocol

from django.conf import settings

from news.services.warehouse.schema import (
    ARTICLE_COLUMNS,
    ARTICLES_DDL,
    ARTICLES_TABLE,
    SOURCE_COLUMNS,
    SOURCES_DDL,
    SOURCES_TABLE,
)


class WarehouseClient(Protocol):
    def ensure_schema(self) -> None: ...
    def max_article_id(self) -> int: ...
    def insert_articles(self, rows: list[dict]) -> int: ...
    def upsert_sources(self, rows: list[dict]) -> int: ...


class MemoryClient:
    """In-process stand-in so tests never need a ClickHouse process."""

    def __init__(self):
        self.articles: dict[int, dict] = {}
        self.sources: dict[int, dict] = {}
        self.schema_ready = False

    def ensure_schema(self) -> None:
        self.schema_ready = True

    def max_article_id(self) -> int:
        return max(self.articles) if self.articles else 0

    def insert_articles(self, rows: list[dict]) -> int:
        for row in rows:
            self.articles[int(row["id"])] = row
        return len(rows)

    def upsert_sources(self, rows: list[dict]) -> int:
        for row in rows:
            self.sources[int(row["id"])] = row
        return len(rows)


class ClickHouseClient:
    def __init__(self, raw):
        self.raw = raw
        self.database = getattr(settings, "CLICKHOUSE_DB", "tauditor_news") or "tauditor_news"

    def ensure_schema(self) -> None:
        self.raw.command(f"CREATE DATABASE IF NOT EXISTS {self.database}")
        self.raw.command(f"USE {self.database}")
        self.raw.command(SOURCES_DDL)
        self.raw.command(ARTICLES_DDL)

    def max_article_id(self) -> int:
        self.raw.command(f"USE {self.database}")
        result = self.raw.query(f"SELECT max(id) FROM {ARTICLES_TABLE}")
        rows = getattr(result, "result_rows", None) or getattr(result, "result_set", None) or []
        if not rows:
            return 0
        value = rows[0][0]
        return int(value or 0)

    def insert_articles(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        self.raw.command(f"USE {self.database}")
        data = [[row.get(col) for col in ARTICLE_COLUMNS] for row in rows]
        self.raw.insert(ARTICLES_TABLE, data, column_names=ARTICLE_COLUMNS)
        return len(rows)

    def upsert_sources(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        self.raw.command(f"USE {self.database}")
        data = [[row.get(col) for col in SOURCE_COLUMNS] for row in rows]
        self.raw.insert(SOURCES_TABLE, data, column_names=SOURCE_COLUMNS)
        return len(rows)


def clickhouse_configured() -> bool:
    return bool((getattr(settings, "CLICKHOUSE_HOST", "") or "").strip())


def get_warehouse_client() -> WarehouseClient | None:
    host = (getattr(settings, "CLICKHOUSE_HOST", "") or "").strip()
    if not host:
        return None
    try:
        import clickhouse_connect
    except ImportError:
        return None
    raw = clickhouse_connect.get_client(
        host=host,
        port=int(getattr(settings, "CLICKHOUSE_PORT", 8123) or 8123),
        username=getattr(settings, "CLICKHOUSE_USER", "default") or "default",
        password=getattr(settings, "CLICKHOUSE_PASSWORD", "") or "",
        secure=bool(getattr(settings, "CLICKHOUSE_SECURE", False)),
    )
    return ClickHouseClient(raw)
