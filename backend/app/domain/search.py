from dataclasses import dataclass, field
from typing import Callable

from .cost import to_display_cost
from .duplicates import norm
from .errors import FieldError, validation
from .models import AMENITIES, PROPERTY_TYPES, SORTS, SUPPORTED_CURRENCIES, Listing, ListingView, RateTable, SearchResult


@dataclass
class ListingQuery:
    q: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    min_price: float | None = None  # monthly cost in `currency`
    max_price: float | None = None
    min_rooms: int | None = None
    max_rooms: int | None = None
    property_types: list[str] = field(default_factory=list)
    amenities: list[str] = field(default_factory=list)  # listing must have ALL
    sort: str = "newest"
    page: int = 1
    page_size: int = 12
    currency: str = "EUR"


def _csv(raw: str | None) -> list[str]:
    return [p.strip() for p in raw.split(",") if p.strip()] if raw else []


def parse_query(params: dict[str, str]) -> ListingQuery:
    """Parse raw query-string values; every problem becomes a field error (400), never a 500."""
    errors: list[FieldError] = []

    def number(name: str) -> float | None:
        raw = params.get(name)
        if raw is None or raw == "":
            return None
        try:
            v = float(raw)
        except ValueError:
            v = float("nan")
        if v != v or v in (float("inf"), float("-inf")) or v < 0:
            errors.append(FieldError(name, "must be a number >= 0"))
            return None
        return v

    def integer(name: str, lo: int, hi: int | None, default: int | None) -> int | None:
        raw = params.get(name)
        if raw is None or raw == "":
            return default
        try:
            v = int(raw)
        except ValueError:
            v = None
        if v is None or v < lo or (hi is not None and v > hi):
            errors.append(FieldError(name, f"must be an integer between {lo} and {hi}" if hi else f"must be an integer >= {lo}"))
            return default
        return v

    q = ListingQuery(
        q=(params.get("q") or "").strip() or None,
        city=(params.get("city") or "").strip() or None,
        neighborhood=(params.get("neighborhood") or "").strip() or None,
        min_price=number("minPrice"), max_price=number("maxPrice"),
        min_rooms=integer("minRooms", 1, None, None), max_rooms=integer("maxRooms", 1, None, None),
        property_types=_csv(params.get("propertyTypes")), amenities=_csv(params.get("amenities")),
        sort=params.get("sort") or "newest",
        page=integer("page", 1, None, 1) or 1, page_size=integer("pageSize", 1, 100, 12) or 12,
        currency=params.get("currency") or "EUR",
    )
    if q.q and len(q.q) > 100:
        errors.append(FieldError("q", "must be at most 100 characters"))
    if q.min_price is not None and q.max_price is not None and q.min_price > q.max_price:
        errors.append(FieldError("minPrice", "must not exceed maxPrice"))
    if q.min_rooms is not None and q.max_rooms is not None and q.min_rooms > q.max_rooms:
        errors.append(FieldError("minRooms", "must not exceed maxRooms"))
    if q.currency not in SUPPORTED_CURRENCIES:
        errors.append(FieldError("currency", f"unsupported currency; use one of {', '.join(SUPPORTED_CURRENCIES)}"))
    if q.sort not in SORTS:
        errors.append(FieldError("sort", f"must be one of {', '.join(SORTS)}"))
    errors += [FieldError("propertyTypes", f"unknown type {t}") for t in q.property_types if t not in PROPERTY_TYPES]
    errors += [FieldError("amenities", f"unknown amenity {a}") for a in q.amenities if a not in AMENITIES]
    if errors:
        raise validation("Invalid search parameters", errors)
    return q


def search_listings(all_listings: list[Listing], q: ListingQuery, rates: RateTable | None,
                    is_favorite: Callable[[str], bool] = lambda _id: False) -> SearchResult:
    text = norm(q.q) if q.q else ""
    price_filtered = q.min_price is not None or q.max_price is not None
    views: list[ListingView] = []
    for l in all_listings:
        if q.city and norm(l.city) != norm(q.city):
            continue
        if q.neighborhood and norm(l.neighborhood) != norm(q.neighborhood):
            continue
        if text and text not in norm(f"{l.title} {l.description} {l.city} {l.neighborhood}"):
            continue
        if q.property_types and l.property_type not in q.property_types:
            continue
        if q.min_rooms is not None and l.rooms < q.min_rooms:
            continue
        if q.max_rooms is not None and l.rooms > q.max_rooms:
            continue
        if q.amenities and not all(a in l.amenities for a in q.amenities):
            continue
        cost = to_display_cost(l, q.currency, rates)
        if price_filtered:
            if cost is None:  # cannot honestly compare, so exclude from price-bounded results
                continue
            if q.min_price is not None and cost.amount < q.min_price:
                continue
            if q.max_price is not None and cost.amount > q.max_price:
                continue
        views.append(ListingView(listing=l, monthly_cost=cost, is_favorite=is_favorite(l.id)))

    if q.sort == "newest":
        views.sort(key=lambda v: v.listing.id)
        views.sort(key=lambda v: v.listing.first_seen_at, reverse=True)
    else:
        sign = 1 if q.sort == "price_asc" else -1
        # non-comparable listings go last in both directions
        views.sort(key=lambda v: (v.monthly_cost is None, sign * v.monthly_cost.amount if v.monthly_cost else 0, v.listing.id))

    start = (q.page - 1) * q.page_size
    return SearchResult(items=views[start:start + q.page_size], total=len(views), page=q.page,
                        page_size=q.page_size, currency=q.currency)
