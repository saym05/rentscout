"""Helpers that reproduce JavaScript number semantics so Python and TypeScript agree to the cent."""
import math
from datetime import datetime, timezone

EPSILON = 2.220446049250313e-16


def js_round(x: float) -> float:
    """Math.round: halves round up (Python's round() rounds halves to even)."""
    return float(math.floor(x + 0.5))


def round2(n: float) -> float:
    return js_round((n + EPSILON) * 100) / 100


def js_num(x: float) -> str:
    """String(x) for a JS number."""
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def iso_ms(ms: int) -> str:
    """new Date(ms).toISOString()"""
    dt = datetime.fromtimestamp(ms // 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms % 1000:03d}Z"


def parse_iso_ms(s: str) -> int:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return int(dt.timestamp() * 1000)


def now_iso() -> str:
    return iso_ms(int(datetime.now(timezone.utc).timestamp() * 1000))
