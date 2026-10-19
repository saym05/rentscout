import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AMENITIES, PROPERTY_TYPES, type Amenity, type ListingQuery, type PropertyType, type SortOrder } from "../domain/types";
import { ListingCard } from "../components/ListingCard";
import { Empty, ErrorState, Loading } from "../components/States";
import { AMENITY_LABEL, TYPE_LABEL } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

const PAGE_SIZE = 12;
const TEXT_KEYS = ["q", "city", "neighborhood", "minPrice", "maxPrice", "minRooms", "maxRooms"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

const num = (v: string | null) => (v === null || v === "" ? undefined : Number(v));
const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function toQuery(p: URLSearchParams, currency: ListingQuery["currency"]): ListingQuery {
  return {
    q: p.get("q") ?? undefined, city: p.get("city") ?? undefined, neighborhood: p.get("neighborhood") ?? undefined,
    minPrice: num(p.get("minPrice")), maxPrice: num(p.get("maxPrice")),
    minRooms: num(p.get("minRooms")), maxRooms: num(p.get("maxRooms")),
    propertyTypes: list(p.get("propertyTypes")) as PropertyType[], amenities: list(p.get("amenities")) as Amenity[],
    sort: (p.get("sort") as SortOrder | null) ?? "newest", page: num(p.get("page")) ?? 1, pageSize: PAGE_SIZE, currency,
  };
}

function validate(f: Record<TextKey, string>): Record<string, string> {
  const e: Record<string, string> = {};
  for (const k of ["minPrice", "maxPrice"] as const)
    if (f[k] && (!Number.isFinite(Number(f[k])) || Number(f[k]) < 0)) e[k] = "Enter a number of 0 or more.";
  for (const k of ["minRooms", "maxRooms"] as const)
    if (f[k] && (!Number.isInteger(Number(f[k])) || Number(f[k]) < 1)) e[k] = "Enter a whole number of 1 or more.";
  if (!e.minPrice && !e.maxPrice && f.minPrice && f.maxPrice && Number(f.minPrice) > Number(f.maxPrice)) e.minPrice = "Minimum price is above the maximum.";
  if (!e.minRooms && !e.maxRooms && f.minRooms && f.maxRooms && Number(f.minRooms) > Number(f.maxRooms)) e.minRooms = "Minimum rooms is above the maximum.";
  return e;
}

export function SearchPage() {
  const { api, currency } = useApp();
  const [params, setParams] = useSearchParams();
  const key = params.toString();
  const result = useAsync(() => api.search(toQuery(params, currency)), [api, key, currency]);

  const fromParams = () => Object.fromEntries(TEXT_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<TextKey, string>;
  const [form, setForm] = useState(fromParams);
  const [types, setTypes] = useState<string[]>(list(params.get("propertyTypes")));
  const [amenities, setAmenities] = useState<string[]>(list(params.get("amenities")));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { setForm(fromParams()); setTypes(list(params.get("propertyTypes"))); setAmenities(list(params.get("amenities"))); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);

  function update(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    setParams(p);
  }
  function apply(e: FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update({ ...form, propertyTypes: types.join(","), amenities: amenities.join(","), page: undefined });
    setFiltersOpen(false);
  }
  function reset() { setErrors({}); setParams(new URLSearchParams()); }
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const field = (k: TextKey, label: string, extra: Record<string, string> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} name={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${k}-err` : undefined} {...extra} />
      {errors[k] && <span id={`${k}-err`} className="field-error">{errors[k]}</span>}
    </div>
  );

  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const page = data?.page ?? 1;

  return (
    <div className="search-layout">
      <button className="btn filters-toggle" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen(!filtersOpen)}>
        {filtersOpen ? "Hide filters" : "Filters"}
      </button>
      <aside id="filters" className={`filters ${filtersOpen ? "open" : ""}`} aria-label="Filters">
        <form onSubmit={apply} noValidate>
          {field("q", "Keywords", { placeholder: "e.g. balcony, Kreuzberg" })}
          {field("city", "City")}
          {field("neighborhood", "Neighborhood")}
          <div className="pair">{field("minPrice", `Min / month (${currency})`, { inputMode: "decimal" })}{field("maxPrice", `Max / month (${currency})`, { inputMode: "decimal" })}</div>
          <div className="pair">{field("minRooms", "Min rooms", { inputMode: "numeric" })}{field("maxRooms", "Max rooms", { inputMode: "numeric" })}</div>
          <fieldset><legend>Type</legend>
            {PROPERTY_TYPES.map((t) => <label key={t} className="check"><input type="checkbox" checked={types.includes(t)} onChange={() => toggle(types, setTypes, t)} />{TYPE_LABEL[t]}</label>)}
          </fieldset>
          <fieldset><legend>Must have</legend>
            {AMENITIES.map((a) => <label key={a} className="check"><input type="checkbox" checked={amenities.includes(a)} onChange={() => toggle(amenities, setAmenities, a)} />{AMENITY_LABEL[a]}</label>)}
          </fieldset>
          <div className="filter-actions"><button className="btn btn-primary" type="submit">Apply filters</button><button className="btn" type="button" onClick={reset}>Reset</button></div>
        </form>
      </aside>
      <section className="results" aria-labelledby="results-h">
        <div className="results-bar">
          <h1 id="results-h">{data ? `${data.total} ${data.total === 1 ? "listing" : "listings"}` : "Listings"}</h1>
          <label className="sort">Sort by
            <select value={params.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value, page: undefined })}>
              <option value="newest">Newest</option><option value="price_asc">Lowest monthly cost</option><option value="price_desc">Highest monthly cost</option>
            </select>
          </label>
        </div>
        {(params.get("minPrice") || params.get("maxPrice")) && (
          <p className="muted small">Price filters use the total monthly cost in {currency}. Listings that can't be converted are left out.</p>
        )}
        {result.status === "loading" && !data && <Loading label="Loading listings…" />}
        {result.status === "error" && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status !== "error" && data && data.total === 0 && (
          <Empty title="No listings match these filters"><p>Try a wider price range or fewer amenities.</p><button className="btn" onClick={reset}>Clear all filters</button></Empty>
        )}
        {result.status !== "error" && data && data.items.length > 0 && (
          <>
            <div className={`grid ${result.status === "loading" ? "is-loading" : ""}`} aria-busy={result.status === "loading"}>
              {data.items.map((v) => <ListingCard key={v.listing.id} view={v} />)}
            </div>
            {pages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button className="btn" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="btn" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
