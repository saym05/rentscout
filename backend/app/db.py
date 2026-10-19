"""SQLAlchemy 2.x models. Portable types only (no SQLite-specific SQL); DATABASE_URL selects the engine."""
from datetime import datetime

from sqlalchemy import (JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text,
                        UniqueConstraint, create_engine)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class ListingRow(Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_listings_source_external"),
        CheckConstraint("rent_amount > 0", name="ck_listings_rent_positive"),
        CheckConstraint("rooms >= 1 AND rooms <= 20", name="ck_listings_rooms_range"),
        CheckConstraint("utilities_monthly IS NULL OR utilities_monthly >= 0", name="ck_listings_utilities_nonneg"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), index=True)
    neighborhood: Mapped[str] = mapped_column(String(100), index=True)
    property_type: Mapped[str] = mapped_column(String(20))
    rooms: Mapped[int] = mapped_column(Integer)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    rent_amount: Mapped[float] = mapped_column(Float)          # original amount
    rent_period: Mapped[str] = mapped_column(String(10))       # original period
    currency: Mapped[str] = mapped_column(String(3))           # original currency
    utilities_included: Mapped[bool] = mapped_column(Boolean)
    utilities_monthly: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_cost_native: Mapped[float] = mapped_column(Float)  # derived: normalized monthly cost in original currency
    amenities: Mapped[list[str]] = mapped_column(JSON, default=list)
    source_id: Mapped[str] = mapped_column(String(64), index=True)
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime)  # naive UTC
    last_seen_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class FavoriteRow(Base):
    __tablename__ = "favorites"
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id"), primary_key=True)


class SourceRow(Base):
    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20))
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


def make_engine(url: str) -> Engine:
    args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=args)


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)


def migrate(engine: Engine) -> None:
    """Apply Alembic migrations up to head (creates the schema from empty)."""
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(Path(__file__).parent.parent / "migrations"))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
