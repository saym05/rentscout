import { toDisplayCost } from "./cost";
import { norm } from "./duplicates";
import { ApiError, type FieldError } from "./errors";
import {
  AMENITIES, PROPERTY_TYPES, SUPPORTED_CURRENCIES,
  type Listing, type ListingQuery, type ListingView, type RateTable, type SearchResult,
} from "./types";

const SORTS = ["price_asc", "price_desc", "newest"];

export function validateQuery(q: ListingQuery): FieldError[] {
  const e: FieldError[] = [];
  const num = (v: unknown, f: string, min = 0) => {
    if (v === undefined) return;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min) e.push({ field: f, message: `must be a number >= ${min}` });
  };
  num(q.minPrice, "minPrice"); num(q.maxPrice, "maxPrice");
  num(q.minRooms, "minRooms"); num(q.maxRooms, "maxRooms");
  if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice)
    e.push({ field: "minPrice", message: "must not exceed maxPrice" });
  if (q.minRooms !== undefined && q.maxRooms !== undefined && q.minRooms > q.maxRooms)
    e.push({ field: "minRooms", message: "must not exceed maxRooms" });
  if (q.page !== undefined && (!Number.isInteger(q.page) || q.page < 1)) e.push({ field: "page", message: "must be an integer >= 1" });
  if (q.pageSize !== undefined && (!Number.isInteger(q.pageSize) || q.pageSize < 1 || q.pageSize > 100))
    e.push({ field: "pageSize", message: "must be an integer between 1 and 100" });
  if (q.currency !== undefined && !(SUPPORTED_CURRENCIES as readonly string[]).includes(q.currency))
    e.push({ field: "currency", message: `unsupported currency; use one of ${SUPPORTED_CURRENCIES.join(", ")}` });
  if (q.sort !== undefined && !SORTS.includes(q.sort)) e.push({ field: "sort", message: `must be one of ${SORTS.join(", ")}` });
  for (const t of q.propertyTypes ?? []) if (!(PROPERTY_TYPES as readonly string[]).includes(t)) e.push({ field: "propertyTypes", message: `unknown type ${t}` });
  for (const a of q.amenities ?? []) if (!(AMENITIES as readonly string[]).includes(a)) e.push({ field: "amenities", message: `unknown amenity ${a}` });
  return e;
}

export function searchListings(
  all: Listing[],
  query: ListingQuery,
  rates: RateTable | undefined,
  isFavorite: (id: string) => boolean = () => false,
): SearchResult {
  const errors = validateQuery(query);
  if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", "Invalid search parameters", errors);

  const currency = query.currency ?? "EUR";
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  const text = query.q ? norm(query.q) : "";
  const priceFiltered = query.minPrice !== undefined || query.maxPrice !== undefined;

  let views: ListingView[] = all
    .filter((l) => !query.city || norm(l.city) === norm(query.city))
    .filter((l) => !query.neighborhood || norm(l.neighborhood) === norm(query.neighborhood))
    .filter((l) => !text || norm(`${l.title} ${l.description} ${l.city} ${l.neighborhood}`).includes(text))
    .filter((l) => !query.propertyTypes?.length || query.propertyTypes.includes(l.propertyType))
    .filter((l) => query.minRooms === undefined || l.rooms >= query.minRooms)
    .filter((l) => query.maxRooms === undefined || l.rooms <= query.maxRooms)
    .filter((l) => !query.amenities?.length || query.amenities.every((a) => l.amenities.includes(a)))
    .map((l) => ({ listing: l, monthlyCost: toDisplayCost(l, currency, rates), isFavorite: isFavorite(l.id) }))
    .filter((v) => {
      if (!priceFiltered) return true;
      if (!v.monthlyCost) return false; // cannot honestly compare, so exclude from price-bounded results
      if (query.minPrice !== undefined && v.monthlyCost.amount < query.minPrice) return false;
      if (query.maxPrice !== undefined && v.monthlyCost.amount > query.maxPrice) return false;
      return true;
    });

  const sort = query.sort ?? "newest";
  views = views.sort((a, b) => {
    if (sort === "newest") {
      return b.listing.firstSeenAt.localeCompare(a.listing.firstSeenAt) || a.listing.id.localeCompare(b.listing.id);
    }
    const ca = a.monthlyCost?.amount, cb = b.monthlyCost?.amount;
    if (ca === undefined && cb === undefined) return a.listing.id.localeCompare(b.listing.id);
    if (ca === undefined) return 1;   // non-comparable listings go last in both directions
    if (cb === undefined) return -1;
    const d = sort === "price_asc" ? ca - cb : cb - ca;
    return d || a.listing.id.localeCompare(b.listing.id);
  });

  const total = views.length;
  const start = (page - 1) * pageSize;
  return { items: views.slice(start, start + pageSize), total, page, pageSize, currency };
}
