"""Source adapters turn an external source into normalized listings. See docs/architecture.md#source-adapters."""
from typing import Literal, Protocol

from app.domain.models import Listing


class AdapterError(Exception):
    """Raised by an adapter when its source cannot be read. Refresh records it; it never deletes stored data."""


class SourceAdapter(Protocol):
    source_id: str
    name: str
    kind: Literal["demo", "live"]

    def fetch(self) -> list[Listing]:
        """Return the source's current listings, each with source_id == self.source_id and a stable external_id."""
        ...
