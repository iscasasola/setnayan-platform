## 2026-08-02 · fix(erasure): the migration text no longer says what the schema does — 30 FKs are rewritten inside a DO block

`20271032282809_user_delete_fk_completion_remaining_30.sql` rewrites **thirty** foreign keys from inside a `DO $$` block:

```sql
EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, found.conname);
EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', spec.tbl, spec.col);
```

The table, column and action live in a `VALUES` list; the DDL only exists at runtime. So grep `CREATE TABLE public.event_playlist_picks` today and you find `created_by_user_id UUID NOT NULL` with no ON DELETE clause — while production has been `ON DELETE SET NULL` **and nullable** since 2026-08-02.

`lib/security/migration-schema.ts` cannot see inside a DO block. Neither can grep. Neither can a person.

### This was measured, not predicted

A systematic pass over the 78-table erasure backlog reasoned from the migration text, with every verdict then attacked by an independent reader. **41 of 78 were overturned** — 23 kept the bucket with unusable evidence, **17 had the decision wrong**, and **eleven of those seventeen moved `EXCLUDE` → `PURGE`**: personal data left alive after an erasure request, in eleven tables, each with a confident reason attached.

A recurring shape in the wrong half: *"the column is NOT NULL, so it cannot be de-identified in place, so exclude it"* — about columns the database had already made nullable.

### The fix is generation, not a bigger regex

PGlite **replays** migrations, so it **executes** the DO block; `pg_constraint` afterwards is ground truth by construction. `tests/db/user-fk-behaviour.generated.txt` now records every user-referencing FK and CI fails when it drifts.

**205 single-column FKs onto `auth.users` / `public.users` — `CASCADE=59 · RESTRICT=3 · SET NULL=143`.** The RESTRICT=3 independently corroborates `20271032282809`'s own claim that exactly three still refuse.

### ⚠ Two things the file says out loud, because both caused real errors

- **`SET NULL` does NOT mean "erasure handled it."** Erasure anonymizes in place (`auth.admin.updateUserById`) and issues **no DELETE**, so the clause never fires on the erasure path. It fires for the anon-draft sweep, which does hard-delete.
- The backlog is still a ratchet. Bulk classification does not clear it — that is now recorded in the guardrail docblock with the 41/78 number, so the next person doesn't retry the shortcut.

Mutation-tested: flipping one row of the generated file fails the guard (2/3) and prints the diff; restored, 3/3.

Verified: full DB suite **729/729**, erasure guards **26/26**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — a generated reference plus a staleness guard.
