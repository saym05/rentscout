"""API behaviour, run against both the in-memory and the SQLite store (store_kind fixture)."""
import pytest

from tests.conftest import VALID


def err(r, status):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"} and {"code", "message", "details"} <= set(body["error"])
    return body["error"]


def fields(e):
    return {d["field"] for d in e["details"]}


# --- health and errors -------------------------------------------------------------------------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_route_returns_envelope(client):
    assert err(client.get("/api/does-not-exist"), 404)["code"] == "NOT_FOUND"


def test_unexpected_exception_is_generic_500_without_trace(client, monkeypatch):
    from app.services import listings
    monkeypatch.setattr(listings.ListingService, "search", lambda *a: 1 / 0)
    e = err(client.get("/api/listings"), 500)
    assert e["code"] == "INTERNAL_ERROR" and "ZeroDivision" not in e["message"] and "Traceback" not in e["message"]


# --- search ------------------------------------------------------------------------------------
def test_search_defaults(client):
    r = client.get("/api/listings").json()
    assert r["total"] == 27 and r["page"] == 1 and r["pageSize"] == 12 and r["currency"] == "EUR"
    assert len(r["items"]) == 12 and all(i["listing"]["isDemo"] for i in r["items"])
    seen = [i["listing"]["firstSeenAt"] for i in r["items"]]
    assert seen == sorted(seen, reverse=True)


def test_search_filters_combined(client):
    r = client.get("/api/listings", params={"city": "berlin", "propertyTypes": "apartment,studio",
                                            "minRooms": 1, "maxRooms": 2, "amenities": "wifi"}).json()
    for i in r["items"]:
        l = i["listing"]
        assert l["city"] == "Berlin" and l["propertyType"] in ("apartment", "studio") and 1 <= l["rooms"] <= 2
        assert "wifi" in l["amenities"]


def test_search_price_range_and_sort(client):
    r = client.get("/api/listings", params={"minPrice": 700, "maxPrice": 1500, "sort": "price_asc",
                                            "pageSize": 100}).json()
    amounts = [i["monthlyCost"]["amount"] for i in r["items"]]
    assert amounts == sorted(amounts) and all(700 <= a <= 1500 for a in amounts) and amounts
    r = client.get("/api/listings", params={"sort": "price_desc", "pageSize": 100}).json()
    amounts = [i["monthlyCost"]["amount"] for i in r["items"]]
    assert amounts == sorted(amounts, reverse=True)


def test_search_pagination(client):
    p1 = client.get("/api/listings", params={"pageSize": 10, "page": 1}).json()
    p3 = client.get("/api/listings", params={"pageSize": 10, "page": 3}).json()
    assert len(p1["items"]) == 10 and len(p3["items"]) == 7 and p3["total"] == 27
    assert client.get("/api/listings", params={"page": 9}).json()["items"] == []


