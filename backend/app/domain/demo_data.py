"""Python port of frontend/src/services/demoData.ts. Must produce byte-identical data (checked by tests)."""
from .jsmath import iso_ms, js_round, parse_iso_ms
from .models import AMENITIES, Listing, RateTable

DEMO_RATES = RateTable(as_of="2026-10-01T00:00:00Z", source="demo fixed rates (not live)",
                       eur_per={"EUR": 1, "GBP": 1.16, "CAD": 0.65, "USD": 0.92})

M32 = 0xFFFFFFFF


def mulberry32(seed: int):
    a = seed & M32

    def imul(x: int, y: int) -> int:
        return (x * y) & M32

    def nxt() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return nxt


CITIES = [
    ("Berlin", "EUR", ["Kreuzberg", "Neukölln", "Prenzlauer Berg", "Charlottenburg"],
     {"studio": 750, "room": 520, "apartment": 1250, "house": 2100}),
    ("London", "GBP", ["Hackney", "Camden", "Brixton", "Greenwich"],
     {"studio": 1350, "room": 850, "apartment": 2000, "house": 3200}),
    ("Toronto", "CAD", ["The Annex", "Liberty Village", "Scarborough", "Leslieville"],
     {"studio": 1700, "room": 1100, "apartment": 2400, "house": 3600}),
]
TYPES = ["studio", "apartment", "room", "apartment", "apartment", "studio", "house", "apartment"]
ADJECTIVES = ["Bright", "Quiet", "Sunny", "Modern", "Cosy", "Spacious"]
EPOCH = 1790845200000  # Date.parse("2026-10-01T09:00:00Z")
DAY = 86_400_000


def _slug(s: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", s.lower())



def build_demo_listings() -> list[Listing]:
    rand = mulberry32(20261001)
    out: list[dict] = []
    for ci, (city, currency, hoods, base) in enumerate(CITIES):
        for i, ptype in enumerate(TYPES):
            if ptype in ("studio", "room"):
                rooms = 1
            elif ptype == "house":
                rooms = 3 + int(rand() * 2)
            else:
                rooms = 1 + int(rand() * 3)
            hood = hoods[int(rand() * len(hoods))]
            adj = ADJECTIVES[int(rand() * len(ADJECTIVES))]
            monthly = js_round((base[ptype] * (0.85 + rand() * 0.4) * (1 + 0.15 * (rooms - 1))) / 10) * 10
            weekly = i == 5
            utilities_included = rand() < 0.4
            utilities_known = rand() < 0.8
            amenities = [a for a in AMENITIES if rand() < 0.4]
            source_id = "demo-a" if i % 2 == 0 else "demo-b"
            external_id = f"{_slug(city)}-{i + 1}"
            seen = iso_ms(EPOCH - (i * 2 + ci) * DAY)
            out.append(dict(
                id=f"demo-{external_id}", title=f"{adj} {ptype} in {hood}",
                description=f"Demonstration listing. {rooms} room(s) in {hood}, {city}. This is sample data, not a real advertisement.",
                city=city, neighborhood=hood, property_type=ptype, rooms=rooms,
                area_sqm=14.0 if ptype == "room" else 20 + js_round(rand() * 60),
                rent_amount=js_round(monthly * 12 / 52) if weekly else monthly,
                rent_period="week" if weekly else "month", currency=currency,
                utilities_included=utilities_included,
                utilities_monthly=None if utilities_included else (js_round(60 + rand() * 90) if utilities_known else None),
                amenities=amenities, source_id=source_id, external_id=external_id,
                source_url=f"https://example.invalid/{source_id}/listings/{external_id}",
                is_demo=True, first_seen_at=seen, last_seen_at=seen, updated_at=seen,
            ))

    # One deliberate cross-source duplicate per city (same flat, other source, re-worded, ~2% price drift).
    dups = []
    for city, *_ in CITIES:
        original = next(l for l in out if l["city"] == city and l["id"].endswith("-2"))
        other = "demo-b" if original["source_id"] == "demo-a" else "demo-a"
        external_id = f"{_slug(city)}-dup"
        seen = iso_ms(parse_iso_ms(original["first_seen_at"]) + DAY)
        dups.append({**original, "id": f"demo-{external_id}",
                     "title": f"{original['title'].split(' ')[0]} {original['property_type']} near {original['neighborhood']} {original['rooms']} rooms",
                     "rent_amount": js_round(original["rent_amount"] * 1.02), "source_id": other, "external_id": external_id,
                     "source_url": f"https://example.invalid/{other}/listings/{external_id}",
                     "first_seen_at": seen, "last_seen_at": seen, "updated_at": seen})
    return [Listing(**d) for d in out + dups]


DEMO_SOURCES = [("demo-a", "Demo Source A (sample data)"), ("demo-b", "Demo Source B (sample data)")]
