from typing import Any

from .errors import FieldError
from .models import AMENITIES, PROPERTY_TYPES, SUPPORTED_CURRENCIES

REQUIRED = ("title", "city", "neighborhood", "propertyType", "rooms", "rentAmount", "rentPeriod", "currency")
EDITABLE = REQUIRED + ("description", "areaSqm", "utilitiesIncluded", "utilitiesMonthly", "amenities", "sourceUrl")


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def validate_listing_input(i: dict[str, Any], partial: bool) -> list[FieldError]:
    """Mirror of validateListingInput in frontend/src/services/mockService.ts, plus JSON type checks."""
    e: list[FieldError] = []
    if not partial:
        e += [FieldError(k, "is required") for k in REQUIRED if i.get(k) in (None, "")]
    for k in ("title", "city", "neighborhood"):
        if k in i and i[k] is not None and (not isinstance(i[k], str) or not i[k].strip()):
            e.append(FieldError(k, "must not be blank"))
    if "description" in i and not isinstance(i["description"], str):
        e.append(FieldError("description", "must be a string"))
    if i.get("rentAmount") is not None and (not _is_num(i["rentAmount"]) or i["rentAmount"] <= 0):
        e.append(FieldError("rentAmount", "must be greater than 0"))
    if i.get("utilitiesMonthly") is not None and (not _is_num(i["utilitiesMonthly"]) or i["utilitiesMonthly"] < 0):
        e.append(FieldError("utilitiesMonthly", "must be >= 0"))
    if i.get("areaSqm") is not None and (not _is_num(i["areaSqm"]) or i["areaSqm"] <= 0):
        e.append(FieldError("areaSqm", "must be greater than 0"))
    if i.get("rooms") is not None:
        r = i["rooms"]
        if isinstance(r, bool) or not isinstance(r, int) or not 1 <= r <= 20:
            e.append(FieldError("rooms", "must be an integer from 1 to 20"))
    if i.get("currency") is not None and i["currency"] not in SUPPORTED_CURRENCIES:
        e.append(FieldError("currency", f"unsupported currency; use one of {', '.join(SUPPORTED_CURRENCIES)}"))
    if i.get("propertyType") is not None and i["propertyType"] not in PROPERTY_TYPES:
        e.append(FieldError("propertyType", "unknown property type"))
    if i.get("rentPeriod") is not None and i["rentPeriod"] not in ("month", "week"):
        e.append(FieldError("rentPeriod", "must be month or week"))
    if "utilitiesIncluded" in i and not isinstance(i["utilitiesIncluded"], bool):
        e.append(FieldError("utilitiesIncluded", "must be true or false"))
    if "amenities" in i:
        if not isinstance(i["amenities"], list):
            e.append(FieldError("amenities", "must be a list"))
        else:
            e += [FieldError("amenities", f"unknown amenity {a}") for a in i["amenities"] if a not in AMENITIES]
    if i.get("sourceUrl") is not None and (not isinstance(i["sourceUrl"], str) or not i["sourceUrl"].startswith(("http://", "https://"))):
        e.append(FieldError("sourceUrl", "must be an http(s) URL"))
    return e
