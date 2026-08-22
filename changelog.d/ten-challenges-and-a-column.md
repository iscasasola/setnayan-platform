## 2026-08-22 · fix(papic): restore the challenge feature, and the guest is given ten

### 🚨 FIRST: THE WHOLE FEATURE HAD BEEN DELETED FROM THE REPO

PR #4686 merged at 12:56 on 2026-08-21. At 21:27, commit `aa39dc5a5`
(*"feat(invitation): the guest fills their own details"* — invitation-form work,
unrelated) **deleted every file it added**: the 631-challenge pool, the picker,
the categories, the SQL generator, the new screen, both db test files, and
**both migrations**.

Not malice — a **stale-tree merge clobber**. That branch was cut before #4686
merged, so its resolution carried its own copy of the tree and removed files it
had never seen. No conflict was raised, because from its side they did not exist.

⚠ **AND THE MIGRATIONS HAD ALREADY RUN.** Production held all 631 challenges,
`event_types`, `papic_challenge_pick_counts` and the v6 guest reader while the
repo held none of the SQL that made them. **A replayed database and production
had silently diverged** — which is the state where every db test measures a
schema nobody is running.

All 19 files restored from the merge commit. Verified in both directions: the
restore drops nothing `origin/main` currently has (only `aa39dc5a5` touched any
of them after the merge, and only to delete).

### The owner's decision: 631 to choose from, ten to do

> *"we keep the 600+ challenges but the user only picks 10."*

**`BOARD_SIZE` 20 → 10.** The LIBRARY is untouched at 631 — that is what the
couple searches and filters. What changed is how many any one GUEST is handed.

**The vendor share moved with it, and that is not a separate decision.** The
vendor lane was 5 of 20 — a quarter. Leaving it at 5 on a board of ten would
have **silently sold half of every guest's challenges**. It is now
`floor(BOARD_SIZE / 4)`, which reproduces the shipped 5 exactly at 20 and gives
2 at 10: the same proportion, arithmetically, rather than a new one taken
quietly. Zero sponsorships exist, so nothing changes for anyone today.

### 🚨 AND HALVING THE BOARD WOULD HAVE EMPTIED THE OWNER'S OWN COLUMN

Ranks 1–10 were **all photo errands**; every story sat at 11–16. On a board of
ten, **not one story and not one greeting would ever be placed by default** — so
the story/editorial column that challenge answers are meant to fill would have
been **permanently empty on every event**, caused by the change meant to feed it.

The running order is rebalanced: **1–10 a wedding's ten** (six doing, three
telling, one greeting), **11–20 any event's ten**. 🔑 The second ten costs no new
mechanism — every rank 1–10 row is wedding-scoped, so at a birthday they filter
out and 11–20 become its *lowest surviving* ranks, which the existing
`ORDER BY priority_rank NULLS LAST, library_id` then places first. Before this, a
birthday's default ten was whatever had the lowest ids: **ten selfies in a row**.

### Tests: literals replaced by the rule

25 assertions across three files pinned `20`, `5`, `10` or exact 20-slot id
arrays, so one board-size change broke all of them at once — and each would have
had to be re-derived by hand, which is how a test ends up asserting whatever the
code happens to do. They now derive from `BOARD_SIZE` / `VENDOR_SLOTS`, and the
exact-order ones compare against `expectedSetnayan()` — an independent, naive
reading of the documented ordering rule rather than the resolver re-called.

⚠ **Three shipped assertions had genuinely expired and were rewritten, not
relaxed:** *"all four stories reach the board"* (true only at 20 — now "a guest
is asked to speak, and every RANKED story lands"), *"exactly six stories hold a
rank"* (a magic number — now the balance it was protecting: enough spoken to fill
the column, errands still the majority), and *"a wedding board never moves"*
(false by instruction — now the SHAPE the new ten must have). Pinning the first
ten of the old twenty would have gone green on a board of ten photo errands.

⚠ **The source-level drift guard was re-aimed.** It re-generated the seed
migration and compared — but that migration is a SNAPSHOT and is applied in
production, so it can never be edited; the moment a later migration changed a
rank it failed for being right about the wrong question. The end-state invariant
(replayed database == pool module, field by field including `priority_rank`)
is asserted by the db test and is strictly stronger.

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §10
— board size, the vendor quarter-share, and the two running orders.
`DECISION_LOG.md` 2026-08-22.
