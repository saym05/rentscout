import type { Amenity, Currency, Listing, PropertyType, RateTable, SourceStatus } from "../domain/types";
import { AMENITIES } from "../domain/types";

/** Deterministic PRNG so demo data is identical on every run and in every test. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Demo rates are fixed, NOT live. The label travels with every converted price. */
export const DEMO_RATES: RateTable = {
  asOf: "2026-10-01T00:00:00Z",
  source: "demo fixed rates (not live)",
  eurPer: { EUR: 1, GBP: 1.16, CAD: 0.65, USD: 0.92 },
};

const CITIES: { city: string; currency: Currency; hoods: string[]; base: Record<PropertyType, number> }[] = [
  { city: "Berlin", currency: "EUR", hoods: ["Kreuzberg", "Neukölln", "Prenzlauer Berg", "Charlottenburg"],
    base: { studio: 750, room: 520, apartment: 1250, house: 2100 } },
  { city: "London", currency: "GBP", hoods: ["Hackney", "Camden", "Brixton", "Greenwich"],
    base: { studio: 1350, room: 850, apartment: 2000, house: 3200 } },
  { city: "Toronto", currency: "CAD", hoods: ["The Annex", "Liberty Village", "Scarborough", "Leslieville"],
    base: { studio: 1700, room: 1100, apartment: 2400, house: 3600 } },
];
const TYPES: PropertyType[] = ["studio", "apartment", "room", "apartment", "apartment", "studio", "house", "apartment"];
const ADJECTIVES = ["Bright", "Quiet", "Sunny", "Modern", "Cosy", "Spacious"];
const EPOCH = Date.parse("2026-10-01T09:00:00Z");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function buildDemoListings(): Listing[] {
  const rand = mulberry32(20261001);
  const out: Listing[] = [];
  CITIES.forEach((c, ci) => {
    TYPES.forEach((type, i) => {
      const rooms = type === "studio" || type === "room" ? 1 : type === "house" ? 3 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
      const hood = c.hoods[Math.floor(rand() * c.hoods.length)]!;
      const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]!;
      const monthly = Math.round((c.base[type] * (0.85 + rand() * 0.4) * (1 + 0.15 * (rooms - 1))) / 10) * 10;
      const weekly = i === 5;
      const utilitiesIncluded = rand() < 0.4;
      const utilitiesKnown = rand() < 0.8;
      const amenities: Amenity[] = AMENITIES.filter(() => rand() < 0.4);
      const sourceId = i % 2 === 0 ? "demo-a" : "demo-b";
      const externalId = `${slug(c.city)}-${i + 1}`;
      const seen = iso(EPOCH - (i * 2 + ci) * DAY);
      out.push({
        id: `demo-${externalId}`,
        title: `${adj} ${type} in ${hood}`,
        description: `Demonstration listing. ${rooms} room(s) in ${hood}, ${c.city}. This is sample data, not a real advertisement.`,
        city: c.city, neighborhood: hood, propertyType: type, rooms,
        areaSqm: type === "room" ? 14 : 20 + Math.round(rand() * 60),
        rentAmount: weekly ? Math.round((monthly * 12) / 52) : monthly,
        rentPeriod: weekly ? "week" : "month",
        currency: c.currency,
        utilitiesIncluded,
        utilitiesMonthly: utilitiesIncluded ? null : utilitiesKnown ? Math.round(60 + rand() * 90) : null,
        amenities, sourceId, externalId,
        sourceUrl: `https://example.invalid/${sourceId}/listings/${externalId}`,
        isDemo: true, firstSeenAt: seen, lastSeenAt: seen, updatedAt: seen,
      });
    });
  });

  // One deliberate cross-source duplicate per city (same flat, listed by the other source, re-worded, ~2% price drift).
  const dups: Listing[] = [];
  CITIES.forEach((c) => {
    const original = out.find((l) => l.city === c.city && l.id.endsWith("-2"))!; // index 1 => demo-b
    const otherSource = original.sourceId === "demo-a" ? "demo-b" : "demo-a";
    const externalId = `${slug(c.city)}-dup`;
    const seen = iso(Date.parse(original.firstSeenAt) + DAY);
    dups.push({
      ...original,
      id: `demo-${externalId}`,
      title: `${original.title.split(" ")[0]} ${original.propertyType} near ${original.neighborhood} ${original.rooms} rooms`,
      rentAmount: Math.round(original.rentAmount * 1.02),
      sourceId: otherSource, externalId,
      sourceUrl: `https://example.invalid/${otherSource}/listings/${externalId}`,
      firstSeenAt: seen, lastSeenAt: seen, updatedAt: seen,
    });
  });
  return [...out, ...dups];
}

export function buildDemoSources(): SourceStatus[] {
  return [
    { id: "demo-a", name: "Demo Source A (sample data)", kind: "demo", status: "never_run", lastCheckedAt: null, lastSuccessAt: null, listingCount: 0, error: null },
    { id: "demo-b", name: "Demo Source B (sample data)", kind: "demo", status: "never_run", lastCheckedAt: null, lastSuccessAt: null, listingCount: 0, error: null },
  ];
}
