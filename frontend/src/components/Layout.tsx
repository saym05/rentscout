import { NavLink, Outlet } from "react-router-dom";
import { SUPPORTED_CURRENCIES, type Currency } from "../domain/types";
import { useApp } from "../state/AppState";

export function Layout() {
  const { currency, setCurrency, compareIds, toasts, mode } = useApp();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <NavLink to="/" className="brand">RentScout</NavLink>
        <nav aria-label="Main">
          <NavLink to="/search">Search</NavLink>
          <NavLink to="/compare">Compare{compareIds.length > 0 && <span className="count" aria-label={`${compareIds.length} selected`}>{compareIds.length}</span>}</NavLink>
          <NavLink to="/saved">Saved</NavLink>
          <NavLink to="/sources">Sources</NavLink>
          <NavLink to="/listings/new">Add</NavLink>
        </nav>
        <label className="currency">
          <span>Show prices in</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </header>
      <main id="main" tabIndex={-1}><Outlet /></main>
      <footer className="site-footer">
        <p>RentScout compares the real monthly cost of rentals. Weekly rents are converted at 52/12 weeks per month.
          Exchange rates are fixed demo rates (not live) and are always labelled.</p>
        <p className="small">Listings marked DEMO are sample data, not real advertisements.{mode === "mock" && " Offline mock mode."}</p>
      </footer>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
      </div>
    </>
  );
}
