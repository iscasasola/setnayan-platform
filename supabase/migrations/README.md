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

## Writing the migration

Keep every migration **idempotent / re-runnable** (the stub lists the patterns):

- `CREATE TABLE IF NOT EXISTS …` **and enable RLS in the same migration**
  (`ALTER TABLE … ENABLE ROW LEVEL SECURITY;`)
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
- `CREATE INDEX IF NOT EXISTS …`
- `CREATE OR REPLACE FUNCTION …`
- `DROP POLICY IF EXISTS … ;` then `CREATE POLICY …` (policies have no `IF NOT EXISTS`)

Apply with:

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```
