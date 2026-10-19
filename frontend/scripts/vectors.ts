/** Shared test vectors (docs/test-vectors.json): the Python backend must reproduce these exactly. */
import { toDisplayCost } from "../src/domain/cost";
import { findDuplicates } from "../src/domain/duplicates";
import { searchListings } from "../src/domain/search";
import { SUPPORTED_CURRENCIES, type ListingQuery } from "../src/domain/types";
import { buildDemoListings, DEMO_RATES } from "../src/services/demoData";

export const VECTOR_QUERIES: ListingQuery[] = [
  {},
  { city: "Berlin" },
  { city: "london", sort: "price_asc", currency: "GBP" },
  { sort: "price_desc", currency: "USD", pageSize: 5, page: 2 },
  { minPrice: 600, maxPrice: 1500, sort: "price_asc" },
  { q: "neukolln" },
  { propertyTypes: ["studio", "room"], minRooms: 1, maxRooms: 1 },
  { amenities: ["wifi", "furnished"] },
  { city: "Toronto", neighborhood: "the annex", currency: "CAD" },
];

export function buildVectors() {
  const listings = buildDemoListings();
  return {
    rates: DEMO_RATES,
    listings,
    costs: listings.map((l) => ({
      id: l.id,
      withRates: Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, toDisplayCost(l, c, DEMO_RATES)])),
      withoutRates: Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, toDisplayCost(l, c, undefined)])),
    })),
    duplicates: listings.map((l) => ({ id: l.id, withRates: findDuplicates(l, listings, DEMO_RATES), withoutRates: findDuplicates(l, listings) })),
    searches: VECTOR_QUERIES.map((query) => {
      const r = searchListings(listings, query, DEMO_RATES);
      return { query, total: r.total, ids: r.items.map((i) => i.listing.id), amounts: r.items.map((i) => i.monthlyCost?.amount ?? null) };
    }),
  };
}
