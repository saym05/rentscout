import type { Currency, MonthlyCost } from "../domain/types";

export function money(amount: number, currency: Currency, digits = 0): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}

export function rateNote(c: MonthlyCost): string | null {
  if (!c.converted || !c.rate) return null;
  const asOf = c.rateAsOf ? new Date(c.rateAsOf).toISOString().slice(0, 10) : "unknown date";
  return `Converted from ${c.native.currency} at 1 ${c.native.currency} = ${c.rate} ${c.currency} (${c.rateSource ?? "unknown source"}, ${asOf})`;
}

export const TYPE_LABEL = { studio: "Studio", apartment: "Apartment", room: "Room", house: "House" } as const;
export const AMENITY_LABEL: Record<string, string> = {
  furnished: "Furnished", wifi: "Wi-Fi", washer: "Washer", dishwasher: "Dishwasher", balcony: "Balcony",
  parking: "Parking", gym: "Gym", "pets-allowed": "Pets allowed", elevator: "Elevator",
};
