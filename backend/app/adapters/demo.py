from app.domain.demo_data import DEMO_SOURCES, build_demo_listings
from app.domain.models import Listing

from .base import AdapterError, SourceAdapter


class DemoAdapter:
    """Serves the deterministic, labelled demo dataset for one demo source. Not live data."""
    kind = "demo"

    def __init__(self, source_id: str, name: str) -> None:
        self.source_id, self.name = source_id, name

    def fetch(self) -> list[Listing]:
        return [l for l in build_demo_listings() if l.source_id == self.source_id]


class FailingAdapter(DemoAdapter):
    """Test hook (RENTSCOUT_FAILING_SOURCES): a demo source that always fails, to exercise partial failure."""

    def fetch(self) -> list[Listing]:
        raise AdapterError(f"{self.name} is unreachable (simulated failure)")


def default_adapters(failing: set[str] = frozenset()) -> list[SourceAdapter]:
    return [(FailingAdapter if sid in failing else DemoAdapter)(sid, name) for sid, name in DEMO_SOURCES]
