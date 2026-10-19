import { useState } from "react";
import type { RefreshResult } from "../domain/types";
import { ErrorState, Loading, errorMessage } from "../components/States";
import { dateTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

export function SourcesPage() {
  const { api, notify } = useApp();
  const r = useAsync(() => api.listSources(), [api]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true); setRefreshError(null);
    try {
      const res = await api.refreshSources();
      setLast(res);
      const failed = res.outcomes.filter((o) => !o.ok).length;
      notify(failed ? `Refresh finished: ${failed} source(s) failed; stored listings were kept.` : "Refresh finished: all sources OK.", failed ? "error" : "success");
      r.reload();
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <section>
      <div className="results-bar">
        <h1>Data sources</h1>
        <button className="btn btn-primary" onClick={refresh} disabled={busy} aria-busy={busy}>{busy ? "Refreshing…" : "Refresh sources"}</button>
      </div>
      <p className="muted">RentScout currently reads only labelled demo sources. No live rental site is connected.</p>
      {refreshError && <p className="state-error" role="alert">{refreshError}</p>}
      {r.status === "loading" && !r.data && <Loading label="Loading sources…" />}
      {r.status === "error" && <ErrorState error={r.error} onRetry={r.reload} />}
      {r.data && (
        <ul className="sources">
          {r.data.map((s) => {
            const outcome = last?.outcomes.find((o) => o.sourceId === s.id);
            return (
              <li key={s.id} className="panel" aria-label={s.name}>
                <div className="row"><h2>{s.name}</h2><span className={`chip status-${s.status}`}>{s.status === "never_run" ? "Not refreshed yet" : s.status === "ok" ? "OK" : "Failed"}</span>{s.kind === "demo" && <span className="chip chip-demo">DEMO</span>}</div>
                <dl className="facts">
                  <dt>Listings stored</dt><dd>{s.listingCount}</dd>
                  <dt>Last checked</dt><dd>{dateTime(s.lastCheckedAt)}</dd>
                  <dt>Last success</dt><dd>{dateTime(s.lastSuccessAt)}</dd>
                  {s.error && <><dt>Error</dt><dd className="warn">{s.error}</dd></>}
                  {outcome && <><dt>Last refresh</dt><dd>{outcome.ok ? `${outcome.fetched} listings fetched` : `Failed: ${outcome.error}`}</dd></>}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
