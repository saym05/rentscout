import { ApiError } from "../domain/errors";
import type { Currency, ListingQuery } from "../domain/types";
import type { ApiService, ListingInput } from "./ApiService";

type Query = Record<string, string | number | string[] | undefined>;

/** ApiService over HTTP against the FastAPI backend (openapi.yml). Maps the error envelope to ApiError. */
export class HttpService implements ApiService {
  private readonly base: string;

  constructor(baseUrl: string, private readonly demoUser = "demo", private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    this.base = baseUrl.replace(/\/+$/, "");
  }

  private async req<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      params.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const qs = params.toString();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}${qs ? `?${qs}` : ""}`, {
        method,
        headers: { "X-Demo-User": this.demoUser, ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the RentScout server. Check that the backend is running and try again.");
    }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string; details?: { field: string; message: string }[] } } | null)?.error;
      throw new ApiError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? `Unexpected server response (${res.status})`, e?.details ?? []);
    }
    return data as T;
  }

  health() { return this.req<{ status: "ok" }>("GET", "/api/health"); }
  search(q: ListingQuery) { return this.req<Awaited<ReturnType<ApiService["search"]>>>("GET", "/api/listings", { query: { ...q } as Query }); }
  getListing(id: string, currency?: Currency) {
    return this.req<Awaited<ReturnType<ApiService["getListing"]>>>("GET", `/api/listings/${encodeURIComponent(id)}`, { query: { currency } });
  }
  createListing(input: ListingInput) { return this.req<Awaited<ReturnType<ApiService["createListing"]>>>("POST", "/api/listings", { body: input }); }
  updateListing(id: string, patch: Partial<ListingInput>) {
    return this.req<Awaited<ReturnType<ApiService["updateListing"]>>>("PUT", `/api/listings/${encodeURIComponent(id)}`, { body: patch });
  }
  deleteListing(id: string) { return this.req<void>("DELETE", `/api/listings/${encodeURIComponent(id)}`); }
  listFavorites(currency?: Currency) { return this.req<Awaited<ReturnType<ApiService["listFavorites"]>>>("GET", "/api/favorites", { query: { currency } }); }
  addFavorite(id: string) { return this.req<void>("POST", `/api/favorites/${encodeURIComponent(id)}`); }
  removeFavorite(id: string) { return this.req<void>("DELETE", `/api/favorites/${encodeURIComponent(id)}`); }
  compare(ids: string[], currency?: Currency) {
    return this.req<Awaited<ReturnType<ApiService["compare"]>>>("POST", "/api/compare", { body: { ids, currency } });
  }
  listSources() { return this.req<Awaited<ReturnType<ApiService["listSources"]>>>("GET", "/api/sources"); }
  refreshSources() { return this.req<Awaited<ReturnType<ApiService["refreshSources"]>>>("POST", "/api/sources/refresh"); }
}
