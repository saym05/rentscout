import { Link } from "react-router-dom";
import { ListingCard } from "../components/ListingCard";
import { Empty, ErrorState, Loading } from "../components/States";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

export function SavedPage() {
  const { api, currency } = useApp();
  const r = useAsync(() => api.listFavorites(currency), [api, currency]);
  if (r.status === "loading" && !r.data) return <Loading label="Loading saved listings…" />;
  if (r.status === "error") return <ErrorState error={r.error} onRetry={r.reload} />;
  const items = r.data!;
  return (
    <section>
      <h1>Saved listings</h1>
      {items.length === 0 ? (
        <Empty title="Nothing saved yet"><p>Tap the heart on a listing to keep it here.</p><Link className="btn btn-primary" to="/search">Find listings</Link></Empty>
      ) : (
        <div className="grid">
          {items.map((v) => <ListingCard key={v.listing.id} view={v} onFavoriteChange={(fav) => { if (!fav) r.setData(items.filter((x) => x.listing.id !== v.listing.id)); }} />)}
        </div>
      )}
    </section>
  );
}
