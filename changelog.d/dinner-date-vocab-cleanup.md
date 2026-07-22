## 2026-07-22 · chore(test): remove dead dinner_date ALLOWED_SKIP entry

The migration-replay harness skipped `20270832295038_setnayan_ai_event_reach_matrix.sql`
because it wrote `dinner_date` into `applicable_event_types` while `dinner_date` was never
seeded into `event_type_vocab` (HOLD-OWNER per `20270825054104`), so
`validate_applicable_event_types()` (`20261104000000`) rejected it on a fresh replay.

PR #3494 has since reconciled that migration to use the registered `gala_night` type
instead of `dinner_date`, so the migration now replays cleanly on a fresh database and the
skip is dead. Removed the entry; `npx tsx --test "tests/db/*.db.test.ts"` passes **36/36**
without it — which also empirically confirms `gala_night` is `active` in `event_type_vocab`,
settling the now-stale "gala_night is intentionally excluded — it has no event_type_vocab
row" comment in `20270731100000` (left untouched; editing an already-applied migration for
a comment is not worth it).

`dinner_date` remains an unshipped, unregistered event type (HOLD-OWNER) — no vocab seed
added, per owner intent recorded in `20270825054104`.

SPEC IMPACT: None (test-harness cleanup; `dinner_date` stays not-shipped per the existing taxonomy note).
