# Development log
## 2026-10-19
- Read both guides. Environment inspected: Python 3.12, Node 22, uv, git; NO network, NO `gh`, NO FastAPI/SQLAlchemy/pytest/vite/vitest installable.
- Wrote role files, spec, architecture, design, decisions, limitations.
- Implemented and tested TS domain + ApiService + MockService + deterministic demo data (43 tests passing, tsc strict OK).
- Wrote openapi.yml (12 operations) and structural checker (passes).
- Wrote 42-issue backlog and `scripts/seed_issues.py` (dry run verified; remote creation NOT performed).
- Blockers: remote GitHub operations, backend and UI build/test need a networked machine.
## 2026-10-20
- Machine with network: built FastAPI backend (domain port verified against TS vectors, memory + SQLite repositories, Alembic, adapters, refresh lock), React UI, HttpService, Vitest UI tests, Playwright E2E, `run.sh`.
- External OpenAPI validation run for the first time (found and fixed a YAML bug).
- No GitHub repo was created, per the user's instruction.
