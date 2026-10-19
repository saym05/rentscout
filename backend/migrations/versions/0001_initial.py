"""initial schema

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listings",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("neighborhood", sa.String(100), nullable=False),
        sa.Column("property_type", sa.String(20), nullable=False),
        sa.Column("rooms", sa.Integer, nullable=False),
        sa.Column("area_sqm", sa.Float, nullable=True),
        sa.Column("rent_amount", sa.Float, nullable=False),
        sa.Column("rent_period", sa.String(10), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("utilities_included", sa.Boolean, nullable=False),
        sa.Column("utilities_monthly", sa.Float, nullable=True),
        sa.Column("monthly_cost_native", sa.Float, nullable=False),
        sa.Column("amenities", sa.JSON, nullable=False),
        sa.Column("source_id", sa.String(64), nullable=False),
        sa.Column("external_id", sa.String(128), nullable=True),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("is_demo", sa.Boolean, nullable=False),
        sa.Column("first_seen_at", sa.DateTime, nullable=False),
        sa.Column("last_seen_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("source_id", "external_id", name="uq_listings_source_external"),
        sa.CheckConstraint("rent_amount > 0", name="ck_listings_rent_positive"),
        sa.CheckConstraint("rooms >= 1 AND rooms <= 20", name="ck_listings_rooms_range"),
        sa.CheckConstraint("utilities_monthly IS NULL OR utilities_monthly >= 0", name="ck_listings_utilities_nonneg"),
    )
    op.create_index("ix_listings_city", "listings", ["city"])
    op.create_index("ix_listings_neighborhood", "listings", ["neighborhood"])
    op.create_index("ix_listings_source_id", "listings", ["source_id"])
    op.create_table(
        "favorites",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("listing_id", sa.String(64), sa.ForeignKey("listings.id"), primary_key=True),
    )
    op.create_table(
        "sources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("last_checked_at", sa.DateTime, nullable=True),
        sa.Column("last_success_at", sa.DateTime, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sources")
    op.drop_table("favorites")
    op.drop_index("ix_listings_source_id", "listings")
    op.drop_index("ix_listings_neighborhood", "listings")
    op.drop_index("ix_listings_city", "listings")
    op.drop_table("listings")
