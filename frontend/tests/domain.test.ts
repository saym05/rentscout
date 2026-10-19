import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthlyRent, nativeMonthlyCost, toDisplayCost } from "../src/domain/cost";
import { duplicateScore, findDuplicates } from "../src/domain/duplicates";
import { ApiError } from "../src/domain/errors";
import { searchListings, validateQuery } from "../src/domain/search";
import { buildDemoListings, DEMO_RATES } from "../src/services/demoData";
import type { Listing } from "../src/domain/types";

const base: Listing = {
  id: "x1", title: "Bright apartment in Kreuzberg", description: "", city: "Berlin", neighborhood: "Kreuzberg",
  propertyType: "apartment", rooms: 2, areaSqm: 50, rentAmount: 1000, rentPeriod: "month", currency: "EUR",
  utilitiesIncluded: false, utilitiesMonthly: 100, amenities: ["wifi"], sourceId: "s1", externalId: "1",
  sourceUrl: null, isDemo: true, firstSeenAt: "2026-10-01T00:00:00Z", lastSeenAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
};
const L = (o: Partial<Listing>): Listing => ({ ...base, ...o });
const demo = buildDemoListings();

describe("monthly cost normalization", () => {
  it("weekly rent converts at 52/12", () => assert.equal(monthlyRent({ rentAmount: 300, rentPeriod: "week" }), 1300));
  it("adds utilities when excluded and known", () => assert.equal(nativeMonthlyCost(base).amount, 1100));
  it("ignores utilities when included", () => assert.equal(nativeMonthlyCost(L({ utilitiesIncluded: true })).amount, 1000));
  it("flags unknown utilities and does not invent a number", () => {
    const c = nativeMonthlyCost(L({ utilitiesMonthly: null }));
    assert.equal(c.amount, 1000); assert.equal(c.utilitiesKnown, false);
  });
  it("same currency is not marked converted", () => assert.equal(toDisplayCost(base, "EUR")?.converted, false));
  it("different currency without rates returns null (no guessing)", () => assert.equal(toDisplayCost(L({ currency: "GBP" }), "EUR"), null));
  it("conversion records rate, timestamp and source label", () => {
    const c = toDisplayCost(L({ currency: "GBP", utilitiesMonthly: 0 }), "EUR", DEMO_RATES)!;
    assert.equal(c.converted, true); assert.equal(c.amount, 1160); assert.equal(c.rateAsOf, DEMO_RATES.asOf);
    assert.match(c.rateSource!, /not live/); assert.deepEqual(c.native, { amount: 1000, currency: "GBP" });
  });
});

describe("demo data", () => {
  it("is deterministic", () => assert.deepEqual(buildDemoListings(), buildDemoListings()));
  it("is entirely labelled demo and has unique ids", () => {
    assert.ok(demo.every((l) => l.isDemo)); assert.equal(new Set(demo.map((l) => l.id)).size, demo.length);
  });
  it("covers several cities, currencies and amenities", () => {
    assert.ok(new Set(demo.map((l) => l.city)).size >= 3);
    assert.ok(new Set(demo.map((l) => l.currency)).size >= 3);
    assert.ok(new Set(demo.flatMap((l) => l.amenities)).size >= 5);
  });
  it("uses a reserved .invalid domain for source links", () => assert.ok(demo.every((l) => l.sourceUrl?.includes("example.invalid"))));
});

