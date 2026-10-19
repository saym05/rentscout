# Seed backlog (RentScout)
# Parsed once by scripts/seed_issues.py. After that, GitHub Issues are canonical.
# Fields: Labels, Goal, Description, Accept (semicolon-separated), Depends (optional issue numbers, in order created).
# Items marked [in repo] already have code/docs committed here but are NOT closed until qa-engineer.md verifies them.

## 1. Repository setup and CI
Labels: mvp, documentation, priority-high
Goal: Monorepo with frontend/, backend/, docs/, agent role files and CI running tests on every push.
Description: Create layout, Makefile, .gitignore, GitHub Actions workflow with a frontend job and a backend job.
Accept: Fresh clone has the documented layout; CI workflow runs on push and fails when a test fails; all required .md files exist

## 2. Product specification, personas and user stories [in repo]
Labels: mvp, documentation, priority-high
Goal: docs/product-spec.md and docs/user-stories.md fully describe scope, data model, validation and acceptance criteria.
Description: Cover every section listed in the master prompt section 4.
Accept: Spec has problem, audience, personas, journeys, functional and non-functional requirements, MVP and post-MVP scope, data model, API requirements, validation, errors, security, acceptance criteria, constraints; every MVP feature maps to a user story
Depends: 1

## 3. Visual design direction and tokens [in repo: direction only]
Labels: mvp, frontend, documentation
Goal: Documented warm-neutral / navy / teal design with tokens implemented as CSS variables.
Description: docs/design.md holds references and decisions; tokens are implemented in the frontend scaffold.
Accept: docs/design.md lists palette, type scale, spacing, card and price hierarchy; CSS variables exist; contrast of text on backgrounds is at least 4.5:1
Depends: 2

## 4. Frontend scaffold (Vite, React, TypeScript) and routing
Labels: mvp, frontend, priority-high
Goal: App runs with npm run dev and has routes for landing, search, listing detail, compare, saved.
Description: Vite + React + TS, router, layout with header, footer and demo-data banner, a ServiceProvider that injects ApiService.
Accept: npm run dev serves the app; every route renders; UI imports only ApiService, never mockService directly
Depends: 1, 3

## 5. Domain model and monthly cost normalization [in repo]
Labels: mvp, frontend, testing, priority-high
Goal: Typed listing model and pure functions normalizing weekly or monthly rents plus utilities into a monthly cost without guessing exchange rates.
Description: frontend/src/domain/types.ts and cost.ts.
Accept: weekly rent converts at 52/12; utilities added only when excluded and known; unknown utilities flagged; different currency without rates returns null; conversion records rate, timestamp and source label
Depends: 2

## 6. Search, filter, sort and pagination logic [in repo]
Labels: mvp, frontend, testing
Goal: Pure search function with validation covering city, neighborhood, price range, rooms, type, amenities, sorting and pagination.
Description: frontend/src/domain/search.ts.
Accept: each filter works alone and combined; sorts by lowest, highest and newest; invalid params produce field errors; price-bounded search excludes non-comparable listings
Depends: 5

## 7. Duplicate detection [in repo]
Labels: mvp, frontend, backend, testing
Goal: Explainable duplicate scoring that never deletes or merges data.
Description: frontend/src/domain/duplicates.ts; weights documented in docs/architecture.md; backend port in issue 20.
Accept: score, category and human-readable reasons returned; duplicate pairs and non-duplicate pairs both tested; different cities never match; input data unchanged
Depends: 5