def test_search_without_rates_excludes_noncomparable_from_price_filter(store_kind, tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import make_settings
    c = TestClient(create_app(make_settings(store_kind, tmp_path, rates="none")))
    r = c.get("/api/listings", params={"maxPrice": 100000, "pageSize": 100}).json()
    assert r["total"] == 9 and {i["listing"]["currency"] for i in r["items"]} == {"EUR"}
    london = c.get("/api/listings", params={"city": "London"}).json()["items"]
    assert all(i["monthlyCost"] is None for i in london)


@pytest.mark.parametrize("params,field", [
    ({"minPrice": -5}, "minPrice"), ({"minPrice": "abc"}, "minPrice"), ({"minPrice": 900, "maxPrice": 100}, "minPrice"),
    ({"minRooms": 3, "maxRooms": 1}, "minRooms"), ({"minRooms": 0}, "minRooms"), ({"currency": "JPY"}, "currency"),
    ({"page": 0}, "page"), ({"pageSize": 101}, "pageSize"), ({"sort": "random"}, "sort"),
    ({"propertyTypes": "castle"}, "propertyTypes"), ({"amenities": "pool"}, "amenities"), ({"q": "x" * 101}, "q"),
])
def test_search_invalid_params(client, params, field):
    e = err(client.get("/api/listings", params=params), 400)
    assert e["code"] == "VALIDATION_ERROR" and field in fields(e)


# --- detail and duplicates --------------------------------------------------------------------
def test_detail_with_duplicates_and_currency(client):
    d = client.get("/api/listings/demo-berlin-2", params={"currency": "GBP"}).json()
    assert d["listing"]["currency"] == "EUR" and d["monthlyCost"]["currency"] == "GBP" and d["monthlyCost"]["converted"]
    assert d["monthlyCost"]["rateSource"] == "demo fixed rates (not live)"
    top = d["duplicates"][0]
    assert top["listingId"] == "demo-berlin-dup" and top["category"] == "probable" and top["reasons"]


def test_detail_not_found_and_bad_currency(client):
    assert err(client.get("/api/listings/nope"), 404)["code"] == "NOT_FOUND"
    assert "currency" in fields(err(client.get("/api/listings/demo-berlin-1", params={"currency": "XYZ"}), 400))


def test_different_cities_never_duplicates(client):
    for i in client.get("/api/listings/demo-london-dup").json()["duplicates"]:
        assert i["listingId"].startswith("demo-london")


# --- CRUD --------------------------------------------------------------------------------------
def test_create_update_delete(client):
    r = client.post("/api/listings", json=VALID)
    assert r.status_code == 201, r.text
    v = r.json()
    lid = v["listing"]["id"]
    assert v["listing"]["isDemo"] is False and v["listing"]["sourceId"] == "manual"
    assert v["monthlyCost"]["rentMonthly"] == 650 and v["monthlyCost"]["amount"] == 700  # 150*52/12 + 50
    assert client.get(f"/api/listings/{lid}").status_code == 200

    u = client.put(f"/api/listings/{lid}", json={"rentAmount": 600, "rentPeriod": "month"})
    assert u.status_code == 200 and u.json()["monthlyCost"]["amount"] == 650
    assert u.json()["listing"]["title"] == VALID["title"]

    assert client.delete(f"/api/listings/{lid}").status_code == 204
    assert client.get(f"/api/listings/{lid}").status_code == 404
    assert client.delete(f"/api/listings/{lid}").status_code == 404


@pytest.mark.parametrize("patch,field", [
    ({"rentAmount": -1}, "rentAmount"), ({"rentAmount": 0}, "rentAmount"), ({"currency": "BTC"}, "currency"),
    ({"rooms": 0}, "rooms"), ({"rooms": 2.5}, "rooms"), ({"utilitiesMonthly": -3}, "utilitiesMonthly"),
    ({"title": "  "}, "title"), ({"propertyType": "castle"}, "propertyType"), ({"amenities": ["pool"]}, "amenities"),
    ({"rentPeriod": "day"}, "rentPeriod"), ({"sourceUrl": "javascript:alert(1)"}, "sourceUrl"),
])
def test_create_invalid(client, patch, field):
    e = err(client.post("/api/listings", json={**VALID, **patch}), 400)
    assert field in fields(e)


def test_create_missing_fields(client):
    e = err(client.post("/api/listings", json={}), 400)
    assert {"title", "city", "rentAmount", "currency"} <= fields(e)
    assert err(client.post("/api/listings", json=[1, 2]), 400)["code"] == "VALIDATION_ERROR"


def test_update_invalid_and_missing(client):
    assert "rentAmount" in fields(err(client.put("/api/listings/demo-berlin-1", json={"rentAmount": -10}), 400))
    assert "title" in fields(err(client.put("/api/listings/demo-berlin-1", json={"title": None}), 400))
    assert err(client.put("/api/listings/nope", json={"title": "x"}), 404)["code"] == "NOT_FOUND"


def test_original_currency_never_overwritten(client):
    before = client.get("/api/listings/demo-london-1").json()["listing"]
    client.get("/api/listings", params={"currency": "EUR"})
    after = client.get("/api/listings/demo-london-1", params={"currency": "USD"}).json()["listing"]
    assert before == after and after["currency"] == "GBP"


# --- favorites ---------------------------------------------------------------------------------
def test_favorites_idempotent_and_isolated(client):
    assert client.post("/api/favorites/demo-berlin-1").status_code == 204
    assert client.post("/api/favorites/demo-berlin-1").status_code == 204
    favs = client.get("/api/favorites").json()
    assert [f["listing"]["id"] for f in favs] == ["demo-berlin-1"] and favs[0]["isFavorite"]
    assert client.get("/api/listings/demo-berlin-1").json()["isFavorite"]
    assert client.get("/api/favorites", headers={"X-Demo-User": "other"}).json() == []
    assert client.delete("/api/favorites/demo-berlin-1").status_code == 204
    assert client.delete("/api/favorites/demo-berlin-1").status_code == 204
    assert client.get("/api/favorites").json() == []


def test_favorite_unknown_listing_404(client):
    assert err(client.post("/api/favorites/nope"), 404)["code"] == "NOT_FOUND"


def test_deleting_listing_removes_favorite(client):
    lid = client.post("/api/listings", json=VALID).json()["listing"]["id"]
    client.post(f"/api/favorites/{lid}")
    client.delete(f"/api/listings/{lid}")
    assert client.get("/api/favorites").json() == []


# --- compare -----------------------------------------------------------------------------------
def test_compare(client):
    r = client.post("/api/compare", json={"ids": ["demo-berlin-1", "demo-london-1", "demo-toronto-1"], "currency": "EUR"})
    assert r.status_code == 200, r.text
    c = r.json()
    assert [i["listing"]["id"] for i in c["items"]] == ["demo-berlin-1", "demo-london-1", "demo-toronto-1"]
    cheapest = min(c["items"], key=lambda i: i["monthlyCost"]["amount"])["listing"]["id"]
    assert c["cheapestId"] == cheapest and set(c["amenityMatrix"]) >= {"wifi", "furnished"}


@pytest.mark.parametrize("ids", [["demo-berlin-1"], ["demo-berlin-1"] * 2,
                                 ["demo-berlin-1", "demo-berlin-2", "demo-berlin-3", "demo-berlin-4"]])
def test_compare_invalid_counts(client, ids):
    assert "ids" in fields(err(client.post("/api/compare", json={"ids": ids}), 400))


def test_compare_unknown_and_bad_body(client):
    assert err(client.post("/api/compare", json={"ids": ["demo-berlin-1", "nope"]}), 404)["code"] == "NOT_FOUND"
    assert err(client.post("/api/compare", json={"ids": "x"}), 400)["code"] == "VALIDATION_ERROR"
    assert "currency" in fields(err(client.post("/api/compare", json={"ids": ["demo-berlin-1", "demo-berlin-2"],
                                                                      "currency": "ABC"}), 400))


def test_compare_without_rates_has_null_cost(store_kind, tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import make_settings
    c = TestClient(create_app(make_settings(store_kind, tmp_path, rates="none")))
    r = c.post("/api/compare", json={"ids": ["demo-berlin-1", "demo-london-1"], "currency": "EUR"}).json()
    assert r["items"][1]["monthlyCost"] is None and r["cheapestId"] == "demo-berlin-1"


# --- sources and refresh -----------------------------------------------------------------------
def test_sources_and_refresh(client):
    s = client.get("/api/sources").json()
    assert [x["id"] for x in s] == ["demo-a", "demo-b"] and all(x["status"] == "never_run" for x in s)
    assert sum(x["listingCount"] for x in s) == 27
    r = client.post("/api/sources/refresh").json()
    assert [o["ok"] for o in r["outcomes"]] == [True, True] and sum(o["fetched"] for o in r["outcomes"]) == 27
    s = client.get("/api/sources").json()
    assert all(x["status"] == "ok" and x["lastSuccessAt"] == x["lastCheckedAt"] for x in s)
    assert client.get("/api/listings").json()["total"] == 27  # refresh never duplicates rows
