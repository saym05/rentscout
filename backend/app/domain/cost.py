from .jsmath import js_round, round2
from .models import Listing, MonthlyCost, NativeAmount, RateTable


def monthly_rent(rent_amount: float, rent_period: str) -> float:
    """Weekly rents become monthly via 52/12 weeks per month."""
    return round2(rent_amount * 52 / 12 if rent_period == "week" else rent_amount)


def native_monthly_cost(l: Listing) -> dict:
    """Monthly cost in the listing's ORIGINAL currency: rent + utilities when excluded and known."""
    rent = monthly_rent(l.rent_amount, l.rent_period)
    utilities_known = l.utilities_included or l.utilities_monthly is not None
    utilities = 0.0 if l.utilities_included else (l.utilities_monthly or 0.0)
    return {"amount": round2(rent + utilities), "rent_monthly": rent,
            "utilities_monthly": float(utilities), "utilities_known": utilities_known}


def to_display_cost(l: Listing, currency: str, rates: RateTable | None) -> MonthlyCost | None:
    """None when the currencies differ and no rate table is available: we never guess a rate."""
    n = native_monthly_cost(l)
    base = dict(native=NativeAmount(amount=n["amount"], currency=l.currency), rent_monthly=n["rent_monthly"],
                utilities_monthly=n["utilities_monthly"], utilities_known=n["utilities_known"])
    if l.currency == currency:
        return MonthlyCost(amount=n["amount"], currency=currency, converted=False, **base)
    if rates is None:
        return None
    src, dst = rates.eur_per.get(l.currency), rates.eur_per.get(currency)
    if not src or not dst or src <= 0 or dst <= 0:
        return None
    rate = src / dst
    return MonthlyCost(amount=round2(n["amount"] * rate), currency=currency, converted=True,
                       rate=js_round(rate * 1e6) / 1e6, rate_as_of=rates.as_of, rate_source=rates.source, **base)
