"""ClickHouse warehouse: off-peak copy of news rows for later ML.

Postgres stays the live app database. This package never writes back.
"""

from news.services.warehouse.client import MemoryClient, WarehouseClient, get_warehouse_client
from news.services.warehouse.settings import WarehouseSettingsService
from news.services.warehouse.sync import WarehouseSyncService

__all__ = [
    "MemoryClient",
    "WarehouseClient",
    "WarehouseSettingsService",
    "WarehouseSyncService",
    "get_warehouse_client",
]
