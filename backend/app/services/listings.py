from typing import Any
from uuid import uuid4

from app.domain.cost import to_display_cost
from app.domain.duplicates import find_duplicates
from app.domain.errors import ApiError, FieldError, not_found, validation
from app.domain.jsmath import now_iso
from app.domain.models import (AMENITIES, SUPPORTED_CURRENCIES, ComparisonResult, Listing, ListingDetail,
                               ListingView, RateTable, SearchResult)
from app.domain.search import ListingQuery, search_listings
from app.domain.validation import EDITABLE, validate_listing_input
from app.repositories.base import Store

MIN_COMPARE, MAX_COMPARE = 2, 3


def check_currency(currency: str | None) -> str:
    if currency is None or currency == "":
        return "EUR"
    if currency not in SUPPORTED_CURRENCIES:
        raise validation("Invalid currency", [FieldError("currency", "unsupported currency")])
    return currency


def _snake(k: str) -> str:
    return "".join(f"_{c.lower()}" if c.isupper() else c for c in k)


class ListingService:
    def __init__(self, store: Store, rates: RateTable | None, user_id: str) -> None:
        self.store, self.rates, self.user = store, rates, user_id

    def _find(self, listing_id: str) -> Listing:
        l = self.store.listings.get(listing_id)
        if l is None:
            raise not_found(f"Listing {listing_id}")
        return l

    def _view(self, l: Listing, currency: str, favs: set[str] | None = None) -> ListingView:
        favs = self.store.favorites.list_ids(self.user) if favs is None else favs
        return ListingView(listing=l, monthly_cost=to_display_cost(l, currency, self.rates), is_favorite=l.id in favs)

    def search(self, q: ListingQuery) -> SearchResult:
        favs = self.store.favorites.list_ids(self.user)
        return search_listings(self.store.listings.list_all(), q, self.rates, favs.__contains__)

    def detail(self, listing_id: str, currency: str | None) -> ListingDetail:
        currency = check_currency(currency)
        l = self._find(listing_id)
        dups = find_duplicates(l, self.store.listings.list_all(), self.rates)
        return ListingDetail(**self._view(l, currency).model_dump(), duplicates=dups)

    def create(self, body: Any) -> ListingView:
        if not isinstance(body, dict):
            raise validation("Invalid listing", [FieldError("body", "must be a JSON object")])
        errors = validate_listing_input(body, partial=False)
        if errors:
            raise validation("Invalid listing", errors)
        now = now_iso()
        data = {_snake(k): body.get(k) for k in EDITABLE}
        l = Listing(**{**data, "description": data["description"] or "", "amenities": data["amenities"] or [],
                       "utilities_included": bool(data["utilities_included"]),
                       "id": f"user-{uuid4().hex[:12]}", "source_id": "manual", "external_id": None,
                       "is_demo": False, "first_seen_at": now, "last_seen_at": now, "updated_at": now})
        self.store.listings.add(l)
        self.store.commit()
        return self._view(l, l.currency)

    def update(self, listing_id: str, patch: Any) -> ListingView:
        l = self._find(listing_id)
        if not isinstance(patch, dict):
            raise validation("Invalid listing", [FieldError("body", "must be a JSON object")])
        errors = validate_listing_input(patch, partial=True)
        for k in ("title", "city", "neighborhood", "propertyType", "rooms", "rentAmount", "rentPeriod", "currency",
                  "utilitiesIncluded", "amenities", "description"):
            if k in patch and patch[k] is None:
                errors.append(FieldError(k, "must not be null"))
        if errors:
            raise validation("Invalid listing", errors)
        changes = {_snake(k): v for k, v in patch.items() if k in EDITABLE}
        updated = l.model_copy(update={**changes, "updated_at": now_iso()})
        self.store.listings.update(Listing.model_validate(updated.model_dump()))
        self.store.commit()
        return self._view(updated, updated.currency)

    def delete(self, listing_id: str) -> None:
        self._find(listing_id)
        self.store.favorites.remove_listing(listing_id)
        self.store.listings.delete(listing_id)
        self.store.commit()

    def favorites(self, currency: str | None) -> list[ListingView]:
        currency = check_currency(currency)
        favs = self.store.favorites.list_ids(self.user)
        return [self._view(l, currency, favs) for l in self.store.listings.list_all() if l.id in favs]

    def add_favorite(self, listing_id: str) -> None:
        self._find(listing_id)
        self.store.favorites.add(self.user, listing_id)
        self.store.commit()

    def remove_favorite(self, listing_id: str) -> None:
        self.store.favorites.remove(self.user, listing_id)  # idempotent
        self.store.commit()

    def compare(self, body: Any) -> ComparisonResult:
        if not isinstance(body, dict) or not isinstance(body.get("ids"), list) or \
                not all(isinstance(i, str) for i in body["ids"]):
            raise validation("Invalid comparison", [FieldError("ids", "must be a list of listing ids")])
        ids: list[str] = body["ids"]
        currency = check_currency(body.get("currency"))
        if len(set(ids)) != len(ids):
            raise validation("Duplicate ids in comparison", [FieldError("ids", "must be unique")])
        if not MIN_COMPARE <= len(ids) <= MAX_COMPARE:
            raise validation(f"Compare between {MIN_COMPARE} and {MAX_COMPARE} listings",
                             [FieldError("ids", f"must contain {MIN_COMPARE}-{MAX_COMPARE} ids")])
        favs = self.store.favorites.list_ids(self.user)
        items = [self._view(self._find(i), currency, favs) for i in ids]
        priced = sorted((v for v in items if v.monthly_cost), key=lambda v: (v.monthly_cost.amount, v.listing.id))
        matrix = {a: [v.listing.id for v in items if a in v.listing.amenities] for a in AMENITIES}
        return ComparisonResult(currency=currency, items=items, cheapest_id=priced[0].listing.id if priced else None,
                                amenity_matrix=matrix)


__all__ = ["ListingService", "check_currency", "ApiError"]
