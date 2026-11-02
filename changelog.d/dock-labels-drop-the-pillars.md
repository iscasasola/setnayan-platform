## 2026-09-01 · fix(homepage): the dock stops showing the retired pillar names

Migration `20271186793328`.

🔑 **A RENAME THAT ONLY TOUCHES CODE IS NOT A RENAME.** The Suri→Sai rename
(PR #5035) changed every `.ts`/`.tsx` reference and left the DATA alone, so
`homepage_background_videos` slot 4 stayed live and published as
`Suri · Setnayan AI` for a full day afterwards. Every grep came back clean while
the one place customers actually look still said the old name, and nothing in
the suite could tell.

Carries out the owner's decision (2026-08-31 / 2026-09-01) to retire the five
Filipino pillar names for plain functional ones. The owner picked the plain form
over keeping a `Name · Descriptor` pair, and **"Planner" over "3D Plan"** for
slot 3 — the planning surface, not the 3D venue walk, which is a different
feature:

| slot | was | now |
|---|---|---|
| 1 | Ala Ala · Memory Hub | **Memories** |
| 2 | Likha · Creative Studio | **Studio** |
| 3 | Plano · Planner | **Planner** |
| 4 | Suri · Setnayan AI | **Sai** |
| 5 | Tiangge · Marketplace | **Marketplace** |

⚠ **`pillar_key` IS DELIBERATELY UNTOUCHED** — the keys still read `ala-ala`,
`suri`, `tiangge`. Measured before writing: `pillar_key` is SELECTed in
`lib/background-videos.ts` and carried into the admin manager, but **nothing
anywhere branches on its value** — no icon map, no routing, no equality test.
Renaming identifiers would change nothing a customer sees while adding the risk
that one unfound reference goes stale. A db test pins this so a later "tidy-up"
has to argue with a test rather than slip through.

**Two independent defences, not one.** Each UPDATE is guarded on BOTH the slot
and the exact label it replaces (so a re-apply is a no-op rather than a second
rename over an admin's hand-edit), and the migration ends in a `DO $$` block
that RAISES if any retired name survives. Measured: deleting the slot-4 UPDATE
makes the **migration itself refuse to apply** — the failure lands at apply
time, not merely in CI.

**Verified against a full replay of 1,275 migrations in PGlite**, not a fixture:
labels come out `Memories / Studio / Planner / Sai / Marketplace` with
`pillar_key` still `suri`. New guard `tests/db/dock-labels.db.test.ts` (3 tests);
the required Ugat map tests pass unchanged (6 tests) — this migration adds no
schema, only data.

SPEC IMPACT: None beyond the Sai decision already recorded in the corpus
`DECISION_LOG.md` (2026-08-31); the wider pillar retirement is the owner's
standing direction, applied here to the last surviving copy of the old names.
