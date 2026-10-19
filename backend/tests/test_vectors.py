"""The Python domain must reproduce docs/test-vectors.json, which is generated from the TypeScript domain."""
import json
from pathlib import Path

import pytest

from app.domain.cost import to_display_cost
from app.domain.demo_data import DEMO_RATES, build_demo_listings
from app.domain.duplicates import find_duplicates
from app.domain.models import RateTable
from app.domain.search import ListingQuery, search_listings

V = json.loads((Path(__file__).parents[2] / "docs" / "test-vectors.json").read_text())


def dump(m):
    return None if m is None else m.model_dump(by_alias=True, exclude_none=True)


def test_rates_match():
    assert RateTable.model_validate(V["rates"]) == DEMO_RATES


def test_demo_listings_identical_to_frontend():
    assert [l.model_dump(by_alias=True) for l in build_demo_listings()] == V["listings"]


def test_costs_identical():
    listings = {l.id: l for l in build_demo_listings()}
    for c in V["costs"]:
        for cur, expected in c["withRates"].items():
            assert dump(to_display_cost(listings[c["id"]], cur, DEMO_RATES)) == expected, (c["id"], cur)
        for cur, expected in c["withoutRates"].items():
            assert dump(to_display_cost(listings[c["id"]], cur, None)) == expected, (c["id"], cur)


def test_duplicates_identical():
    listings = build_demo_listings()
    by_id = {l.id: l for l in listings}
    for d in V["duplicates"]:
        assert [dump(m) for m in find_duplicates(by_id[d["id"]], listings, DEMO_RATES)] == d["withRates"], d["id"]
        assert [dump(m) for m in find_duplicates(by_id[d["id"]], listings, None)] == d["withoutRates"], d["id"]


KEYS = {"minPrice": "min_price", "maxPrice": "max_price", "minRooms": "min_rooms", "maxRooms": "max_rooms",
        "propertyTypes": "property_types", "pageSize": "page_size"}


@pytest.mark.parametrize("vec", V["searches"], ids=lambda v: json.dumps(v["query"]))
def test_search_identical(vec):
    q = ListingQuery(**{KEYS.get(k, k): v for k, v in vec["query"].items()})
    r = search_listings(build_demo_listings(), q, DEMO_RATES)
    assert r.total == vec["total"]
    assert [i.listing.id for i in r.items] == vec["ids"]
    assert [i.monthly_cost.amount if i.monthly_cost else None for i in r.items] == vec["amounts"]
