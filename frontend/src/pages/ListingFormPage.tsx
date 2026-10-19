import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../domain/errors";
import { AMENITIES, PROPERTY_TYPES, SUPPORTED_CURRENCIES, type Amenity, type Currency, type PropertyType, type RentPeriod } from "../domain/types";
import type { ListingInput } from "../services/ApiService";
import { ErrorState, Loading, errorMessage } from "../components/States";
import { AMENITY_LABEL, TYPE_LABEL } from "../lib/format";
import { useApp } from "../state/AppState";

interface Form {
  title: string; description: string; city: string; neighborhood: string; propertyType: PropertyType; rooms: string;
  areaSqm: string; rentAmount: string; rentPeriod: RentPeriod; currency: Currency; utilitiesIncluded: boolean;
  utilitiesMonthly: string; amenities: Amenity[]; sourceUrl: string;
}
const EMPTY: Form = { title: "", description: "", city: "", neighborhood: "", propertyType: "apartment", rooms: "1", areaSqm: "",
  rentAmount: "", rentPeriod: "month", currency: "EUR", utilitiesIncluded: false, utilitiesMonthly: "", amenities: [], sourceUrl: "" };

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  for (const k of ["title", "city", "neighborhood"] as const) if (!f[k].trim()) e[k] = "Required.";
  if (!(Number(f.rentAmount) > 0)) e.rentAmount = "Rent must be greater than 0.";
  const rooms = Number(f.rooms);
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > 20) e.rooms = "Rooms must be a whole number from 1 to 20.";
  if (f.areaSqm && !(Number(f.areaSqm) > 0)) e.areaSqm = "Area must be greater than 0.";
  if (!f.utilitiesIncluded && f.utilitiesMonthly && !(Number(f.utilitiesMonthly) >= 0)) e.utilitiesMonthly = "Utilities must be 0 or more.";
  if (f.sourceUrl && !/^https?:\/\//.test(f.sourceUrl)) e.sourceUrl = "Link must start with http:// or https://";
  return e;
}

function toInput(f: Form): ListingInput {
  return {
    title: f.title.trim(), description: f.description.trim(), city: f.city.trim(), neighborhood: f.neighborhood.trim(),
    propertyType: f.propertyType, rooms: Number(f.rooms), areaSqm: f.areaSqm ? Number(f.areaSqm) : null,
    rentAmount: Number(f.rentAmount), rentPeriod: f.rentPeriod, currency: f.currency, utilitiesIncluded: f.utilitiesIncluded,
    utilitiesMonthly: f.utilitiesIncluded || !f.utilitiesMonthly ? null : Number(f.utilitiesMonthly),
    amenities: f.amenities, sourceUrl: f.sourceUrl.trim() || null,
  };
}

export function ListingFormPage() {
  const { id } = useParams();
  const { api, notify } = useApp();
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getListing(id).then(({ listing: l }) => {
      setForm({ ...l, rooms: String(l.rooms), areaSqm: l.areaSqm === null ? "" : String(l.areaSqm), rentAmount: String(l.rentAmount),
        utilitiesMonthly: l.utilitiesMonthly === null ? "" : String(l.utilitiesMonthly), sourceUrl: l.sourceUrl ?? "" });
      setLoading(false);
    }, (e: unknown) => { setLoadError(e); setLoading(false); });
  }, [api, id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const v = id ? await api.updateListing(id, toInput(form)) : await api.createListing(toInput(form));
      notify(id ? "Listing updated" : "Listing added");
      nav(`/listings/${encodeURIComponent(v.listing.id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      notify(`Could not save: ${errorMessage(err)}`, "error");
    } finally { setSaving(false); }
  }

  if (loading) return <Loading />;
  if (loadError) return <ErrorState error={loadError} />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const text = (k: "title" | "city" | "neighborhood" | "rooms" | "areaSqm" | "rentAmount" | "utilitiesMonthly" | "sourceUrl", label: string, extra: Record<string, string> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} name={k} value={form[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} {...extra} />
      {errors[k] && <span id={`${k}-err`} className="field-error">{errors[k]}</span>}
    </div>
  );

  return (
    <section className="form-page">
      <h1>{id ? "Edit listing" : "Add a listing you found"}</h1>
      <p className="muted">Listings you add are marked “Added by you” and are not demo data.</p>
      <form onSubmit={submit} noValidate className="panel listing-form">
        {text("title", "Title")}
        <label>Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></label>
        <div className="pair">{text("city", "City")}{text("neighborhood", "Neighborhood")}</div>
        <div className="pair">
          <label>Type<select value={form.propertyType} onChange={(e) => set("propertyType", e.target.value as PropertyType)}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
          {text("rooms", "Rooms", { inputMode: "numeric" })}
        </div>
        <div className="pair">{text("rentAmount", "Rent", { inputMode: "decimal" })}
          <label>Per<select value={form.rentPeriod} onChange={(e) => set("rentPeriod", e.target.value as RentPeriod)}><option value="month">month</option><option value="week">week</option></select></label>
          <label>Currency<select value={form.currency} onChange={(e) => set("currency", e.target.value as Currency)}>{SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.utilitiesIncluded} onChange={(e) => set("utilitiesIncluded", e.target.checked)} />Utilities included in rent</label>
        {!form.utilitiesIncluded && text("utilitiesMonthly", "Utilities per month (leave empty if unknown)", { inputMode: "decimal" })}
        {text("areaSqm", "Area in m² (optional)", { inputMode: "decimal" })}
        <fieldset><legend>Amenities</legend>
          {AMENITIES.map((a) => <label key={a} className="check"><input type="checkbox" checked={form.amenities.includes(a)} onChange={() => set("amenities", form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a])} />{AMENITY_LABEL[a]}</label>)}
        </fieldset>
        {text("sourceUrl", "Link to the original advert (optional)", { type: "url" })}
        <div className="row"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : id ? "Save changes" : "Add listing"}</button></div>
      </form>
    </section>
  );
}
