"""Data survives a backend restart (new app + new engine on the same SQLite file)."""
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

import pytest

from app.db import make_engine, migrate
from app.main import create_app
from tests.conftest import VALID, make_settings


def test_restart_keeps_created_edited_deleted_and_favorites(tmp_path):
    s = make_settings("sql", tmp_path)
    c1 = TestClient(create_app(s))
    lid = c1.post("/api/listings", json=VALID).json()["listing"]["id"]
    c1.post("/api/sources/refresh")
    c1.put("/api/listings/demo-berlin-1", json={"title": "Edited title"})
    c1.delete("/api/listings/demo-berlin-3")
    c1.post(f"/api/favorites/{lid}")

    c2 = TestClient(create_app(s))  # "restart": fresh engine, migrations and seed run again
    assert c2.get(f"/api/listings/{lid}").json()["listing"]["title"] == VALID["title"]
    assert c2.get("/api/listings/demo-berlin-1").json()["listing"]["title"] == "Edited title"
    assert c2.get("/api/listings/demo-berlin-3").status_code == 404  # seed does not resurrect deletions
    assert [f["listing"]["id"] for f in c2.get("/api/favorites").json()] == [lid]
    assert all(x["status"] == "ok" for x in c2.get("/api/sources").json())
    assert c2.get("/api/listings").json()["total"] == 27  # 27 seeded - 1 deleted + 1 created


def test_seed_is_idempotent(tmp_path):
    s = make_settings("sql", tmp_path)
    create_app(s)
    create_app(s)
    with make_engine(s.database_url).connect() as conn:
        assert conn.execute(text("select count(*) from listings")).scalar() == 27
        assert conn.execute(text("select count(*) from sources")).scalar() == 2


def test_migration_creates_schema_and_constraints(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'm.db'}")
    migrate(engine)
    migrate(engine)  # re-running is a no-op
    insp = inspect(engine)
    assert {"listings", "favorites", "sources", "alembic_version"} <= set(insp.get_table_names())
    assert {"ix_listings_city", "ix_listings_neighborhood", "ix_listings_source_id"} <= {i["name"] for i in insp.get_indexes("listings")}
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(text(
            "insert into listings (id,title,description,city,neighborhood,property_type,rooms,rent_amount,rent_period,"
            "currency,utilities_included,monthly_cost_native,amenities,source_id,is_demo,first_seen_at,last_seen_at,"
            "updated_at) values ('x','t','','c','n','room',1,-5,'month','EUR',0,0,'[]','s',0,"
            "'2026-01-01','2026-01-01','2026-01-01')"))


def test_migration_matches_models(tmp_path):
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.db import Base
    engine = make_engine(f"sqlite:///{tmp_path / 'm.db'}")
    migrate(engine)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []
