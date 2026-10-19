import { toDisplayCost } from "../domain/cost";
import { findDuplicates } from "../domain/duplicates";
import { ApiError, type FieldError } from "../domain/errors";
import { searchListings } from "../domain/search";
import {
  AMENITIES, PROPERTY_TYPES, SUPPORTED_CURRENCIES,
  type ComparisonResult, type Currency, type Listing, type RateTable,
  type RefreshResult, type SourceStatus,
} from "../domain/types";
import type { ApiService, ListingInput } from "./ApiService";
import { buildDemoListings, buildDemoSources, DEMO_RATES } from "./demoData";

export interface MockOptions {
  listings?: Listing[];
  sources?: SourceStatus[];
  rates?: RateTable;
  clock?: () => Date;
  /** Source ids that should simulate a failure on refresh. */
  failingSources?: string[];
  latencyMs?: number;
  /** Make every call fail, to exercise error states in the UI. */
  forceError?: boolean;
}

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

export function validateListingInput(i: Partial<ListingInput>, partial: boolean): FieldError[] {
  const e: FieldError[] = [];
  const req = (k: keyof ListingInput) => { if (!partial && (i[k] === undefined || i[k] === null || i[k] === "")) e.push({ field: k, message: "is required" }); };
  (["title", "city", "neighborhood", "propertyType", "rooms", "rentAmount", "rentPeriod", "currency"] as const).forEach(req);
  if (i.title !== undefined && !String(i.title).trim()) e.push({ field: "title", message: "must not be blank" });
  if (i.rentAmount !== undefined && (!Number.isFinite(i.rentAmount) || i.rentAmount <= 0)) e.push({ field: "rentAmount", message: "must be greater than 0" });
  if (i.utilitiesMonthly !== undefined && i.utilitiesMonthly !== null && (!Number.isFinite(i.utilitiesMonthly) || i.utilitiesMonthly < 0)) e.push({ field: "utilitiesMonthly", message: "must be >= 0" });
  if (i.rooms !== undefined && (!Number.isInteger(i.rooms) || i.rooms < 1 || i.rooms > 20)) e.push({ field: "rooms", message: "must be an integer from 1 to 20" });
  if (i.currency !== undefined && !(SUPPORTED_CURRENCIES as readonly string[]).includes(i.currency)) e.push({ field: "currency", message: `unsupported currency; use one of ${SUPPORTED_CURRENCIES.join(", ")}` });
  if (i.propertyType !== undefined && !(PROPERTY_TYPES as readonly string[]).includes(i.propertyType)) e.push({ field: "propertyType", message: "unknown property type" });
  if (i.rentPeriod !== undefined && !["month", "week"].includes(i.rentPeriod)) e.push({ field: "rentPeriod", message: "must be month or week" });
  for (const a of i.amenities ?? []) if (!(AMENITIES as readonly string[]).includes(a)) e.push({ field: "amenities", message: `unknown amenity ${a}` });
  return e;
}

export class MockService implements ApiService {
  private listings: Listing[];
  private sources: SourceStatus[];
  private favorites = new Set<string>();
  private refreshing = false;
  private seq = 0;
  private readonly rates: RateTable | undefined;
  private readonly clock: () => Date;
  private readonly failing: Set<string>;

  constructor(private readonly opts: MockOptions = {}) {
    this.listings = (opts.listings ?? buildDemoListings()).map((l) => ({ ...l }));
    this.sources = (opts.sources ?? buildDemoSources()).map((s) => ({ ...s }));
    this.rates = "rates" in opts ? opts.rates : DEMO_RATES;
    this.clock = opts.clock ?? (() => new Date());
    this.failing = new Set(opts.failingSources ?? []);
    this.recount();
  }

  private async gate(): Promise<void> {
    if (this.opts.latencyMs) await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    if (this.opts.forceError) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable");
  }
  private recount() {
    for (const s of this.sources) s.listingCount = this.listings.filter((l) => l.sourceId === s.id).length;
  }
  private find(id: string): Listing {
    const l = this.listings.find((x) => x.id === id);
    if (!l) throw new ApiError(404, "NOT_FOUND", `Listing ${id} not found`);
    return l;
  }
  private view(l: Listing, currency: Currency = "EUR") {
    return { listing: { ...l }, monthlyCost: toDisplayCost(l, currency, this.rates), isFavorite: this.favorites.has(l.id) };
  }
  private checkCurrency(c?: Currency) {
    if (c !== undefined && !(SUPPORTED_CURRENCIES as readonly string[]).includes(c))
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid currency", [{ field: "currency", message: "unsupported currency" }]);
  }

