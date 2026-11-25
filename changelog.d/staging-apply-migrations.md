## 2026-11-25 · feat(staging): finish the final-check branch's migrations in the replay's order

The `final-check` Supabase preview branch stopped with `MIGRATIONS_FAILED` after 116 files: branching applies
`supabase/migrations` in strict version order, and `20260530010000` needs `vendor_billing_catalog`, which
`20260631000000` creates. `supabase db push --include-all` stops on the same file. Production never met this because
it applied each file once, in merge order.

- New `scripts/staging/apply-migrations.ts` (+ `apply-migrations-core.ts`): applies every file the branch's ledger
  (`supabase_migrations.schema_migrations`) does not hold, through the replay's ordering engine — a failed file rolls
  back and is retried right after the file that unblocks it. One transaction per file with its ledger row; a file
  Postgres refuses inside a transaction (SQLSTATE 25001 / 55P04) runs statement by statement and resumes where it
  stopped. Same guards as the seed: `STAGING=1`, production's ref refused anywhere in the URL, `--dry-run` reads in
  one read-only transaction and writes nothing. Uses `pg` (new root dev dependency), so it needs no psql.
- The ordering engine, the skip list, the owner precondition and the pinned out-of-order list moved from
  `apps/web/tests/db/replay-migrations.ts` to `apps/web/tests/db/migration-order.ts`, unchanged; the replay re-exports
  them, so no importer moved. One engine for every caller: the PGlite replay, the release rehearsal, the demo-shop
  database and now the staging branch.
- `build-sessions/FINAL-CHECK-KIT.md` § 2 step 2: the `db push` fallback is gone; run this script (dry run first),
  then check `list_migrations` on the branch.
- Proven by `apps/web/lib/staging-apply-migrations.test.ts` (guards, plan, ledger, bare + resume, in-place retry,
  connection loss, on a scripted database) and `apps/web/tests/db/the-staging-migration-apply-matches-the-replay.db.test.ts`
  (strict order stops where the real branch stopped; the script finishes it on the real corpus; the result matches the
  replay's schema and admin catalogue).

SPEC IMPACT: None
