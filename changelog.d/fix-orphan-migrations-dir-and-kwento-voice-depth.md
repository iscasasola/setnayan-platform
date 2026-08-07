## 2026-08-07 · fix(kwento,db): every guest message save has been failing — an orphan migrations directory is why

### The live bug

A guest who writes a message on a Papic photo gets `save_failed`. Always. Since
the Kwento Phase 1 Flash tier shipped (`a8262740e`).

`app/api/papic/kwento/route.ts:95` posts **eight** named arguments to
`submit_photo_message`, including `p_voice_depth`. Production's function takes
**seven** and has no such argument. PostgREST resolves an RPC by its exact set
of NAMED arguments, so one unknown name means **no candidate matches** and the
call fails before the body runs. The route maps the unrecognised failure to a
generic 500.

Nothing threw. Nothing logged a schema problem. CI was green throughout —
because CI never calls the live database.

### Why the schema was missing

The Phase 1 commit put its migration in `apps/supabase/migrations/`, an **orphan
directory**. `supabase db push` reads `<repoRoot>/supabase/migrations` only, so
that file has never been applied and never would be. The application half
shipped and went live; the schema half went somewhere nothing reads. **Both
halves looked done.**

🔑 **The failure mode is silence in both directions.** A migration in the wrong
directory does not error — it simply never runs, while looking *exactly* like a
healthy pending migration. Two of that file's columns were quietly rescued a
year later by a migration literally named
`reconcile_columns_the_code_already_uses.sql`; `voice_depth` was missed by that
sweep and stayed broken.

### 🚨 The task as written would have destroyed evidence

The brief said all three findings were verified and instructed "delete
`apps/supabase/` entirely". Re-verification found **finding 3 was wrong**:
`photo_messages.voice_depth` does **not** exist in prod. The original check had
matched `column_name ILIKE '%kwento%'`, which proves *some* kwento column
exists — not that *this file's* objects do. Deleting both files as instructed
would have thrown away the only remaining record of schema a live feature needs.

Verified against prod before writing: `voice_depth` ABSENT ·
`last_kwento_notify_at` present · `kwento_flash_auto_wall` present ·
`submit_photo_message` 7 args · exactly one caller.

### What this does

- **Migration `20271119535345`** — adds `photo_messages.voice_depth` with its two
  CHECK constraints, and rebuilds `submit_photo_message` to accept
  `p_voice_depth`, enforcing 50 chars for `flash` and 280 for `story`.
  ⚠ `DROP` + `CREATE`, not `CREATE OR REPLACE`: adding a parameter changes the
  signature, so REPLACE would leave the 7-arg function in place and a defaulted
  8th would make a 7-argument call match **both** — trading a broken feature for
  a differently broken one. Grants restored to `service_role` only, with a
  `REVOKE ALL … FROM PUBLIC` per the house rule.
- **Deletes `apps/supabase/`.** The mood-board file is genuinely redundant (its
  function is in prod via the backfill migration); the kwento file's content is
  preserved in the new migration above.
- **`lint-migrations-dir.mjs`** — fails when a `supabase/migrations/` directory
  exists anywhere but the repo root. Sibling of `lint-changelog-dir.mjs`, same
  shape, same silence. Blocking guard in `ci.yml` (step + env + aggregation
  line — all three, or it is decorative).
- **`rpc-argument-names.db.test.ts`** — the guard for the CLASS. Scans every
  inline `.rpc()` call and checks its argument names against the replayed
  schema. **197 call sites checked, 8 skipped and reported** (spread/variable
  argument objects can't be read statically, and guessing produces false
  accusations).

🔑 This is the third face of one rule: a phantom **column** in a select, a
phantom **enum value** in a filter, and now a phantom **argument** in an rpc all
get the query REJECTED, not thrown. Silence every time.

### Verification

Mutation-tested, each sabotage confirmed applied before its result was trusted:

- migrations-dir guard: orphan dir → RED; an unrelated `migrations/` dir →
  correctly ignored; clean tree → GREEN.
- rpc-argument guard: recreating the original bug → RED, naming
  `route.ts:95  submit_photo_message() does not accept: …`, with the other two
  tests still passing.
  ⚠ A first attempt deleted the parameter line, which left a trailing comma and
  broke the SQL — **all three** tests failed. A broken replay is not a caught
  bug; the mutation was redone so only the relevant assertion failed.

Exposure baseline regenerated: one added column, matching the grants all 27
existing `photo_messages` columns already carry — no widening.

Typecheck clean · exposure-freeze + anon-rpc 12/12 · all 17 lint scripts pass.

SPEC IMPACT: None. The Kwento Flash/Story tier is an already-specified feature
(`0012_papic`); this makes the shipped code actually work. No pricing, SKU or
copy change.