  async health() { await this.gate(); return { status: "ok" as const }; }

  async search(query: Parameters<ApiService["search"]>[0]) {
    await this.gate();
    return searchListings(this.listings, query, this.rates, (id) => this.favorites.has(id));
  }

  async getListing(id: string, currency?: Currency) {
    await this.gate(); this.checkCurrency(currency);
    const l = this.find(id);
    return { ...this.view(l, currency), duplicates: findDuplicates(l, this.listings, this.rates) };
  }

  async createListing(input: ListingInput) {
    await this.gate();
    const errors = validateListingInput(input, false);
    if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", "Invalid listing", errors);
    const now = this.clock().toISOString();
    const l: Listing = {
      ...input, amenities: input.amenities ?? [], areaSqm: input.areaSqm ?? null,
      utilitiesMonthly: input.utilitiesMonthly ?? null, sourceUrl: input.sourceUrl ?? null,
      id: `user-${++this.seq}`, sourceId: "manual", externalId: null, isDemo: false,
      firstSeenAt: now, lastSeenAt: now, updatedAt: now,
    };
    this.listings.push(l);
    return this.view(l, l.currency);
  }

  async updateListing(id: string, patch: Partial<ListingInput>) {
    await this.gate();
    const l = this.find(id);
    const errors = validateListingInput(patch, true);
    if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", "Invalid listing", errors);
    Object.assign(l, patch, { updatedAt: this.clock().toISOString() });
    return this.view(l, l.currency);
  }

  async deleteListing(id: string) {
    await this.gate();
    this.find(id);
    this.listings = this.listings.filter((l) => l.id !== id);
    this.favorites.delete(id);
    this.recount();
  }

  async listFavorites(currency?: Currency) {
    await this.gate(); this.checkCurrency(currency);
    return this.listings.filter((l) => this.favorites.has(l.id)).map((l) => this.view(l, currency));
  }
  async addFavorite(listingId: string) { await this.gate(); this.find(listingId); this.favorites.add(listingId); }
  async removeFavorite(listingId: string) { await this.gate(); this.favorites.delete(listingId); } // idempotent

  async compare(ids: string[], currency: Currency = "EUR"): Promise<ComparisonResult> {
    await this.gate(); this.checkCurrency(currency);
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new ApiError(400, "VALIDATION_ERROR", "Duplicate ids in comparison", [{ field: "ids", message: "must be unique" }]);
    if (unique.length < MIN_COMPARE || unique.length > MAX_COMPARE)
      throw new ApiError(400, "VALIDATION_ERROR", `Compare between ${MIN_COMPARE} and ${MAX_COMPARE} listings`, [{ field: "ids", message: `must contain ${MIN_COMPARE}-${MAX_COMPARE} ids` }]);
    const items = unique.map((id) => this.view(this.find(id), currency));
    const priced = items.filter((i) => i.monthlyCost);
    const cheapest = priced.sort((a, b) => a.monthlyCost!.amount - b.monthlyCost!.amount || a.listing.id.localeCompare(b.listing.id))[0];
    const amenityMatrix: Record<string, string[]> = {};
    for (const a of AMENITIES) amenityMatrix[a] = items.filter((i) => i.listing.amenities.includes(a)).map((i) => i.listing.id);
    return { currency, items: unique.map((id) => items.find((i) => i.listing.id === id)!), cheapestId: cheapest?.listing.id ?? null, amenityMatrix };
  }

  async listSources() { await this.gate(); return this.sources.map((s) => ({ ...s })); }

  async refreshSources(): Promise<RefreshResult> {
    await this.gate();
    if (this.refreshing) throw new ApiError(409, "REFRESH_IN_PROGRESS", "A refresh is already running");
    this.refreshing = true;
    try {
      await new Promise((r) => setTimeout(r, 0)); // a real refresh takes time; lets concurrent callers observe the lock
      const startedAt = this.clock().toISOString();
      const outcomes = this.sources.map((s) => {
        const now = this.clock().toISOString();
        s.lastCheckedAt = now;
        if (this.failing.has(s.id)) {
          s.status = "failed"; s.error = "Simulated source failure"; // stored listings are left untouched
          return { sourceId: s.id, ok: false, fetched: 0, error: s.error };
        }
        s.status = "ok"; s.error = null; s.lastSuccessAt = now;
        let fetched = 0;
        for (const l of this.listings) if (l.sourceId === s.id) { l.lastSeenAt = now; fetched++; }
        return { sourceId: s.id, ok: true, fetched, error: null };
      });
      return { startedAt, finishedAt: this.clock().toISOString(), outcomes };
    } finally {
      this.refreshing = false;
    }
  }
}
