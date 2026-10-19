import re
import unicodedata

from .cost import to_display_cost
from .jsmath import js_num, js_round
from .models import DuplicateMatch, Listing, RateTable

STOPWORDS = {"in", "near", "the", "a", "an", "at", "for", "with", "and", "of", "to"}


def norm(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower().strip())


def tokens(s: str) -> set[str]:
    return {t for t in re.sub(r"[^a-z0-9 ]+", " ", norm(s)).split(" ") if t and t not in STOPWORDS}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def duplicate_score(a: Listing, b: Listing, rates: RateTable | None) -> tuple[float, str, list[str]]:
    """Weights sum to 1: neighborhood .25, rooms .15, price .25, title .25, area .10 (docs/architecture.md)."""
    if a.id == b.id or norm(a.city) != norm(b.city):
        return 0.0, "none", []
    reasons: list[str] = []
    score = 0.0
    if norm(a.neighborhood) == norm(b.neighborhood):
        score += 0.25
        reasons.append("same neighborhood")
    if a.rooms == b.rooms:
        score += 0.15
        reasons.append("same number of rooms")

    ca, cb = to_display_cost(a, a.currency, rates), to_display_cost(b, a.currency, rates)
    if ca and cb:
        diff = abs(ca.amount - cb.amount) / max(ca.amount, cb.amount)
        pct = js_num(js_round(diff * 1000) / 10)
        if diff <= 0.05:
            score += 0.25
            reasons.append(f"monthly cost within {pct}%")
        elif diff <= 0.1:
            score += 0.12
            reasons.append(f"monthly cost within {pct}% (loose)")
    else:
        reasons.append("prices not comparable (different currencies, no rate table)")

    sim = jaccard(tokens(a.title), tokens(b.title))
    if sim > 0:
        score += 0.25 * sim
        reasons.append(f"title similarity {js_num(js_round(sim * 100))}%")

    if a.area_sqm is not None and b.area_sqm is not None:
        if abs(a.area_sqm - b.area_sqm) / max(a.area_sqm, b.area_sqm) <= 0.05:
            score += 0.1
            reasons.append("area within 5%")

    if a.source_id != b.source_id:
        reasons.append("listed by different sources")

    rounded = js_round(score * 100) / 100
    category = "probable" if rounded >= 0.8 else "possible" if rounded >= 0.6 else "none"
    return rounded, category, reasons


def find_duplicates(target: Listing, all_listings: list[Listing], rates: RateTable | None) -> list[DuplicateMatch]:
    """Never deletes or merges anything: only reports candidates, best first."""
    out = []
    for o in all_listings:
        if o.id == target.id:
            continue
        score, category, reasons = duplicate_score(target, o, rates)
        if category != "none":
            out.append(DuplicateMatch(listing_id=o.id, score=score, category=category, reasons=reasons))
    return sorted(out, key=lambda m: (-m.score, m.listing_id))