## 8. ApiService interface, mockService and deterministic demo data [in repo]
Labels: mvp, frontend, testing, priority-high
Goal: One interface for all data access, a mock implementation and deterministic labelled demo listings in 3 cities and 3 currencies.
Description: frontend/src/services/*.
Accept: mock supports search, detail, CRUD, favorites, compare (2-3), sources, refresh; demo data is identical on every run; all demo listings flagged isDemo; refresh partial failure and concurrent refresh handled
Depends: 5, 6, 7

## 9. Landing page
Labels: mvp, frontend
Goal: Landing page explains the product and leads into search.
Description: Hero with search box (city, budget), how it works, demo-data notice, links to search and saved.
Accept: search box navigates to results with query params; all links work; demo data is disclosed on the page
Depends: 4

## 10. Search results page with filters and sorting
Labels: mvp, frontend, priority-high
Goal: Users search by city, neighborhood, price, rooms, type and amenities, and sort results.
Description: Filter panel, sort control, result count, pagination, filter state in the URL.
Accept: every filter and sort changes results correctly; URL reflects state and can be shared; min greater than max shows an inline error; empty results show a helpful empty state
Depends: 4, 8

## 11. Listing card and detail page
Labels: mvp, frontend, priority-high
Goal: Cards and detail pages show price hierarchy, cost breakdown, source, original link, last updated and duplicate candidates.
Description: Monthly total is primary; rent, utilities and original currency are secondary; converted prices show rate, date and source label.
Accept: original-source link opens in a new tab with rel noopener; missing link hides the button; demo badge visible; probable duplicates listed with reasons; image fallback used
Depends: 10

## 12. Comparison page (up to three)
Labels: mvp, frontend
Goal: Users select 2-3 listings and see them side by side.
Description: Compare tray on cards, comparison table with cheapest highlighted and amenity matrix.
Accept: fourth selection is blocked with a message; fewer than two shows guidance; cheapest highlighted not by colour alone; selection survives navigation
Depends: 10, 11

## 13. Favorites and saved listings page
Labels: mvp, frontend
Goal: Users save and unsave listings and review them on a saved page.
Description: Heart toggle on cards and detail; saved page with empty state.
Accept: toggling updates every view; saved page lists favorites; removing from saved updates immediately
Depends: 10

## 14. Source status and refresh section
Labels: mvp, frontend
Goal: Users see source availability, last update and can run a refresh.
Description: Status panel with per-source state, last checked and error text, refresh button with progress.
Accept: failed source shows error and previous timestamp; button disabled while running; 409 shows a clear message
Depends: 4, 8

## 15. Loading, empty, error and success states, accessibility
Labels: mvp, frontend, testing
Goal: Every page has designed states and basic accessibility.
Description: Skeletons, retry on error, toasts for success, labelled inputs, focus management, keyboard navigation.
Accept: forced service error shows retry; every input has a label; page is operable with keyboard only; axe check reports no serious issues
Depends: 10, 11, 12, 13, 14

## 16. Responsive layouts
Labels: mvp, frontend
Goal: Desktop and mobile layouts work from 360px.
Description: Filters become a drawer on mobile; comparison becomes stacked cards.
Accept: no horizontal scrolling at 360px; filters usable on mobile; tap targets at least 44px
Depends: 10, 11, 12

## 17. Frontend component and integration tests
Labels: mvp, frontend, testing
Goal: Vitest and Testing Library cover navigation, cards, search, filters, sort, favorites, compare limits, detail, validation, empty, loading, error.
Description: Run against mockService.
Accept: tests listed in the master prompt section 15 (frontend) exist and pass; no test weakened to pass
Depends: 10, 11, 12, 13, 14, 15

## 18. OpenAPI contract [in repo]
Labels: mvp, backend, documentation, priority-high
Goal: openapi.yml describes every endpoint, schema, status code and error format.
Description: Derived from the ApiService interface.
Accept: 12 operations documented; structural check passes; validated with an external validator (Spectral or openapi-spec-validator) when network is available; no undocumented endpoints in the backend
Depends: 8

## 19. Backend skeleton (FastAPI)
Labels: mvp, backend, priority-high
Goal: Backend starts with make run-backend, serves /api/health and /docs, uses layered structure.
Description: routers, schemas, services, repositories, error handler returning the shared envelope without traces, CORS for local dev.
Accept: GET /api/health returns ok; unknown route returns the error envelope; exceptions never leak stack traces
Depends: 18

## 20. Port domain logic to Python
Labels: mvp, backend, testing
Goal: Cost normalization, search, validation and duplicate scoring behave identically to the TypeScript domain.
Description: Shared test vectors in docs/test-vectors.json used by both test suites.
Accept: same vectors pass in Vitest and pytest; weights and thresholds match docs/architecture.md
Depends: 7, 19

## 21. Repository interfaces and in-memory repositories
Labels: mvp, backend
Goal: Business logic depends only on repository protocols; in-memory implementations pass the full API suite.
Description: ListingRepository, FavoriteRepository, SourceRepository.
Accept: swapping implementation requires no service changes; repository contract tests are reusable
Depends: 19

## 22. Listings CRUD and search endpoints
Labels: mvp, backend, priority-high
Goal: Implement GET/POST /api/listings and GET/PUT/DELETE /api/listings/{id}.
Description: Validation per OpenAPI, pagination, filtering, sorting, duplicates on detail.
Accept: negative price, unsupported currency, bad ids and missing fields return 400 with field errors; missing resource returns 404; behaviour matches the mock
Depends: 20, 21

## 23. Favorites endpoints with demo user
Labels: mvp, backend
Goal: Implement favorites per demo user taken from X-Demo-User.
Description: Documented as not authentication.
Accept: add and remove idempotent; unknown listing returns 404; users are isolated
Depends: 21

## 24. Compare endpoint
Labels: mvp, backend
Goal: POST /api/compare returns cost-normalized comparison for 2-3 listings.
Description: Same rules as mockService.compare.
Accept: 1 or 4 or duplicate ids return 400; unknown id returns 404; cheapest computed correctly; non-comparable currency yields null cost
Depends: 22

## 25. Source adapter interface and demo adapter
Labels: mvp, backend, priority-high
Goal: Reusable SourceAdapter protocol and a demo adapter producing the deterministic dataset.
Description: Adapter returns normalized listings; registry of adapters; docs on adding one.
Accept: demo adapter output equals the frontend demo data; adapter errors are catchable and typed
Depends: 21

## 26. Refresh service
Labels: mvp, backend, priority-high
Goal: POST /api/sources/refresh runs adapters, isolates failures and prevents concurrent runs.
Description: Lock around refresh, per-source outcome, last-checked timestamps, no deletion on failure.
Accept: failing adapter leaves stored listings intact and is reported; concurrent call returns 409; success timestamps only set when the adapter ran
Depends: 25

## 27. Backend unit and API tests
Labels: mvp, backend, testing
Goal: pytest covers CRUD, search, filters, pagination, sorting, compare, favorites, invalid input, missing resources, duplicates, adapter failures, refresh.
Description: Use TestClient plus real HTTP smoke against uvicorn.
Accept: all listed areas covered; OpenAPI consistency test passes
Depends: 22, 23, 24, 26

## 28. SQLAlchemy models and migrations
Labels: mvp, backend, database, priority-high
Goal: SQLAlchemy 2.x models and Alembic initial migration with indexes and constraints.
Description: DATABASE_URL env var; no SQLite-specific types or SQL; UTC timestamps; keep original and normalized price fields.
Accept: migration creates the schema from empty; constraints reject negative prices; schema creation works on SQLite
Depends: 21

## 29. SQL repositories and seeding
Labels: mvp, backend, database
Goal: SQL repositories replace in-memory ones; seeding is deterministic and idempotent.
Description: Unit of work per request, safe initialization.
Accept: full API suite passes on both stores; running seed twice does not duplicate rows
Depends: 28, 25

## 30. Persistence tests
Labels: mvp, backend, database, testing
Goal: Data survives a backend restart.
Description: Create or edit a listing and a favorite, restart the process, read them back.
Accept: automated restart test passes; manual restart verified and logged in docs/testing.md
Depends: 29

## 31. Investigate legitimate live data sources
Labels: mvp, documentation
Goal: Documented investigation of APIs, feeds and datasets with their terms.
Description: Record sources checked, access method, terms of use, decision; never bypass CAPTCHAs, authentication or rate limits.
Accept: docs/known-limitations.md states whether any live source is integrated; app makes no claim of live aggregation unless one is implemented and tested
Depends: 25

## 32. HttpService and environment configuration
Labels: mvp, frontend, priority-high
Goal: HttpService implements ApiService against the backend; VITE_API_URL and VITE_API_MODE choose implementation.
Description: Maps error envelope to ApiError; mockService remains for tests.
Accept: switching mode needs no UI change; network failure produces a clear error state
Depends: 18, 22

## 33. Frontend/backend integration verification
Labels: mvp, testing, priority-high
Goal: All user journeys work against the real backend on SQLite.
Description: Verify search, filters, sort, detail, favorites, compare, refresh, errors and persistence.
Accept: each journey verified in a running app; browser console free of errors; no failed network requests
Depends: 30, 32, 17

## 34. End-to-end tests (Playwright)
Labels: mvp, testing
Goal: Automated E2E covering search, filter, sort, open, compare, favorite, refresh, backend restart and persistence.
Description: Runs against the real stack with a fresh SQLite file.
Accept: the 10-step journey from the master prompt section 15 passes
Depends: 33

## 35. Manual exploratory testing and bug filing
Labels: mvp, testing, priority-high
Goal: App is exercised by hand in a browser; each real defect becomes a user-test-bug issue.
Description: Follow the bug protocol in AGENTS.md; session log in docs/testing.md with real evidence only.
Accept: log lists what was done and found; every bug has an issue with Goal, Description, reproduction, groomed by pm.md, tests added per qa.md, closed by qa-engineer.md after verification
Depends: 33

## 36. Documentation synchronization
Labels: mvp, documentation
Goal: README, architecture, testing, development log and limitations match the code.
Description: Run every documented command and fix mismatches.
Accept: a fresh clone can follow the README to run frontend, backend, seed and tests; docs/brainstorming.md labelled as reconstructed unless the real transcript is added
Depends: 33

## 37. Final QA and submission
Labels: mvp, testing, priority-high
Goal: All checks pass and the repo is pushed; qa-engineer.md verifies and closes all completed mvp and user-test-bug issues before the deadline.
Description: Tests, lint, typecheck, builds, E2E, persistence, console, OpenAPI consistency, git status, issue counts from real repo data.
Accept: final counts of open and closed issues by label recorded from gh; no closed issue lacks QA verification comment; deadline October 20, 2026 14:30
Depends: 34, 35, 36

## 38. Permitted live source adapter
Labels: post-mvp, backend
Goal: Integrate one live source whose terms permit it.
Description: Only after issue 31 identifies one.
Accept: adapter isolated, tested with recorded fixtures, documented
Depends: 31

## 39. Verified exchange-rate provider
Labels: post-mvp, backend
Goal: Replace fixed demo rates with a verified provider.
Description: Record rate, timestamp and provider with every conversion.
Accept: converted values show provider and time; failure falls back to unconverted display

## 40. Map view
Labels: post-mvp, frontend
Goal: Show results on a map.
Description: Requires geocoding decision.
Accept: pins match filters

## 41. User accounts
Labels: post-mvp, backend
Goal: Replace the demo user with real authentication.
Description: Properly isolated user model.
Accept: favorites tied to accounts

## 42. Saved searches and price alerts
Labels: post-mvp, backend
Goal: Notify when a matching listing appears or its price drops.
Description: Requires price history.
Accept: alert fires once per change
