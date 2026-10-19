import { useEffect, useState } from "react";
import { useApp } from "../state/AppState";
import { errorMessage } from "./States";

export function FavoriteButton({ id, title, isFavorite, onChange }: { id: string; title: string; isFavorite: boolean; onChange?: (fav: boolean) => void }) {
  const { api, notify } = useApp();
  const [fav, setFav] = useState(isFavorite);
  const [busy, setBusy] = useState(false);
  useEffect(() => setFav(isFavorite), [isFavorite]);

  async function toggle() {
    const next = !fav;
    setBusy(true); setFav(next);
    try {
      await (next ? api.addFavorite(id) : api.removeFavorite(id));
      notify(next ? "Saved to your list" : "Removed from saved");
      onChange?.(next);
    } catch (e) {
      setFav(!next);
      notify(`Could not update saved listings: ${errorMessage(e)}`, "error");
    } finally { setBusy(false); }
  }
  return (
    <button type="button" className={`fav ${fav ? "on" : ""}`} aria-pressed={fav} disabled={busy} onClick={toggle}
      aria-label={fav ? `Remove ${title} from saved` : `Save ${title}`}>
      <span aria-hidden="true">{fav ? "♥" : "♡"}</span>
    </button>
  );
}
