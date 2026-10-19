export const SUPPORTED_CURRENCIES = ["EUR", "GBP", "CAD", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const PROPERTY_TYPES = ["studio", "apartment", "room", "house"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const AMENITIES = [
  "furnished", "wifi", "washer", "dishwasher", "balcony",
  "parking", "gym", "pets-allowed", "elevator",
] as const;
export type Amenity = (typeof AMENITIES)[number];

export type RentPeriod = "month" | "week";

export interface Listing {
  id: string;
  title: string;
  description: string;
  city: string;
  neighborhood: string;
  propertyType: PropertyType;
  rooms: number;
  areaSqm: number | null;
  rentAmount: number;          // in the ORIGINAL currency and period
  rentPeriod: RentPeriod;
  currency: Currency;          // ORIGINAL currency, never overwritten
  utilitiesIncluded: boolean;
  utilitiesMonthly: number | null; // null = unknown
  amenities: Amenity[];
  sourceId: string;
  externalId: string | null;
  sourceUrl: string | null;
  isDemo: boolean;
  firstSeenAt: string;         // ISO 8601
  lastSeenAt: string;
  updatedAt: string;
}

/** Exchange rates: 1 unit of the currency is worth eurPer[currency] EUR. */
export interface RateTable {
  asOf: string;
  source: string;              // must say where the rates came from
  eurPer: Record<Currency, number>;
}

export interface MonthlyCost {
  amount: number;              // in `currency`
  currency: Currency;
  converted: boolean;          // true when currency differs from the listing's original
  rate?: number | null;        // absent (mock) or null (backend) when not converted
  rateAsOf?: string | null;
  rateSource?: string | null;
  native: { amount: number; currency: Currency };
  rentMonthly: number;         // native currency
  utilitiesMonthly: number;    // native currency, 0 when included or unknown
  utilitiesKnown: boolean;
}

export interface ListingView {
  listing: Listing;
  monthlyCost: MonthlyCost | null; // null = cannot be expressed in display currency
  isFavorite: boolean;
}

export type SortOrder = "price_asc" | "price_desc" | "newest";

export interface ListingQuery {
  q?: string;
  city?: string;
  neighborhood?: string;
  minPrice?: number;           // monthly cost in `currency`
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
  propertyTypes?: PropertyType[];
  amenities?: Amenity[];       // listing must have ALL
  sort?: SortOrder;
  page?: number;
  pageSize?: number;
  currency?: Currency;         // display currency, default EUR
}

export interface SearchResult {
  items: ListingView[];
  total: number;
  page: number;
  pageSize: number;
  currency: Currency;
}

export type DuplicateCategory = "probable" | "possible" | "none";
export interface DuplicateMatch {
  listingId: string;
  score: number;               // 0..1
  category: DuplicateCategory;
  reasons: string[];
}

export interface ComparisonResult {
  currency: Currency;
  items: ListingView[];
  cheapestId: string | null;
  amenityMatrix: Record<string, string[]>; // amenity -> listing ids that have it
}

export interface SourceStatus {
  id: string;
  name: string;
  kind: "demo" | "live";
  status: "ok" | "failed" | "never_run";
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  listingCount: number;
  error: string | null;
}

export interface SourceRefreshOutcome {
  sourceId: string;
  ok: boolean;
  fetched: number;
  error: string | null;
}

export interface RefreshResult {
  startedAt: string;
  finishedAt: string;
  outcomes: SourceRefreshOutcome[];
}
