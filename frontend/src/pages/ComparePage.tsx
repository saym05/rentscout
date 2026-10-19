import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AMENITIES, type ListingView } from "../domain/types";
import { Price } from "../components/Price";
import { Empty, ErrorState, Loading } from "../components/States";
import { AMENITY_LABEL, TYPE_LABEL, money } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

export function ComparePage() {
  const { api, currency, compareIds, toggleCompare, clearCompare } = useApp();
  const enough = compareIds.length >= 2;
  const r = useAsync(() => (enough ? api.compare(compareIds, currency) : Promise.resolve(null)), [api, compareIds.join(","), currency]);

  if (!enough) {
    return (
      <Empty title="Pick 2 or 3 listings to compare">
        <p>Tick “Compare” on listings in your search results. {compareIds.length === 1 && "You have selected 1 so far."}</p>
        <Link className="btn btn-primary" to="/search">Go to search</Link>
      </Empty>
    );
  }
  if (r.status === "loading" && !r.data) return <Loading label="Comparing…" />;
  if (r.status === "error") {
    return <><ErrorState error={r.error} onRetry={r.reload} /><button className="btn" onClick={clearCompare}>Clear selection</button></>;
  }
  const c = r.data!;
  const rows: [string, (v: ListingView) => ReactNode][] = [
    ["Monthly total", (v) => <Price listing={v.listing} cost={v.monthlyCost} />],
    ["Original price", (v) => `${money(v.listing.rentAmount, v.listing.currency)} / ${v.listing.rentPeriod}`],
    ["Utilities", (v) => v.listing.utilitiesIncluded ? "Included" : v.listing.utilitiesMonthly === null ? "Unknown" : money(v.listing.utilitiesMonthly, v.listing.currency)],
    ["Type", (v) => TYPE_LABEL[v.listing.propertyType]],
    ["Rooms", (v) => v.listing.rooms],
    ["Area", (v) => (v.listing.areaSqm ? `${v.listing.areaSqm} m²` : "—")],
    ["Location", (v) => `${v.listing.neighborhood}, ${v.listing.city}`],
    ["Source", (v) => `${v.listing.sourceId}${v.listing.isDemo ? " (demo)" : ""}`],
    ...AMENITIES.map((a): [string, (v: ListingView) => ReactNode] => [AMENITY_LABEL[a] ?? a,
      (v) => (c.amenityMatrix[a]?.includes(v.listing.id) ? <span aria-label="yes">✓</span> : <span aria-label="no" className="muted">—</span>)]),
  ];
  const nonComparable = c.items.some((v) => !v.monthlyCost);

  return (
    <div className="compare">
      <div className="results-bar"><h1>Compare {c.items.length} listings</h1><button className="btn" onClick={clearCompare}>Clear all</button></div>
      {nonComparable && <p className="warn">Some prices can't be shown in {c.currency} without an exchange rate, so they are excluded from “cheapest”.</p>}
      <div className="compare-table-wrap">
        <table className="compare-table">
          <caption className="sr-only">Side-by-side comparison in {c.currency}</caption>
          <thead><tr><td />{c.items.map((v) => (
            <th key={v.listing.id} scope="col" className={v.listing.id === c.cheapestId ? "cheapest" : ""}>
              {v.listing.id === c.cheapestId && <span className="chip chip-cheapest">Cheapest</span>}
              <Link to={`/listings/${encodeURIComponent(v.listing.id)}`}>{v.listing.title}</Link>
              <button className="link-btn" onClick={() => toggleCompare(v.listing.id)} aria-label={`Remove ${v.listing.title} from comparison`}>Remove</button>
            </th>))}</tr></thead>
          <tbody>{rows.map(([label, cell]) => (
            <tr key={label}><th scope="row">{label}</th>{c.items.map((v) => <td key={v.listing.id} className={v.listing.id === c.cheapestId ? "cheapest" : ""}>{cell(v)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <div className="compare-cards">
        {c.items.map((v) => (
          <section key={v.listing.id} className={`panel ${v.listing.id === c.cheapestId ? "cheapest" : ""}`} aria-label={v.listing.title}>
            {v.listing.id === c.cheapestId && <span className="chip chip-cheapest">Cheapest</span>}
            <h2><Link to={`/listings/${encodeURIComponent(v.listing.id)}`}>{v.listing.title}</Link></h2>
            <dl className="facts">{rows.slice(0, 8).map(([label, cell]) => <Fragment key={label}><dt>{label}</dt><dd>{cell(v)}</dd></Fragment>)}
              <dt>Amenities</dt><dd>{v.listing.amenities.map((a) => AMENITY_LABEL[a] ?? a).join(", ") || "None listed"}</dd></dl>
            <button className="btn" onClick={() => toggleCompare(v.listing.id)}>Remove</button>
          </section>
        ))}
      </div>
    </div>
  );
}
