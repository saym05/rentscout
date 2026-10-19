"""Domain types. Field names are snake_case in Python and camelCase on the wire (openapi.yml)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

SUPPORTED_CURRENCIES = ("EUR", "GBP", "CAD", "USD")
PROPERTY_TYPES = ("studio", "apartment", "room", "house")
AMENITIES = ("furnished", "wifi", "washer", "dishwasher", "balcony", "parking", "gym", "pets-allowed", "elevator")
SORTS = ("price_asc", "price_desc", "newest")

Currency = Literal["EUR", "GBP", "CAD", "USD"]
PropertyType = Literal["studio", "apartment", "room", "house"]
RentPeriod = Literal["month", "week"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Listing(CamelModel):
    id: str
    title: str
    description: str
    city: str
    neighborhood: str
    property_type: PropertyType
    rooms: int
    area_sqm: float | None
    rent_amount: float  # ORIGINAL currency and period, never overwritten
    rent_period: RentPeriod
    currency: Currency  # ORIGINAL currency
    utilities_included: bool
    utilities_monthly: float | None  # None = unknown
    amenities: list[str]
    source_id: str
    external_id: str | None
    source_url: str | None
    is_demo: bool
    first_seen_at: str  # ISO 8601, UTC, millisecond precision
    last_seen_at: str
    updated_at: str


class RateTable(CamelModel):
    """1 unit of a currency is worth eur_per[currency] EUR. `source` must say where rates came from."""
    as_of: str
    source: str
    eur_per: dict[str, float]


class NativeAmount(CamelModel):
    amount: float
    currency: Currency


class MonthlyCost(CamelModel):
    amount: float
    currency: Currency
    converted: bool
    rate: float | None = None
    rate_as_of: str | None = None
    rate_source: str | None = None
    native: NativeAmount
    rent_monthly: float
    utilities_monthly: float
    utilities_known: bool


class ListingView(CamelModel):
    listing: Listing
    monthly_cost: MonthlyCost | None
    is_favorite: bool


class DuplicateMatch(CamelModel):
    listing_id: str
    score: float
    category: Literal["probable", "possible", "none"]
    reasons: list[str]


class ListingDetail(ListingView):
    duplicates: list[DuplicateMatch]


class SearchResult(CamelModel):
    items: list[ListingView]
    total: int
    page: int
    page_size: int
    currency: Currency


class ComparisonResult(CamelModel):
    currency: Currency
    items: list[ListingView]
    cheapest_id: str | None
    amenity_matrix: dict[str, list[str]]


class SourceStatus(CamelModel):
    id: str
    name: str
    kind: Literal["demo", "live"]
    status: Literal["ok", "failed", "never_run"]
    last_checked_at: str | None
    last_success_at: str | None
    listing_count: int
    error: str | None


class SourceRefreshOutcome(CamelModel):
    source_id: str
    ok: bool
    fetched: int
    error: str | None


class RefreshResult(CamelModel):
    started_at: str
    finished_at: str
    outcomes: list[SourceRefreshOutcome]
