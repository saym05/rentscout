# Architecture
```
React UI ──► ApiService (interface) ──┬─► MockService (iteration 1, tests)
                                      └─► HttpService ──► FastAPI ──► services ──► Repository (protocol)
                                                                                    ├─ InMemory (iteration 3)
                                                                                    └─ SQLAlchemy/SQLite (iteration 4)
Source adapters (SourceAdapter protocol) ──► refresh service ──► repositories
```
## Boundaries
- `frontend/src/domain`: pure functions (cost, search, duplicates). No I/O. Implemented and tested.
- `frontend/src/services`: `ApiService`, `MockService`, deterministic `demoData`.
- Backend (planned, issues 19-30): routers → services → repository protocols. SQLAlchemy only in repository implementations; `DATABASE_URL` selects the DB; no SQLite-specific SQL.
- Contract: `openapi.yml`, checked by `scripts/check_openapi.py`.
## Cost normalization
monthly = (rent × 52/12 if weekly) + utilities when excluded and known. Currency conversion only with a RateTable carrying `source` and `asOf`; without one the cost is `null` (never guessed). Price filters exclude non-comparable listings; price sorts place them last.
## Duplicate detection (explainable, read-only)
Same city required. Weights: neighborhood .25, rooms .15, monthly cost within 5% .25 (within 10% .12), title token similarity ×.25, area within 5% .10. ≥ .80 probable, ≥ .60 possible. Returns reasons. Never deletes or merges.
## Source adapters (planned, issue 25)
`SourceAdapter.fetch() -> list[NormalizedListing]`; registry of adapters; the demo adapter is the only guaranteed one. Refresh runs each adapter in isolation, records per-source outcome, takes a lock (409 if running), and never deletes stored listings on failure.
## Persistence
Listing keeps original amount/currency/period plus derived normalized fields; indexes on city, neighborhood, sourceId, (sourceId, externalId) unique; favorites keyed by (userId, listingId).
