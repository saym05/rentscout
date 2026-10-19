# Testing — only commands actually run, with observed results
| Date | Command | Result |
|---|---|---|
| 2026-10-19 | `cd frontend && npm run test:domain` | 43 pass (sandbox) |
| 2026-10-20 | `cd backend && uv run pytest` | 126 passed |
| 2026-10-20 | `cd frontend && npm run test:domain` | 44 pass (incl. vectors up to date) |
| 2026-10-20 | `cd frontend && npx vitest run` | 26 passed |
| 2026-10-20 | `cd frontend && npx tsc --noEmit -p tsconfig.json` and `vite build` | OK |
| 2026-10-20 | `uvx openapi-spec-validator openapi.yml` | First run found a YAML bug (unquoted comma in a 204 description); fixed; then OK |
| 2026-10-20 | `python scripts/check_openapi.py` | OK |
| 2026-10-20 | uvicorn smoke (health, refresh, CORS preflight) | OK |
| 2026-10-20 | `cd frontend && npx playwright test` (desktop + mobile) | 8 passed, 2 failed: the journey test hard-coded "4 listings" after the apartment filter, wrong for London (5). Assertion made count-independent; **not re-run** |

Defects found by running things (all fixed): count query crash on SQLite store; contract mismatch for null rate fields; refresh overwriting edits to imported listings (resolved as decision 10); form error text inside `<label>` polluting accessible names; openapi.yml YAML bug.
Not done: manual exploratory browser session, `./run.sh` end-to-end run.
