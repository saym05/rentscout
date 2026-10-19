import { Link } from "react-router-dom";
import type { ListingView } from "../domain/types";
import { TYPE_LABEL } from "../lib/format";
import { MAX_COMPARE, useApp } from "../state/AppState";
import { FavoriteButton } from "./FavoriteButton";
import { Price } from "./Price";

export function SourceChip({ sourceId, isDemo }: { sourceId: string; isDemo: boolean }) {
  return (
    <span className="chips">
      {isDemo && <span className="chip chip-demo" title="Sample data, not a real advertisement">DEMO</span>}
      <span className="chip">{sourceId === "manual" ? "Added by you" : `Source: ${sourceId}`}</span>
    </span>
  );
}

export function CompareToggle({ id }: { id: string }) {
  const { compareIds, toggleCompare, notify } = useApp();
  const checked = compareIds.includes(id);
  return (
    <label className="compare-toggle">
      <input type="checkbox" checked={checked} onChange={() => {
        if (!toggleCompare(id)) notify(`You can compare up to ${MAX_COMPARE} listings. Remove one first.`, "error");
      }} />
      Compare
    </label>
  );
}

export function ListingCard({ view, onFavoriteChange }: { view: ListingView; onFavoriteChange?: (fav: boolean) => void }) {
  const l = view.listing;
  return (
    <article className="card" aria-labelledby={`t-${l.id}`}>
      <div className={`card-photo photo-${l.propertyType}`} aria-hidden="true">
        <svg className="card-art" viewBox="0 0 120 80" preserveAspectRatio="xMidYMax meet" role="presentation">
          {l.propertyType === "house" ? <><path d="M30 62V36l30-20 30 20v26z" className="art-wall" /><path d="M24 40l36-26 36 26" className="art-roof" /><rect x="53" y="44" width="14" height="18" className="art-door" /></>
            : l.propertyType === "room" ? <><rect x="28" y="22" width="64" height="40" rx="2" className="art-wall" /><rect x="36" y="44" width="34" height="10" rx="3" className="art-door" /><rect x="70" y="30" width="14" height="12" className="art-win" /></>
            : <><rect x="34" y={l.propertyType === "studio" ? 30 : 14} width="52" height={l.propertyType === "studio" ? 32 : 48} className="art-wall" />
              {[0, 1, 2].map((r) => (l.propertyType === "studio" && r < 2 ? null : [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={41 + c * 14} y={20 + r * 13} width="9" height="8" className="art-win" />)))}
              <rect x="54" y="50" width="12" height="12" className="art-door" /></>}
        </svg>
        <span className="card-type">{TYPE_LABEL[l.propertyType]}</span>
      </div>
      <div className="card-body">
        <div className="card-top">
          <SourceChip sourceId={l.sourceId} isDemo={l.isDemo} />
          <FavoriteButton id={l.id} title={l.title} isFavorite={view.isFavorite} onChange={onFavoriteChange} />
        </div>
        <h3 id={`t-${l.id}`} className="card-title"><Link to={`/listings/${encodeURIComponent(l.id)}`}>{l.title}</Link></h3>
        <p className="muted">{l.neighborhood}, {l.city} · {l.rooms} {l.rooms === 1 ? "room" : "rooms"}{l.areaSqm ? ` · ${l.areaSqm} m²` : ""}</p>
        <Price listing={l} cost={view.monthlyCost} />
        <div className="card-actions"><CompareToggle id={l.id} /></div>
      </div>
    </article>
  );
}
