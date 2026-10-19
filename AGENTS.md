# RentScout — agent instructions
Rental comparison for international students and newcomers. Spec: docs/product-spec.md. Status: docs/development-log.md.

## Layout
frontend/ (React+TS+Vite; `src/domain` pure logic, `src/services` ApiService + mockService) · backend/ (FastAPI + SQLAlchemy + Alembic; `app/domain` mirrors the TS domain) · openapi.yml · docs/ · scripts/

## Commands (verified marked ✔)
- `./run.sh` — run backend (:8091, SQLite) + frontend (:5173); `--mock`, `--reset`
- ✔ `cd backend && uv run pytest`
- ✔ `cd frontend && npm test` (domain + UI), `npm run typecheck`, `npm run build`
- `cd frontend && npm run e2e` (Playwright; last run 8/10, failing assertion fixed, not re-run)
- ✔ `python scripts/check_openapi.py`, ✔ `uvx openapi-spec-validator openapi.yml`
- `npm run vectors` regenerates docs/test-vectors.json after changing TS domain logic

## Rules
- Issues are the backlog. One issue at a time. Labels: mvp, post-mvp, user-test-bug.
- Roles: pm.md grooms → software-engineer.md implements (never closes) → qa.md adds tests → qa-engineer.md verifies and closes.
- Bug found by actually running the app → issue labelled `user-test-bug` with Goal + Description + reproduction; ask pm.md to groom, qa.md to add tests; fix; regression test; qa-engineer.md closes.
- Build order is mandatory: frontend+mock → openapi.yml → backend in-memory → SQLite (SQLAlchemy, no SQLite-specific SQL) → connect.
- Never present demo data as live. Never guess exchange rates. Never bypass CAPTCHAs, auth or rate limits. Never claim something ran if it did not.
- Docs must match the code; update them in the same commit.
