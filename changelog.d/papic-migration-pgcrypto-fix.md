## 2026-07-29 · fix(papic): schema-qualify gen_random_bytes in the two-type-model migration

The `papic_ensure_free_one_camera()` function pins `SET search_path = public`,
but Supabase installs pgcrypto in the `extensions` schema — so the un-qualified
`gen_random_bytes(24)` could not resolve, the backfill loop raised, and the whole
20271019231590 migration rolled back on prod (nothing applied, nothing in the
ledger). Same bug class as the historical 20260513030000_fix_pgcrypto_qualification
migration; same house fix: `extensions.gen_random_bytes(24)`. Safe to edit in
place because the migration has never applied anywhere.

SPEC IMPACT: None
