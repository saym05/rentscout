import type { ReactNode } from "react";
import { ApiError } from "../domain/errors";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="state state-empty"><h2>{title}</h2>{children}</div>;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Please try again.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const details = error instanceof ApiError ? error.details : [];
  return (
    <div className="state state-error" role="alert">
      <h2>{error instanceof ApiError && error.status === 404 ? "Not found" : "We couldn't load this"}</h2>
      <p>{errorMessage(error)}</p>
      {details.length > 0 && <ul>{details.map((d, i) => <li key={i}><strong>{d.field}</strong>: {d.message}</li>)}</ul>}
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}
