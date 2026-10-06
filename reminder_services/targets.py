"""Apps plug their objects into reminders here.

An app registers a resolver per target key. The resolver gets the owner and
an id, and returns a `Target` only when that user owns the object (otherwise
`None`). This keeps reminder_services free of imports from other apps, so
meeting minutes can register later the same way the daybook does.
"""

from dataclasses import dataclass
from datetime import date
from typing import Callable, Optional


@dataclass
class Target:
    title: str
    message: str
    due: Optional[date]
    """Date that `before` mode counts back from. None → only `at` mode works."""
    owner_name: str = ""
    period: str = ""


Resolver = Callable[[object, int], Optional[Target]]

_REGISTRY: dict[str, Resolver] = {}


def register(key: str, resolver: Resolver) -> None:
    _REGISTRY[key] = resolver


def keys() -> list[str]:
    return sorted(_REGISTRY)


def resolve(key: str, user, target_id: int) -> Optional[Target]:
    resolver = _REGISTRY.get(key)
    if resolver is None:
        return None
    return resolver(user, target_id)
