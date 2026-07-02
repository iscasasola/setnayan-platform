# Supabase migrations

## Adding a migration — always use the allocator

```bash
pnpm migration:new "add reception design column"
# -> supabase/migrations/<prefix>_add_reception_design_column.sql
```

**Do not hand-type the `YYYYMMDDHHMMSS` prefix.** Migrations apply in prefix sort
order, and the prefix is the primary key in
`supabase_migrations.schema_migrations`. Two files with the **same** prefix make
`supabase db push` crash *after* one migration's DDL already ran — prod ends up
half-applied — and the CI **migration timestamp guard** then blocks every open
PR until it's fixed. This has bitten us 4×.

`pnpm migration:new` stamps a prefix that is **unique against your local tree +
`origin/main`** (it fetches `origin/main` first) and **sorts strictly after** them.
(Wall-clock has drifted behind the prefixes, so a plain `supabase migration new` /
real timestamp would sort *before* existing migrations — don't use it.)

The one case no allocator can prevent: two people creating a brand-new migration
**at the same time**, neither merged yet — they're invisible to each other. The
CI guard on `main` is the final backstop there (it blocks the second PR's merge).

## Guard rails

- **Pre-push hook** (`.githooks/pre-push`, wired by `pnpm install` via
  `core.hooksPath`) blocks a push that introduces a duplicate prefix. It inspects
  the **commits being pushed** unioned with `origin/main` — never your working
  tree — so unrelated uncommitted WIP never false-blocks a push, and a collision
  with an already-merged migration is caught *before* the push lands.
- **`pnpm migration:check`** runs the same duplicate check on demand (against your
  working tree).
- **Existing `core.hooksPath`:** if you already have one set (this repo's primary
  dev checkout does), `pnpm install` will print that the guard is **not** active —
  enable it once with: `git config core.hooksPath .githooks`.
- **`pnpm migration:doctor`** diffs the prod ledger against `origin/main` and
  reports the two drift kinds that jam the pipeline, with the exact fix for each:
  - **ORPHAN** — a row in the prod ledger with **no file on `main`**. This makes
    `supabase db push` refuse for *every* branch (`Remote migration versions not
    found in local migrations directory`). It is *always* caused by applying a
    migration to prod **before its PR merged**. The doctor names the branch that
    still carries the file so you can land it (surgical unjam) or, if abandoned,
    `supabase migration repair --status reverted <version>`.
  - **STRANDED** — a file on `main` that is **not in the ledger**: merged but
    never applied, so the feature it gates errors in prod. (Freshly-merged files
    within a grace window are ignored as normal post-merge latency.)
  - The **`migration-drift-monitor`** GitHub workflow runs this every 2 h and
    after each apply, so drift surfaces in minutes, not days.

## Writing the migration

Keep every migration **idempotent / re-runnable** (the stub lists the patterns):

- `CREATE TABLE IF NOT EXISTS …` **and enable RLS in the same migration**
  (`ALTER TABLE … ENABLE ROW LEVEL SECURITY;`)
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
- `CREATE INDEX IF NOT EXISTS …`
- `CREATE OR REPLACE FUNCTION …`
- `DROP POLICY IF EXISTS … ;` then `CREATE POLICY …` (policies have no `IF NOT EXISTS`)

## Applying — CI is the sole applier

**Do not `supabase db push` from a feature branch.** Applying a migration to
prod ahead of its merge is the single root cause of ~every migration incident in
this repo: the migration's ledger row then has no file on `main` (an **orphan**),
which jams `db push` for everyone and silently strands later migrations. The same
trap applies to MCP `apply_migration` (it "now"-stamps a different version → also
an orphan) and to raw `db query` + a manual ledger insert.

The right path is boring and automatic:

1. Open the PR with the migration file (allocator-named, idempotent).
2. Merge it. **`supabase-migrations.yml` auto-applies it to prod on merge.**
   There's a short post-merge latency; if a merge's push trigger doesn't fire,
   run it manually: `gh workflow run supabase-migrations.yml --ref main`.

### Verifying a migration BEFORE merge (don't apply — roll back)

To prove a migration compiles against the real prod schema without touching prod,
run it inside a transaction you roll back (`check_function_bodies=on` compiles
plpgsql bodies against live tables/columns/enums — this catches wrong refs):

```bash
psql "$SUPABASE_DB_URL" <<'SQL'
BEGIN;
\i supabase/migrations/<your-file>.sql
-- introspect: to_regclass('public.your_table'), information_schema.columns, pg_proc …
ROLLBACK;
SQL
```

### If you genuinely must apply from a shell (unjamming, CI down)

Use the guarded wrapper — it refuses to apply any migration that is unmerged and
unapplied (the exact orphan-creating condition), so it only proceeds with the
same set CI would apply:

```bash
pnpm db:push            # never raw `supabase db push` from a branch
```
