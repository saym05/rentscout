import warnings

import pytest

warnings.filterwarnings("ignore", message=".*httpx.*")
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def make_settings(kind: str, tmp_path, **kw) -> Settings:
    s = Settings(store=kind, database_url=f"sqlite:///{tmp_path / 'test.db'}")
    for k, v in kw.items():
        setattr(s, k, v)
    return s


@pytest.fixture(params=["memory", "sql"])
def store_kind(request):
    return request.param


@pytest.fixture
def client(store_kind, tmp_path):
    return TestClient(create_app(make_settings(store_kind, tmp_path)), raise_server_exceptions=False)


VALID = {"title": "Room near campus", "city": "Berlin", "neighborhood": "Mitte", "propertyType": "room", "rooms": 1,
         "rentAmount": 150, "rentPeriod": "week", "currency": "EUR", "utilitiesIncluded": False,
         "utilitiesMonthly": 50, "amenities": ["wifi"], "sourceUrl": None}