describe("search / filter / sort / pagination", () => {
  const r = (q = {}) => searchListings(demo, q, DEMO_RATES);
  it("filters by city (case/diacritic-insensitive)", () => {
    const res = r({ city: "berlin" }); assert.ok(res.total > 0); assert.ok(res.items.every((v) => v.listing.city === "Berlin"));
  });
  it("filters by neighborhood", () => assert.ok(r({ neighborhood: "kreuzberg" }).items.every((v) => v.listing.neighborhood === "Kreuzberg")));
  it("filters by price range in display currency", () => {
    const res = r({ minPrice: 1000, maxPrice: 1500 });
    assert.ok(res.total > 0); assert.ok(res.items.every((v) => v.monthlyCost!.amount >= 1000 && v.monthlyCost!.amount <= 1500));
  });
  it("filters by rooms and type and amenities", () => {
    const res = r({ minRooms: 2, maxRooms: 3, propertyTypes: ["apartment"], amenities: ["wifi"] });
    assert.ok(res.items.every((v) => v.listing.rooms >= 2 && v.listing.rooms <= 3 && v.listing.propertyType === "apartment" && v.listing.amenities.includes("wifi")));
  });
  it("sorts by lowest and highest cost", () => {
    const a = r({ sort: "price_asc", pageSize: 100 }).items.map((v) => v.monthlyCost!.amount);
    const d = r({ sort: "price_desc", pageSize: 100 }).items.map((v) => v.monthlyCost!.amount);
    assert.deepEqual(a, [...a].sort((x, y) => x - y)); assert.deepEqual(d, [...d].sort((x, y) => y - x));
  });
  it("sorts newest first", () => {
    const n = r({ sort: "newest", pageSize: 100 }).items.map((v) => v.listing.firstSeenAt);
    assert.deepEqual(n, [...n].sort().reverse());
  });
  it("paginates without overlap", () => {
    const p1 = r({ pageSize: 5, page: 1 }), p2 = r({ pageSize: 5, page: 2 });
    assert.equal(p1.items.length, 5); assert.equal(p1.total, demo.length);
    assert.ok(!p1.items.some((a) => p2.items.some((b) => b.listing.id === a.listing.id)));
  });
  it("returns empty page cleanly", () => { const e = r({ city: "Atlantis" }); assert.equal(e.total, 0); assert.deepEqual(e.items, []); });
  it("without rates, foreign-currency listings are excluded from price-bounded results and sorted last otherwise", () => {
    const strict = searchListings(demo, { maxPrice: 99999, currency: "EUR" }, undefined);
    assert.ok(strict.items.every((v) => v.listing.currency === "EUR"));
    const sorted = searchListings(demo, { sort: "price_asc", pageSize: 100 }, undefined).items;
    const firstNull = sorted.findIndex((v) => v.monthlyCost === null);
    assert.ok(firstNull > 0 && sorted.slice(firstNull).every((v) => v.monthlyCost === null));
  });
  it("rejects invalid parameters with field errors", () => {
    const bad = { minPrice: -5, maxPrice: -10, page: 0, pageSize: 500, currency: "XXX", sort: "cheap" } as never;
    assert.ok(validateQuery(bad).length >= 5);
    assert.throws(() => r(bad), (e) => e instanceof ApiError && e.status === 400 && e.details.length >= 5);
  });
  it("rejects min greater than max", () => assert.ok(validateQuery({ minPrice: 10, maxPrice: 5 }).some((e) => e.field === "minPrice")));
});

describe("duplicate detection", () => {
  it("flags a re-listed flat from another source as probable, with reasons", () => {
    const b = L({ id: "x2", sourceId: "s2", title: "Bright apartment near Kreuzberg 2 rooms", rentAmount: 1020 });
    const m = duplicateScore(base, b); assert.equal(m.category, "probable"); assert.ok(m.reasons.includes("same neighborhood"));
  });
  it("does not flag different city", () => assert.equal(duplicateScore(base, L({ id: "x3", city: "London" })).category, "none"));
  it("does not flag same area but different rooms, price and title", () => {
    const m = duplicateScore(base, L({ id: "x4", rooms: 4, rentAmount: 2400, title: "Family house", areaSqm: 120 })); assert.equal(m.category, "none");
  });
  it("does not compare itself", () => assert.equal(duplicateScore(base, base).category, "none"));
  it("notes when prices are not comparable", () => {
    const m = duplicateScore(base, L({ id: "x5", currency: "GBP" })); assert.ok(m.reasons.some((x) => x.includes("not comparable")));
  });
  it("demo data: exactly the 3 seeded pairs are probable, nothing else", () => {
    const pairs = new Set<string>();
    for (const l of demo) for (const m of findDuplicates(l, demo, DEMO_RATES)) if (m.category === "probable") pairs.add([l.id, m.listingId].sort().join("|"));
    assert.equal(pairs.size, 3, [...pairs].join(", "));
    assert.ok([...pairs].every((p) => p.includes("-dup")));
  });
  it("is read-only: input list is unchanged", () => { const before = JSON.stringify(demo); findDuplicates(demo[0]!, demo, DEMO_RATES); assert.equal(JSON.stringify(demo), before); });
});
