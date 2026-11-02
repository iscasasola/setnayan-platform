## 2026-07-17 · fix(vendors): screen-name slug collision aborts second same-label vendor signup

`public.generate_screen_name_for_vendor()` (migration `20260714000000`) minted the
numeric `screen_name_id` in the `(city, canonical_service)` namespace but built the
UNIQUE slug (index `vendor_profiles_screen_name_slug_unique` on
`LOWER(screen_name_slug)`) from `(city, DISPLAY LABEL, id)`. Two DIFFERENT service
keys resolving to the SAME display label — commonly two keys absent from
`canonical_service_schemas`, both falling back to `'Wedding Vendor'` — got
independent id sequences both starting at 1, producing IDENTICAL slugs
(`manila-wedding-vendor-1`) in the same city. The SECOND same-city, same-label
vendor's `INSERT` then violated the unique index and ABORTED THE SIGNUP
TRANSACTION.

Empirically confirmed via the creator-loop replay harness
(`apps/web/tests/db/replay-migrations.ts` + `creator-loop.db.test.ts`): the true
prod function aborts the second INSERT with
`duplicate key value violates unique constraint "vendor_profiles_screen_name_slug_unique"`.

New migration `20270820111851_fix_screen_name_slug_collision_namespace.sql`:
- Redefines the generator to mint via `next_screen_name_id(v_city, v_display)` —
  the display label the slug is actually keyed on — so the sequence namespace
  MATCHES the slug namespace. Adds a bounded (cap 20) uniqueness-retry loop that
  re-mints on any residual collision (legacy old-scheme slugs / drifted services)
  and RAISEs a clear error past the cap. Preserves the persistence rule (never
  regenerate an existing `screen_name`), the venue exception, the city/label
  fallbacks, and the AFTER-INSERT trigger contract byte-for-behavior.
- One-time counter seeding: for every `(city, display)` the new function would
  derive for an existing vendor, raises `vendor_screen_name_sequences.last_id`
  above the max `screen_name_id` already used in that namespace (GREATEST, so
  re-runnable / monotonic).
- Prod-safety `DO` block: fails loud if any duplicate `LOWER(screen_name_slug)`
  group already exists (0 found on the replayed corpus).

Test: new `apps/web/tests/db/screen-name-collision.db.test.ts` — two same-city
vendors with distinct fallback-label services now BOTH insert with distinct
slugs (`...-wedding-vendor-1`, `-2`), a third climbs to `-3`, persistence holds
(re-firing the generator never changes an existing name), and the venue
exception is preserved. The replay-only screen-name patch in
`replay-migrations.ts` is removed (this migration supersedes it); the harness now
replays the REAL migrations end-to-end with no shim.

Also folds in one unrelated stale-test-drift fix so the DB suite is fully green:
`creator-loop.db.test.ts` asserted the free-tier reach gate raises
`TIER_FREE_NO_REACH`, but PR-C's Pro-and-up gate (migration `20270819553697`)
renamed it — a below-Pro vendor now raises `TIER_BELOW_PRO_NO_REACH` (still
correctly rejected, just the new error name). Assertion updated.

SPEC IMPACT: None (bugfix; found by the creator-loop replay harness).
