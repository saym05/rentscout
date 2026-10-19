import threading
import time

from fastapi.testclient import TestClient

from app.adapters.base import AdapterError
from app.adapters.demo import DemoAdapter, default_adapters
from app.main import create_app
from tests.conftest import VALID, make_settings


def test_failing_source_keeps_listings_and_is_reported(store_kind, tmp_path):
    c = TestClient(create_app(make_settings(store_kind, tmp_path, failing_sources={"demo-b"})))
    before = c.get("/api/listings", params={"pageSize": 100}).json()["total"]
    r = c.post("/api/sources/refresh").json()
    by = {o["sourceId"]: o for o in r["outcomes"]}
    assert by["demo-a"]["ok"] and not by["demo-b"]["ok"] and "simulated" in by["demo-b"]["error"]
    s = {x["id"]: x for x in c.get("/api/sources").json()}
    assert s["demo-b"]["status"] == "failed" and s["demo-b"]["lastSuccessAt"] is None and s["demo-b"]["lastCheckedAt"]
    assert s["demo-b"]["listingCount"] > 0
    assert c.get("/api/listings", params={"pageSize": 100}).json()["total"] == before


def test_unexpected_adapter_error_is_generic(store_kind, tmp_path):
    class Broken(DemoAdapter):
        def fetch(self):
            raise RuntimeError("secret internal detail")
    c = TestClient(create_app(make_settings(store_kind, tmp_path), adapters=[Broken("demo-a", "A")]))
    o = c.post("/api/sources/refresh").json()["outcomes"][0]
    assert not o["ok"] and "secret" not in o["error"]


def test_concurrent_refresh_returns_409(store_kind, tmp_path):
    started, release = threading.Event(), threading.Event()

    class Slow(DemoAdapter):
        def fetch(self):
            started.set()
            release.wait(5)
            return super().fetch()

    c = TestClient(create_app(make_settings(store_kind, tmp_path), adapters=[Slow("demo-a", "A")]))
    results = {}
    t = threading.Thread(target=lambda: results.setdefault("first", c.post("/api/sources/refresh")))
    t.start()
    assert started.wait(5)
    second = c.post("/api/sources/refresh")
    release.set()
    t.join(5)
    assert second.status_code == 409 and second.json()["error"]["code"] == "REFRESH_IN_PROGRESS"
    assert results["first"].status_code == 200
    assert c.post("/api/sources/refresh").status_code == 200  # lock released


def test_refresh_updates_changed_source_fields(store_kind, tmp_path):
    class PriceDrop(DemoAdapter):
        def fetch(self):
            return [l.model_copy(update={"rent_amount": 1.0}) if l.id == "demo-berlin-1" else l for l in super().fetch()]
    adapters = [PriceDrop("demo-a", "A"), *default_adapters()[1:]]
    c = TestClient(create_app(make_settings(store_kind, tmp_path), adapters=adapters))
    before = c.get("/api/listings/demo-berlin-1").json()["listing"]
    c.post("/api/sources/refresh")
    after = c.get("/api/listings/demo-berlin-1").json()["listing"]
    assert after["rentAmount"] == 1 and after["updatedAt"] != before["updatedAt"]
    assert after["firstSeenAt"] == before["firstSeenAt"]


def test_adapter_error_is_typed():
    assert issubclass(AdapterError, Exception)
    time.sleep(0)


def test_refresh_source_wins_over_edits_to_imported_listings(client):
    """Decision D-refresh (docs/decisions.md): the source owns imported listings; manual listings are untouched."""
    client.put("/api/listings/demo-berlin-1", json={"title": "Local edit"})
    manual = client.post("/api/listings", json={**VALID, "title": "Mine"}).json()["listing"]["id"]
    client.post("/api/sources/refresh")
    assert client.get("/api/listings/demo-berlin-1").json()["listing"]["title"] != "Local edit"
    assert client.get(f"/api/listings/{manual}").json()["listing"]["title"] == "Mine"
