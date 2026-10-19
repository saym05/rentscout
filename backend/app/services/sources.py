import threading

from app.adapters.base import AdapterError, SourceAdapter
from app.domain.demo_data import DEMO_SOURCES, build_demo_listings
from app.domain.errors import ApiError
from app.domain.jsmath import now_iso
from app.domain.models import RefreshResult, SourceRefreshOutcome, SourceStatus
from app.repositories.base import Store

SOURCE_FIELDS = ("title", "description", "city", "neighborhood", "property_type", "rooms", "area_sqm", "rent_amount",
                 "rent_period", "currency", "utilities_included", "utilities_monthly", "amenities", "source_url", "is_demo")


def seed(store: Store) -> bool:
    """Deterministic, idempotent first-run seed. The sources table doubles as the 'already seeded' marker,
    so user deletions of demo listings survive restarts. Returns True when it seeded."""
    if store.sources.list_all():
        return False
    for sid, name in DEMO_SOURCES:
        store.sources.save(SourceStatus(id=sid, name=name, kind="demo", status="never_run", last_checked_at=None,
                                        last_success_at=None, listing_count=0, error=None))
    for l in build_demo_listings():
        if store.listings.get(l.id) is None:
            store.listings.add(l)
    store.commit()
    return True


def list_sources(store: Store, adapters: list[SourceAdapter]) -> list[SourceStatus]:
    counts = store.listings.count_by_source()
    stored = {s.id: s for s in store.sources.list_all()}
    out = []
    for a in adapters:
        s = stored.get(a.source_id) or SourceStatus(id=a.source_id, name=a.name, kind=a.kind, status="never_run",
                                                     last_checked_at=None, last_success_at=None, listing_count=0, error=None)
        out.append(s.model_copy(update={"listing_count": counts.get(a.source_id, 0)}))
    return out


class RefreshService:
    """Runs every adapter in isolation. One failing source never removes stored listings. One run at a time."""

    def __init__(self, adapters: list[SourceAdapter], lock: threading.Lock) -> None:
        self.adapters, self.lock = adapters, lock

    def refresh(self, store: Store) -> RefreshResult:
        if not self.lock.acquire(blocking=False):
            raise ApiError(409, "REFRESH_IN_PROGRESS", "A refresh is already running")
        try:
            started = now_iso()
            outcomes = [self._run(store, a) for a in self.adapters]
            return RefreshResult(started_at=started, finished_at=now_iso(), outcomes=outcomes)
        finally:
            self.lock.release()

    def _run(self, store: Store, a: SourceAdapter) -> SourceRefreshOutcome:
        status = store.sources.get(a.source_id) or SourceStatus(
            id=a.source_id, name=a.name, kind=a.kind, status="never_run", last_checked_at=None,
            last_success_at=None, listing_count=0, error=None)
        now = now_iso()
        try:
            fetched = a.fetch()
            for incoming in fetched:
                self._upsert(store, incoming, now)
        except Exception as exc:  # adapter failures are isolated and reported, stored data is untouched
            store.rollback()
            message = str(exc) if isinstance(exc, AdapterError) else "Source failed with an unexpected error"
            store.sources.save(status.model_copy(update={"status": "failed", "last_checked_at": now, "error": message}))
            store.commit()
            return SourceRefreshOutcome(source_id=a.source_id, ok=False, fetched=0, error=message)
        store.sources.save(status.model_copy(update={"status": "ok", "last_checked_at": now, "last_success_at": now,
                                                     "error": None}))
        store.commit()
        return SourceRefreshOutcome(source_id=a.source_id, ok=True, fetched=len(fetched), error=None)

    @staticmethod
    def _upsert(store: Store, incoming, now: str) -> None:
        existing = store.listings.get_by_external(incoming.source_id, incoming.external_id) if incoming.external_id \
            else None
        if existing is None:
            if store.listings.get(incoming.id) is None:
                store.listings.add(incoming.model_copy(update={"last_seen_at": now}))
            return
        changes = {k: getattr(incoming, k) for k in SOURCE_FIELDS if getattr(incoming, k) != getattr(existing, k)}
        if changes:
            changes["updated_at"] = now
        store.listings.update(existing.model_copy(update={**changes, "last_seen_at": now}))
