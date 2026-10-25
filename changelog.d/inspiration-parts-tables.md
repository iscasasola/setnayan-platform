## 2026-10-26 · feat(inspiration): the Mood Board's parts become two tables on the taxonomy (step ① of the approved redesign)

Step ① of the owner-approved package `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md`
(owner 2026-10-26: "Approve the redesign package — build the nine steps in order, each final").

- Migration `20271287668170_inspiration_parts_on_the_taxonomy.sql`: `inspiration_parts` (one row per
  part, keyed by today's slot key, with a tier-2 home category, `hidden`, `kind` part|system) and
  `inspiration_part_categories` ("also from", with `sort_order` — the credit's order is data). RLS at
  CREATE TABLE in `service_categories`' pattern (anyone reads, `is_admin()` writes, anon write grants
  revoked). Triggers: every category named must be tier 2; the key is permanent; a part holding a photo
  on a couple's board or in a supplier's gallery can only be hidden, never deleted.
- The seed is generated from the consts (`lib/inspiration-parts-seed.ts` →
  `scripts/gen-inspiration-parts-seed.ts`, `--check` compares the migration's block): home = the first
  tile of `MOODBOARD_SLOT_TRADES[key]`, also = the rest in order; label = the name a supplier reads today
  (`libraryPartLabel`); `palette` = system, hidden; `flowers` = hidden.
- Additive only. No photo row, column or constraint is touched, and nothing reads the tables until step ②.
- Ugat: `TYPE-INSPIRATION-PARTS` + joint J55 (claims include the board CHECK still standing and NO FK yet —
  step ② flips both).
- Guard: `tests/db/inspiration-parts-seed-equals-the-consts.db.test.ts` (seed == consts read
  independently, tier-2 homes, delete-with-photo refused, permanent key, RLS, idempotent re-apply).

SPEC IMPACT: None beyond the approved PLAN (it is the spec); the corpus DECISION_LOG rows are step ⑨.
