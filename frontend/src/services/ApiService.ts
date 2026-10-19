import type {
  ComparisonResult, DuplicateMatch, Listing, ListingQuery, ListingView,
  RefreshResult, SearchResult, SourceStatus,
} from "../domain/types";

export type ListingInput = Pick<
  Listing,
  "title" | "description" | "city" | "neighborhood" | "propertyType" | "rooms" | "areaSqm" |
  "rentAmount" | "rentPeriod" | "currency" | "utilitiesIncluded" | "utilitiesMonthly" |
  "amenities" | "sourceUrl"
>;

/**
 * The ONLY thing UI code may depend on. Implementations: MockService (this iteration)
 * and HttpService (integration iteration). Both must match openapi.yml.
 */
export interface ApiService {
  health(): Promise<{ status: "ok" }>;
  search(query: ListingQuery): Promise<SearchResult>;
  getListing(id: string, currency?: ListingQuery["currency"]): Promise<ListingView & { duplicates: DuplicateMatch[] }>;
  createListing(input: ListingInput): Promise<ListingView>;
  updateListing(id: string, patch: Partial<ListingInput>): Promise<ListingView>;
  deleteListing(id: string): Promise<void>;
  listFavorites(currency?: ListingQuery["currency"]): Promise<ListingView[]>;
  addFavorite(listingId: string): Promise<void>;
  removeFavorite(listingId: string): Promise<void>;
  compare(ids: string[], currency?: ListingQuery["currency"]): Promise<ComparisonResult>;
  listSources(): Promise<SourceStatus[]>;
  refreshSources(): Promise<RefreshResult>;
}
