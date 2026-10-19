from collections import Counter

from app.domain.models import Listing, SourceStatus


class MemoryListings:
    def __init__(self) -> None:
        self.rows: dict[str, Listing] = {}

    def list_all(self) -> list[Listing]:
        return [l.model_copy(deep=True) for l in self.rows.values()]

    def get(self, listing_id: str) -> Listing | None:
        l = self.rows.get(listing_id)
        return l.model_copy(deep=True) if l else None

    def get_by_external(self, source_id: str, external_id: str) -> Listing | None:
        return next((l.model_copy(deep=True) for l in self.rows.values()
                     if l.source_id == source_id and l.external_id == external_id), None)

    def add(self, listing: Listing) -> None:
        self.rows[listing.id] = listing.model_copy(deep=True)

    update = add

    def delete(self, listing_id: str) -> None:
        self.rows.pop(listing_id, None)

    def count_by_source(self) -> dict[str, int]:
        return dict(Counter(l.source_id for l in self.rows.values()))


class MemoryFavorites:
    def __init__(self) -> None:
        self.rows: set[tuple[str, str]] = set()

    def list_ids(self, user_id: str) -> set[str]:
        return {l for u, l in self.rows if u == user_id}

    def add(self, user_id: str, listing_id: str) -> None:
        self.rows.add((user_id, listing_id))

    def remove(self, user_id: str, listing_id: str) -> None:
        self.rows.discard((user_id, listing_id))

    def remove_listing(self, listing_id: str) -> None:
        self.rows = {(u, l) for u, l in self.rows if l != listing_id}


class MemorySources:
    def __init__(self) -> None:
        self.rows: dict[str, SourceStatus] = {}

    def list_all(self) -> list[SourceStatus]:
        return [s.model_copy() for s in self.rows.values()]

    def get(self, source_id: str) -> SourceStatus | None:
        s = self.rows.get(source_id)
        return s.model_copy() if s else None

    def save(self, source: SourceStatus) -> None:
        self.rows[source.id] = source.model_copy()


class MemoryStore:
    """Process-wide in-memory store (iteration 3). commit/rollback are no-ops."""
    def __init__(self) -> None:
        self.listings = MemoryListings()
        self.favorites = MemoryFavorites()
        self.sources = MemorySources()

    def commit(self) -> None: ...
    def rollback(self) -> None: ...
