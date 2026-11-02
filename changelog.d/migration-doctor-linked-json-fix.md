## 2026-07-02 · fix(migrations): make migration-doctor JSON parse robust across --db-url and --linked

The drift monitor's first CI run (dispatched right after #2594 merged) went RED —
but on a doctor bug, not real drift, so it failed loud instead of misreporting.
`supabase db query` emits its JSON differently by connection mode: `--db-url`
prints one envelope object (`{boundary, rows, warning}`), but `--linked` (the
Management API path CI uses) prints the boundary and the rows as SEPARATE
top-level JSON values. The old `JSON.parse(raw.slice(firstBrace))` choked on the
trailing second object (`SyntaxError: Unexpected non-whitespace character after
JSON`).

Fix: `extractLedgerRows(raw)` — a string-aware, brace/bracket-depth scanner that
pulls every balanced top-level JSON value and collects rows from an array, an
envelope's `.rows`, or a bare row object. Format-agnostic (single-object,
multi-object, NDJSON, bare array), so it survives both connection modes and CLI
version changes. Wired into both `migration-doctor.mjs` and `db-push-guard.mjs`;
5 new unit tests (incl. the exact multi-object shape that crashed CI). Verified
green locally (620 ledger == 620 files) and re-running the monitor.

No schema/app change. SPEC IMPACT: None (developer tooling only).
