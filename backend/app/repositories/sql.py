from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import FavoriteRow, ListingRow, SourceRow
from app.domain.cost import native_monthly_cost
from app.domain.jsmath import iso_ms
from app.domain.models import Listing, SourceStatus


def _to_dt(s: str | None) -> datetime | None:
    if s is None:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)


def _to_iso(d: datetime | None) -> str | None:
    if d is None:
        return None
    return iso_ms(int(d.replace(tzinfo=timezone.utc).timestamp() * 1000))


_TIMES = ("first_seen_at", "last_seen_at", "updated_at")


def _row_values(l: Listing) -> dict:
    v = l.model_dump()
    for k in _TIMES:
        v[k] = _to_dt(v[k])
    v["monthly_cost_native"] = native_monthly_cost(l)["amount"]
    return v


def _listing(r: ListingRow) -> Listing:
    v = {c.key: getattr(r, c.key) for c in ListingRow.__table__.columns if c.key != "monthly_cost_native"}
    for k in _TIMES:
        v[k] = _to_iso(v[k])
    v["amenities"] = list(v["amenities"] or [])
    return Listing(**v)


class SqlListings:
    def __init__(self, s: Session) -> None:
        self.s = s

    def list_all(self) -> list[Listing]:
        return [_listing(r) for r in self.s.scalars(select(ListingRow).order_by(ListingRow.id))]

    def get(self, listing_id: str) -> Listing | None:
        r = self.s.get(ListingRow, listing_id)
        return _listing(r) if r else None

    def get_by_external(self, source_id: str, external_id: str) -> Listing | None:
        r = self.s.scalars(select(ListingRow).where(ListingRow.source_id == source_id,
                                                    ListingRow.external_id == external_id)).first()
        return _listing(r) if r else None

    def add(self, listing: Listing) -> None:
        self.s.add(ListingRow(**_row_values(listing)))
        self.s.flush()

    def update(self, listing: Listing) -> None:
        r = self.s.get(ListingRow, listing.id)
        for k, v in _row_values(listing).items():
            setattr(r, k, v)
        self.s.flush()

    def delete(self, listing_id: str) -> None:
        self.s.execute(delete(ListingRow).where(ListingRow.id == listing_id))

    def count_by_source(self) -> dict[str, int]:
        rows = self.s.execute(select(ListingRow.source_id, func.count()).group_by(ListingRow.source_id))
        return {source_id: n for source_id, n in rows}


class SqlFavorites:
    def __init__(self, s: Session) -> None:
        self.s = s

    def list_ids(self, user_id: str) -> set[str]:
        return set(self.s.scalars(select(FavoriteRow.listing_id).where(FavoriteRow.user_id == user_id)))

    def add(self, user_id: str, listing_id: str) -> None:
        if not self.s.get(FavoriteRow, (user_id, listing_id)):
            self.s.add(FavoriteRow(user_id=user_id, listing_id=listing_id))
            self.s.flush()

    def remove(self, user_id: str, listing_id: str) -> None:
        self.s.execute(delete(FavoriteRow).where(FavoriteRow.user_id == user_id, FavoriteRow.listing_id == listing_id))

    def remove_listing(self, listing_id: str) -> None:
        self.s.execute(delete(FavoriteRow).where(FavoriteRow.listing_id == listing_id))


class SqlSources:
    def __init__(self, s: Session) -> None:
        self.s = s

    @staticmethod
    def _status(r: SourceRow) -> SourceStatus:
        return SourceStatus(id=r.id, name=r.name, kind=r.kind, status=r.status, last_checked_at=_to_iso(r.last_checked_at),
                            last_success_at=_to_iso(r.last_success_at), listing_count=0, error=r.error)

    def list_all(self) -> list[SourceStatus]:
        return [self._status(r) for r in self.s.scalars(select(SourceRow).order_by(SourceRow.id))]

    def get(self, source_id: str) -> SourceStatus | None:
        r = self.s.get(SourceRow, source_id)
        return self._status(r) if r else None

    def save(self, source: SourceStatus) -> None:
        r = self.s.get(SourceRow, source.id) or SourceRow(id=source.id)
        r.name, r.kind, r.status, r.error = source.name, source.kind, source.status, source.error
        r.last_checked_at, r.last_success_at = _to_dt(source.last_checked_at), _to_dt(source.last_success_at)
        self.s.add(r)
        self.s.flush()


class SqlStore:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.listings = SqlListings(session)
        self.favorites = SqlFavorites(session)
        self.sources = SqlSources(session)

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
