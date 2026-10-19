import { Link, useNavigate, useParams } from "react-router-dom";
import { CompareToggle, SourceChip } from "../components/ListingCard";
import { FavoriteButton } from "../components/FavoriteButton";
import { Price } from "../components/Price";
import { ErrorState, Loading, errorMessage } from "../components/States";
import { AMENITY_LABEL, TYPE_LABEL, dateTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

export function ListingPage() {
  const { id = "" } = useParams();
  const { api, currency, notify } = useApp();
  const nav = useNavigate();
  const r = useAsync(() => api.getListing(id, currency), [api, id, currency]);

  if (r.status === "loading" && !r.data) return <Loading label="Loading listing…" />;
  if (r.status === "error") return <ErrorState error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  const l = d.listing;
  const demoLink = l.sourceUrl?.includes("example.invalid");

  async function remove() {
    if (!window.confirm(`Delete "${l.title}"? This cannot be undone.`)) return;
    try { await api.deleteListing(l.id); notify("Listing deleted"); nav("/search"); }
    catch (e) { notify(`Could not delete: ${errorMessage(e)}`, "error"); }
  }

  return (
    <article className="detail">
      <p><Link to="/search">← Back to results</Link></p>
      <div className="detail-head">
        <div>
          <SourceChip sourceId={l.sourceId} isDemo={l.isDemo} />
          <h1>{l.title}</h1>
          <p className="muted">{l.neighborhood}, {l.city}</p>
        </div>
        <div className="detail-actions">
          <FavoriteButton id={l.id} title={l.title} isFavorite={d.isFavorite} />
          <CompareToggle id={l.id} />
        </div>
      </div>
      <div className="detail-grid">
        <section className="panel" aria-labelledby="cost-h">
          <h2 id="cost-h">Monthly cost</h2>
          <Price listing={l} cost={d.monthlyCost} size="lg" />
          {d.monthlyCost && (
            <table className="breakdown">
              <tbody>
                <tr><th scope="row">Rent per month</th><td>{d.monthlyCost.rentMonthly.toFixed(2)} {d.monthlyCost.native.currency}{l.rentPeriod === "week" && " (weekly × 52 ÷ 12)"}</td></tr>
                <tr><th scope="row">Utilities</th><td>{l.utilitiesIncluded ? "Included in rent" : d.monthlyCost.utilitiesKnown ? `${d.monthlyCost.utilitiesMonthly.toFixed(2)} ${d.monthlyCost.native.currency}` : "Unknown — ask the landlord"}</td></tr>
                <tr><th scope="row">Total ({d.monthlyCost.native.currency})</th><td>{d.monthlyCost.native.amount.toFixed(2)} {d.monthlyCost.native.currency}</td></tr>
              </tbody>
            </table>
          )}
        </section>
        <section className="panel" aria-labelledby="facts-h">
          <h2 id="facts-h">Details</h2>
          <dl className="facts">
            <dt>Type</dt><dd>{TYPE_LABEL[l.propertyType]}</dd>
            <dt>Rooms</dt><dd>{l.rooms}</dd>
            <dt>Area</dt><dd>{l.areaSqm ? `${l.areaSqm} m²` : "Not stated"}</dd>
            <dt>Amenities</dt><dd>{l.amenities.length ? l.amenities.map((a) => AMENITY_LABEL[a] ?? a).join(", ") : "None listed"}</dd>
            <dt>Source</dt><dd>{l.sourceId}</dd>
            <dt>First seen</dt><dd>{dateTime(l.firstSeenAt)}</dd>
            <dt>Last seen at source</dt><dd>{dateTime(l.lastSeenAt)}</dd>
            <dt>Last updated</dt><dd>{dateTime(l.updatedAt)}</dd>
          </dl>
          {l.sourceUrl ? (
            <p><a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">View original listing ↗</a>
              {demoLink && <span className="muted small"> (demo link to example.invalid — there is no real advert)</span>}</p>
          ) : <p className="muted">No original link available.</p>}
        </section>
      </div>
      <section className="panel">
        <h2>Description</h2>
        <p>{l.description || "No description."}</p>
        {l.sourceId === "manual" && (
          <div className="row"><Link className="btn" to={`/listings/${encodeURIComponent(l.id)}/edit`}>Edit</Link><button className="btn btn-danger" onClick={remove}>Delete</button></div>
        )}
      </section>
      <section className="panel" aria-labelledby="dup-h">
        <h2 id="dup-h">Possible duplicates</h2>
        {d.duplicates.length === 0 ? <p className="muted">No other listing looks like this one.</p> : (
          <ul className="dups">
            {d.duplicates.map((m) => (
              <li key={m.listingId}>
                <Link to={`/listings/${encodeURIComponent(m.listingId)}`}>{m.listingId}</Link>{" "}
                <span className={`chip chip-${m.category}`}>{m.category === "probable" ? "Probably the same flat" : "Possibly the same flat"} · {Math.round(m.score * 100)}%</span>
                <p className="muted small">Why: {m.reasons.join("; ")}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">Duplicate hints are suggestions only. Nothing is merged or hidden.</p>
      </section>
    </article>
  );
}
