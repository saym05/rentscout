import type { Currency, Listing, MonthlyCost, RateTable } from "./types";

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Weekly rents become monthly via 52/12 weeks per month. */
export function monthlyRent(l: Pick<Listing, "rentAmount" | "rentPeriod">): number {
  return round2(l.rentPeriod === "week" ? (l.rentAmount * 52) / 12 : l.rentAmount);
}

/** Monthly cost in the listing's ORIGINAL currency: rent + utilities when excluded and known. */
export function nativeMonthlyCost(l: Listing) {
  const rentMonthlyValue = monthlyRent(l);
  const utilitiesKnown = l.utilitiesIncluded || l.utilitiesMonthly !== null;
  const utilitiesMonthly = l.utilitiesIncluded ? 0 : (l.utilitiesMonthly ?? 0);
  return {
    amount: round2(rentMonthlyValue + utilitiesMonthly),
    rentMonthly: rentMonthlyValue,
    utilitiesMonthly,
    utilitiesKnown,
  };
}

/**
 * Express a listing's monthly cost in `currency`.
 * Returns null when the currencies differ and no rate table is available: we never guess a rate.
 */
export function toDisplayCost(l: Listing, currency: Currency, rates?: RateTable): MonthlyCost | null {
  const n = nativeMonthlyCost(l);
  const native = { amount: n.amount, currency: l.currency };
  const base = {
    native,
    rentMonthly: n.rentMonthly,
    utilitiesMonthly: n.utilitiesMonthly,
    utilitiesKnown: n.utilitiesKnown,
  };
  if (l.currency === currency) {
    return { amount: n.amount, currency, converted: false, ...base };
  }
  if (!rates) return null;
  const from = rates.eurPer[l.currency];
  const to = rates.eurPer[currency];
  if (!from || !to || from <= 0 || to <= 0) return null;
  const rate = from / to;
  return {
    amount: round2(n.amount * rate),
    currency,
    converted: true,
    rate: Math.round(rate * 1e6) / 1e6,
    rateAsOf: rates.asOf,
    rateSource: rates.source,
    ...base,
  };
}
