# Decisions
1. **Domain logic first, pure and tested** (2026-10-19): cost, search and duplicates are I/O-free so the UI, mock and backend share behaviour.
2. **No guessed FX** : conversion needs a labelled RateTable; otherwise `monthlyCost = null` and the item is excluded from price-bounded results and sorted last.
3. **Duplicate detection is read-only** and explainable.
4. **Compare requires 2-3 unique listings.** One listing is not a comparison.
5. **Demo user** via `X-Demo-User` header, documented as not authentication.
6. **Contract before backend**; the mock implements the same interface.
7. **Demo source URLs use `example.invalid`** (reserved TLD) so no demo link can point at a real site.
8. **Backlog numbering equals issue numbers** (seed into an empty repo); dependencies refer to those numbers.
9. **Rate fields nullable** (2026-10-20): `MonthlyCost.rate/rateAsOf/rateSource` are `null` when not converted (backend) or absent (mock); contract updated.
10. **Source owns imported listings** (2026-10-20): a refresh overwrites source fields of imported listings (local edits to them are lost) and updates `lastSeenAt`; manual listings (`sourceId=manual`) are never touched. The UI offers edit/delete only for manual listings.
11. **Seed once** (2026-10-20): demo data is seeded only when the `sources` table is empty, so deleting a demo listing survives a restart (a later refresh re-imports it, per 10).
12. **Alembic migrations run at startup**; a test checks the migration matches the SQLAlchemy models.
13. **Shared test vectors** (`docs/test-vectors.json`, `npm run vectors`): generated from the TS domain; pytest asserts the Python port matches exactly (demo data, costs, duplicates, searches).
