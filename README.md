# RentScout
Compare rentals with honest monthly costs: weekly/monthly rents and utilities normalized, original currency kept, conversions labelled, probable duplicates flagged (never deleted). **All listings are demonstration data.**

## Run it
Prerequisites: Node 20+, [uv](https://docs.astral.sh/uv/) (it fetches Python 3.11+ itself).
```
./run.sh            # backend http://localhost:8091 (SQLite, /docs) + frontend http://localhost:5173
./run.sh --reset    # same, starting from a fresh database
./run.sh --mock     # frontend only, in-browser MockService
```
## Tests
```
cd backend && uv run pytest                 # API (memory + SQLite), persistence, refresh, contract, TS/Python parity
cd frontend && npm test                     # domain (node:test) + UI (Vitest + Testing Library)
cd frontend && npm run typecheck && npm run build
cd frontend && npm run e2e                  # Playwright, starts/restarts the real backend itself
python scripts/check_openapi.py && uvx openapi-spec-validator openapi.yml
```
## Stack and layout
React + TypeScript + Vite (`frontend/`) · FastAPI + SQLAlchemy 2 + Alembic on SQLite (`backend/`, DB chosen by `DATABASE_URL`) · contract in `openapi.yml` · docs in `docs/`.
Env: `VITE_API_MODE=mock|http`, `VITE_API_URL`, `DATABASE_URL`, `RENTSCOUT_STORE=sql|memory`, `RENTSCOUT_RATES=demo|none`, `RENTSCOUT_FAILING_SOURCES` (test hook).
## Data sources
Only labelled demo sources. No live aggregation is claimed (docs/known-limitations.md).
## Workflow
AGENTS.md, pm.md, software-engineer.md, qa.md, qa-engineer.md. Backlog in docs/backlog.md; `python scripts/seed_issues.py --apply` can seed it into an empty GitHub repo you create yourself.
