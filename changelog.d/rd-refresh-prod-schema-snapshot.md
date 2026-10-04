## 2026-10-04 · chore(schema): refresh the prod schema snapshot (41 migrations behind)

`schema-drift.db.test.ts` refuses any PR that adds a migration once the committed prod snapshot is more than 40 migrations behind; main sat at exactly the ceiling after today's trains, so #6343 (guest re-entry codes) went red on it. Regenerated read-only with `pnpm --filter @setnayan/web schema:snapshot` against production: ledger 1569 migrations (head 20271263752844), 413 tables, 5139 columns. No ceiling raised.

SPEC IMPACT: None.
