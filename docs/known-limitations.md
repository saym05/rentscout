# Known limitations (honest status, 2026-10-20)
| Area | Status |
|---|---|
| Domain logic, mock, demo data | Implemented, tested |
| React UI (landing, search, detail, add/edit, compare, saved, sources) | Implemented; Vitest + Playwright tests |
| FastAPI backend, in-memory + SQLAlchemy/SQLite stores, Alembic | Implemented, 126 pytest tests |
| Integration (HttpService) and E2E | Implemented; last E2E run had 2 failures from a test assertion, fixed but not re-run |
| Manual exploratory testing | NOT done |
| GitHub repo/issues | NOT created (by request); backlog status lives in docs/backlog.md |
| Live rental sources | None. Only labelled demo data |
| Exchange rates | Fixed demo rates, labelled "not live" |
| Favorites | Demo user via `X-Demo-User`; not authentication |
| Search | Filters in Python over all rows (fine for demo size, not for large data) |
| Brainstorming transcript | Reconstructed summary, not verbatim |
