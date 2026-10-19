import os
from dataclasses import dataclass, field


def _csv(v: str) -> list[str]:
    return [p.strip() for p in v.split(",") if p.strip()]


@dataclass
class Settings:
    store: str = "sql"  # "sql" or "memory"
    database_url: str = "sqlite:///./rentscout.db"
    rates: str = "demo"  # "demo" (fixed, labelled not live) or "none" (no conversion)
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173",
                                                             "http://localhost:4173", "http://127.0.0.1:4173"])
    failing_sources: set[str] = field(default_factory=set)

    @classmethod
    def from_env(cls) -> "Settings":
        s = cls()
        s.store = os.environ.get("RENTSCOUT_STORE", s.store)
        s.database_url = os.environ.get("DATABASE_URL", s.database_url)
        s.rates = os.environ.get("RENTSCOUT_RATES", s.rates)
        if "RENTSCOUT_CORS_ORIGINS" in os.environ:
            s.cors_origins = _csv(os.environ["RENTSCOUT_CORS_ORIGINS"])
        s.failing_sources = set(_csv(os.environ.get("RENTSCOUT_FAILING_SOURCES", "")))
        return s
