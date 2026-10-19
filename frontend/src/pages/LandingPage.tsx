import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { money } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp } from "../state/AppState";

const CITIES = [
  { name: "Berlin", blurb: "Kreuzberg, Neukölln, Prenzlauer Berg", tone: "berlin" },
  { name: "London", blurb: "Hackney, Camden, Brixton, Greenwich", tone: "london" },
  { name: "Toronto", blurb: "The Annex, Liberty Village, Leslieville", tone: "toronto" },
];

function CityCards() {
  const { api, currency } = useApp();
  const r = useAsync(() => Promise.all(CITIES.map((c) => api.search({ city: c.name, sort: "price_asc", pageSize: 1, currency }))), [api, currency]);
  return (
    <div className="city-grid">
      {CITIES.map((c, i) => {
        const res = r.data?.[i];
        const cheapest = res?.items[0]?.monthlyCost;
        return (
          <Link key={c.name} to={`/search?city=${c.name}`} className={`city-card city-${c.tone}`}>
            <span className="city-skyline" aria-hidden="true" />
            <span className="city-name">{c.name}</span>
            <span className="city-blurb">{c.blurb}</span>
            <span className="city-stats">
              {res ? <>{res.total} demo listings{cheapest && <> · from <strong>{cheapest.converted ? "≈ " : ""}{money(cheapest.amount, cheapest.currency)}</strong>/mo</>}</>
                : r.status === "error" ? "Browse listings" : "Loading…"}
            </span>
            <span className="city-go" aria-hidden="true">→</span>
          </Link>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  const nav = useNavigate();
  const { currency } = useApp();
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [rooms, setRooms] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (budget && (!Number.isFinite(Number(budget)) || Number(budget) <= 0)) { setError("Budget must be a positive number."); return; }
    const p = new URLSearchParams();
    if (city.trim()) p.set("city", city.trim());
    if (budget) p.set("maxPrice", budget);
    if (rooms) p.set("minRooms", rooms);
    nav(`/search?${p}`);
  }

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">For students &amp; newcomers</p>
          <h1>Know the <em>real</em> monthly rent before you sign.</h1>
          <p className="lede">Weekly prices, hidden utilities, three currencies and the same flat posted twice.
            RentScout turns every listing into one honest monthly number you can compare.</p>
          <form className="hero-form" onSubmit={submit} aria-label="Start a search" noValidate>
            <label>City
              <input list="cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Berlin, London, Toronto" />
              <datalist id="cities">{CITIES.map((c) => <option key={c.name} value={c.name} />)}</datalist>
            </label>
            <label>Monthly budget ({currency})
              <input inputMode="decimal" value={budget} onChange={(e) => { setBudget(e.target.value); setError(null); }}
                placeholder="e.g. 900" aria-invalid={!!error} aria-describedby={error ? "budget-err" : undefined} />
            </label>
            <label>Rooms (min)
              <select value={rooms} onChange={(e) => setRooms(e.target.value)}>
                <option value="">Any</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Search rentals</button>
            {error && <p id="budget-err" className="field-error" role="alert">{error}</p>}
          </form>
          <ul className="hero-points" aria-label="Highlights">
            <li>Weekly → monthly at 52/12</li><li>Utilities never guessed</li><li>Original price always shown</li>
          </ul>
        </div>
        <div className="hero-visual">
          <aside className="receipt" aria-label="Worked example of a monthly cost">
            <p className="receipt-tag">Worked example</p>
            <h2>Room in Kreuzberg</h2>
            <dl>
              <dt>Advertised</dt><dd>€150 / week</dd>
              <dt>× 52 ÷ 12</dt><dd>€650.00</dd>
              <dt>Utilities (extra)</dt><dd>+ €50.00</dd>
            </dl>
            <div className="receipt-total"><span>Real monthly cost</span><strong>€700</strong></div>
            <p className="receipt-foot">≈ £603 at a labelled demo rate · original price kept</p>
          </aside>
          <div className="sticker sticker-dup" aria-hidden="true"><strong>87%</strong> likely the same flat</div>
          <div className="sticker sticker-cheap" aria-hidden="true">Cheapest of 3 ✓</div>
        </div>
      </section>

      <section className="section" aria-labelledby="cities-h">
        <div className="section-head">
          <h2 id="cities-h">Start with a city</h2>
          <Link to="/search" className="section-link">See all listings →</Link>
        </div>
        <CityCards />
      </section>

      <section className="section" aria-labelledby="how-h">
        <div className="section-head"><h2 id="how-h">How it works</h2></div>
        <ol className="steps">
          <li><span className="how-num" aria-hidden="true">01</span><h3>Search like you normally would</h3><p>City, budget, rooms, type and must-haves. Your budget is compared to the full monthly cost, not just the rent.</p></li>
          <li><span className="how-num" aria-hidden="true">02</span><h3>See one honest number</h3><p>Weekly rent × 52 ÷ 12, plus utilities when they are extra and known. Unknown utilities are flagged, never invented.</p></li>
          <li><span className="how-num" aria-hidden="true">03</span><h3>Compare and decide</h3><p>Put up to three flats side by side, spot likely duplicates, save favourites and come back later.</p></li>
        </ol>
      </section>

      <section className="section feature" aria-labelledby="feat-h">
        <div className="feature-copy">
          <p className="eyebrow eyebrow-ochre">Duplicate hints</p>
          <h2 id="feat-h">The same flat, listed twice? We'll tell you why we think so.</h2>
          <p className="muted">RentScout scores listings on neighbourhood, rooms, price, title and size, and shows its reasons.
            It never hides or merges anything. You decide.</p>
          <Link className="btn" to="/listings/demo-berlin-2">See an example →</Link>
        </div>
        <div className="feature-visual" aria-hidden="true">
          <div className="mini-card"><span className="chip">Source A</span><b>Sunny apartment in Kreuzberg</b><span>€1,428 / month · 45 m²</span></div>
          <div className="mini-match"><span className="chip chip-probable">Probably the same flat · 87%</span>
            <ul><li>same neighbourhood</li><li>same rooms</li><li>price within 2%</li><li>area within 5%</li></ul></div>
          <div className="mini-card"><span className="chip">Source B</span><b>Sunny apartment near Kreuzberg</b><span>€1,457 / month · 45 m²</span></div>
        </div>
      </section>

      <section className="section" aria-labelledby="who-h">
        <div className="section-head"><h2 id="who-h">Made for people moving somewhere new</h2></div>
        <div className="personas">
          <figure><blockquote>“I only have a student budget. I need to know what I'll actually pay, utilities included.”</blockquote><figcaption>International student · Berlin</figcaption></figure>
          <figure><blockquote>“Two sites, two prices, one flat. I want to know before I message the landlord twice.”</blockquote><figcaption>Relocating professional · London</figcaption></figure>
          <figure><blockquote>“I save a few candidates and come back to compare them on the weekend.”</blockquote><figcaption>Budget renter · Toronto</figcaption></figure>
        </div>
        <p className="muted small">Illustrative personas from our product research, not customer reviews.</p>
      </section>

      <section className="cta" aria-labelledby="cta-h">
        <h2 id="cta-h">Ready to find out what it really costs?</h2>
        <p>Browse the sample listings or add one you found elsewhere to compare it.</p>
        <div className="row">
          <Link className="btn btn-light" to="/search">Browse listings</Link>
          <Link className="btn btn-ghost" to="/listings/new">Add a listing</Link>
        </div>
      </section>
    </div>
  );
}
