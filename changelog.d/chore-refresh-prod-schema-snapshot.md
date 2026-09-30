## 2026-09-30 · chore(db): refresh the production schema snapshot

The schema-drift guard's snapshot was 41 migrations behind production (limit 40), failing every PR that adds a migration. Regenerated read-only with `scripts/gen-schema-snapshot.ts` against the linked project (ledger 1529 migrations, head 20271255305468; 406 tables, 5047 columns). No code or schema change.

SPEC IMPACT: None.
