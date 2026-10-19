# RentScout — product specification
## Problem
Apartment seekers in a new city check several rental sites with inconsistent prices (weekly vs monthly, utilities in or out, different currencies) and cannot easily see the real monthly cost or notice the same flat listed twice.
## Audience and personas
- **Amara, international student** (Berlin, 6-month budget): needs total monthly cost with utilities and a cheap room near campus.
- **Diego, relocating professional** (London): compares 3 shortlisted flats side by side and wants to know if two listings are the same flat.
- **Lena, budget renter**: filters by price and amenities, saves candidates, returns later.
## Main journeys
1. Landing → search city + budget → results → open listing → follow original-source link.
2. Search → select 2-3 listings → compare → pick cheapest total.
3. Save favorites → saved page → remove.
4. Open status panel → refresh sources → see per-source result and last update.
## Functional requirements (MVP = 23 features)
Landing; search page; search by city, neighborhood, price range, rooms; filters for type and amenities; sort (lowest, highest, newest); listing cards; detail pages; monthly cost normalization (weekly→monthly, utilities); original currency stored, display currency selectable, conversions labelled with rate/date/source; compare up to 3; favorites; saved page; source indicator; original link when available; last-updated timestamp; probable-duplicate detection; refresh; loading/empty/error/success states; responsive; SQLite persistence; deterministic demo data; documented adapter architecture; automated tests.
## Non-functional
Typed code; deterministic demo data; works fully offline from external sources; responsive from 360px; WCAG-minded (labels, contrast 4.5:1, keyboard); API p95 < 300 ms on demo-size data; no stack traces to users.
## Scope
MVP: above. Post-MVP: live adapter, verified FX provider, map, accounts, alerts (issues 38-42).
## Data model
Listing(id, title, description, city, neighborhood, propertyType, rooms, areaSqm?, rentAmount, rentPeriod, currency, utilitiesIncluded, utilitiesMonthly?, amenities[], sourceId, externalId?, sourceUrl?, isDemo, firstSeenAt, lastSeenAt, updatedAt) · Source(id, name, kind, status, lastCheckedAt, lastSuccessAt, error) · Favorite(userId, listingId) · RateTable is configuration, not data.
Normalized monthly cost = monthly rent (weekly×52/12) + utilities when excluded and known. Original amount and currency are never overwritten.
## API
See openapi.yml (12 operations). Error envelope `{error:{code,message,details[]}}`.
## Validation rules
rent > 0; utilities ≥ 0 or null; rooms integer 1-20; currency in EUR/GBP/CAD/USD; minPrice ≤ maxPrice; minRooms ≤ maxRooms; page ≥ 1; pageSize 1-100; compare 2-3 unique existing ids.
## Errors
400 validation with field details; 404 missing; 409 refresh in progress; 5xx generic message only.
## Security
Backend validation, SQLAlchemy parameterized access, no secrets in git, local CORS only, no traces. Favorites use a documented demo user (X-Demo-User) — not authentication.
## Acceptance criteria
Each backlog issue carries its own; global: all journeys pass in a running app against SQLite; data persists across backend restart; demo data always labelled.
## Constraints
No guaranteed free rental API: only the labelled demo source is guaranteed. Live sources only if permitted (issue 31).
