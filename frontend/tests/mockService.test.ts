import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../src/domain/errors";
import { MockService } from "../src/services/mockService";
import type { ListingInput } from "../src/services/ApiService";

const fixed = () => new Date("2026-10-19T12:00:00Z");
const svc = (o = {}) => new MockService({ clock: fixed, ...o });
const rejects = (p: Promise<unknown>, status: number, code?: string) =>
  assert.rejects(p, (e) => e instanceof ApiError && e.status === status && (!code || e.code === code));
const valid: ListingInput = {
  title: "Test flat", description: "", city: "Berlin", neighborhood: "Mitte", propertyType: "apartment", rooms: 2,
  areaSqm: 40, rentAmount: 900, rentPeriod: "month", currency: "EUR", utilitiesIncluded: true, utilitiesMonthly: null, amenities: [], sourceUrl: null,
};

describe("favorites", () => {
  it("add, list, remove; remove is idempotent", async () => {
    const s = svc(); const id = (await s.search({})).items[0]!.listing.id;
    await s.addFavorite(id);
    assert.deepEqual((await s.listFavorites()).map((v) => v.listing.id), [id]);
    assert.equal((await s.search({})).items.find((v) => v.listing.id === id)!.isFavorite, true);
    await s.removeFavorite(id); await s.removeFavorite(id);
    assert.equal((await s.listFavorites()).length, 0);
  });
  it("cannot favorite a missing listing", async () => rejects(svc().addFavorite("nope"), 404, "NOT_FOUND"));
});

describe("compare", () => {
  it("compares 2-3 listings, identifies the cheapest and builds an amenity matrix", async () => {
    const s = svc(); const ids = (await s.search({ city: "Berlin", pageSize: 3 })).items.map((v) => v.listing.id);
    const c = await s.compare(ids); assert.equal(c.items.length, 3);
    const min = Math.min(...c.items.map((i) => i.monthlyCost!.amount));
    assert.equal(c.items.find((i) => i.listing.id === c.cheapestId)!.monthlyCost!.amount, min);
    assert.ok("wifi" in c.amenityMatrix);
  });
  it("rejects <2, >3 and duplicate ids and unknown ids", async () => {
    const s = svc(); const ids = (await s.search({ pageSize: 5 })).items.map((v) => v.listing.id);
    await rejects(s.compare([ids[0]!]), 400); await rejects(s.compare(ids.slice(0, 4)), 400);
    await rejects(s.compare([ids[0]!, ids[0]!]), 400); await rejects(s.compare([ids[0]!, "nope"]), 404);
  });
  it("converts mixed currencies using labelled rates", async () => {
    const s = svc(); const b = (await s.search({ city: "Berlin" })).items[0]!.listing.id; const l = (await s.search({ city: "London" })).items[0]!.listing.id;
    const c = await s.compare([b, l], "EUR"); assert.ok(c.items.find((i) => i.listing.id === l)!.monthlyCost!.converted);
  });
  it("without rates, non-comparable items have null cost and cheapest ignores them", async () => {
    const s = svc({ rates: undefined }); const b = (await s.search({ city: "Berlin" })).items[0]!.listing.id; const l = (await s.search({ city: "London", currency: "GBP" })).items[0]!.listing.id;
    const c = await s.compare([b, l], "EUR"); assert.equal(c.items.find((i) => i.listing.id === l)!.monthlyCost, null); assert.equal(c.cheapestId, b);
  });
});

describe("listing CRUD + validation", () => {
  it("creates, reads, updates, deletes", async () => {
    const s = svc(); const created = await s.createListing(valid); const id = created.listing.id;
    assert.equal(created.listing.isDemo, false);
    assert.equal((await s.getListing(id)).listing.title, "Test flat");
    assert.equal((await s.updateListing(id, { rentAmount: 950 })).listing.rentAmount, 950);
    await s.deleteListing(id); await rejects(s.getListing(id), 404);
  });
  it("rejects negative price, unsupported currency, bad rooms, missing fields", async () => {
    const s = svc();
    await rejects(s.createListing({ ...valid, rentAmount: -1 }), 400, "VALIDATION_ERROR");
    await rejects(s.createListing({ ...valid, currency: "JPY" as never }), 400);
    await rejects(s.createListing({ ...valid, rooms: 0 }), 400);
    await rejects(s.createListing({ ...valid, title: "" }), 400);
  });
  it("deleting removes the favorite too", async () => {
    const s = svc(); const id = (await s.createListing(valid)).listing.id; await s.addFavorite(id); await s.deleteListing(id);
    assert.equal((await s.listFavorites()).length, 0);
  });
  it("detail includes duplicate candidates for seeded duplicate", async () => {
    const s = svc(); const d = await s.getListing("demo-berlin-dup"); assert.ok(d.duplicates.some((m) => m.category === "probable"));
  });
});

describe("sources and refresh", () => {
  it("starts as never_run, then reports ok with timestamps", async () => {
    const s = svc(); assert.ok((await s.listSources()).every((x) => x.status === "never_run" && x.lastCheckedAt === null));
    const r = await s.refreshSources(); assert.ok(r.outcomes.every((o) => o.ok && o.fetched > 0));
    assert.ok((await s.listSources()).every((x) => x.status === "ok" && x.lastCheckedAt === "2026-10-19T12:00:00.000Z"));
  });
  it("one failing source does not erase listings or hide the failure", async () => {
    const s = svc({ failingSources: ["demo-b"] }); const before = (await s.search({ pageSize: 100 })).total;
    const r = await s.refreshSources();
    assert.equal(r.outcomes.find((o) => o.sourceId === "demo-b")!.ok, false); assert.equal(r.outcomes.find((o) => o.sourceId === "demo-a")!.ok, true);
    assert.equal((await s.search({ pageSize: 100 })).total, before);
    const b = (await s.listSources()).find((x) => x.id === "demo-b")!; assert.equal(b.status, "failed"); assert.equal(b.lastSuccessAt, null); assert.ok(b.error);
  });
  it("rejects a concurrent refresh with 409", async () => {
    const s = svc(); const [a, b] = await Promise.allSettled([s.refreshSources(), s.refreshSources()]);
    assert.equal(a.status, "fulfilled"); assert.equal(b.status, "rejected");
    assert.ok(b.status === "rejected" && b.reason instanceof ApiError && b.reason.status === 409);
    await s.refreshSources(); // lock released
  });
});

describe("error simulation", () => {
  it("forceError makes calls fail with 503 so UI error states can be tested", async () => rejects(svc({ forceError: true }).search({}), 503));
});
