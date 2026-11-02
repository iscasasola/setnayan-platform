## 2026-09-02 · feat(clusters): a year shows the budgets of its celebrations

Item 7d, the last phase of item 7 and the first money on the cluster surface.
7a linked the celebrations, 7b made one guest one person across them, 7c gave
the group a timeline. This adds each celebration's budget beside its date, and
a total across the group. **No schema — a rollup, computed on read.**

- New `apps/web/lib/cluster-budgets.ts`. `fetchClusterBudgets()` reads the
  members' budget targets; `rollUpClusterBudgets()` is the pure sum. Rendered
  on the existing `/dashboard/clusters/[clusterId]` page — a section appended
  to 7c's timeline, not a new screen.
- ⛔ **NOTHING IS STORED, and nothing may be.** No cluster-level money column
  exists; 7a's guard already treats `budget` as a value-bearing name, so the
  first attempt to add one fails the required check. The total is recomputed on
  every read for the same reason 7c's span is: a stored total is stale the
  moment a host edits their budget, and a stale **money** number is read as
  fact.
- ⛔ **THE POT IS NOT ROLLED UP AND NEVER WILL BE** (owner ruling 2026-09-02).
  Budget pesos are what a couple *plans to spend with vendors*; Papic credits
  are *bought per celebration*. Only the first is summed.
  `tests/db/a-pot-belongs-to-one-celebration.db.test.ts` runs unmodified and
  green (18/18 with the year's RLS guard). A new source scan pins that no
  cluster surface imports a Papic module, reads a Papic table or calls a Papic
  function — matching the **mechanism**, never the word, because the new tile
  deliberately *says* "Papic shots … are never pooled" and a `/papic/i` sweep
  would be silenced by deleting that reassurance.

### Why the TARGET, and not "committed"

The 2026-09-02 ruling is that a cluster is "presentation and planning; it is
NOT accounting." A target is planning — the number the host typed. Committed /
paid / still-owed are accounting; they belong to `/budget`, whose one
calculator is `resolveEventMoney()`. Two measured reasons this is not merely
deference:

- that resolver is gated on `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`, which is **NOT
  SET in Vercel** (measured 2026-09-02: 109 env vars, no match) and therefore
  **OFF** — a committed figure here would be blank in production, or would have
  to reproduce the page-local legacy formula and become the *sixth*
  incompatible definition of "the budget" that `lib/budget-truth.ts` exists to
  end;
- it costs six queries per celebration, fanned across every member.

Adding it later is additive. Inventing a second formula is not undoable.

### Honest emptiness — four states, because four things are different

`₱0` is a claim. A tile reading "₱0" against a real plan is byte-identical to a
couple who has budgeted nothing — the defect this repo shipped on the guest
list and the supplier ledger and has now paid for eight times.

| state | means | renders |
|---|---|---|
| `set` | the host typed a target and we read it | the peso figure |
| `none` | we read the row; no target yet | "No budget set yet" |
| `withheld` | you are not a host of this celebration | "Not shown — you are not a host of this celebration" |
| `unknown` | the read was refused or failed | "We could not read this budget" |

`withheld` and `unknown` are also **counted apart**, not merged into one "not
counted". They are a rule working correctly and a failure the couple can retry;
collapsed, the summary line reads as a glitch over a deliberate refusal and as a
refusal over a glitch. And the headline "No budgets set yet" — a claim about
*all* of them — is printed only when all of them were actually read.

`totalPhp` is **null whenever nothing contributed** — no members, none
readable, or nobody has set a target. Σ of no rows is 0 in arithmetic and a lie
on a screen. When only *some* members contribute, the tile names what is
missing — "Across 2 of 4 celebrations · 1 with no budget set · 1 we could not
read — refresh to try again". A partial sum drawn as the whole is the same
confident-wrong-number defect one level up.

### 🔒 The rollup is not a new door onto somebody else's money

`events_host` is `security_invoker = false` and its own WHERE admits a couple
member **or an accepted moderator** — the leak `lib/budget-visibility.ts` was
written for, where production carried an accepted `wedding_planner_external`
with `checkout: false` on an event with a ₱930,000 target. So the rollup
re-asks **COUPLE** membership on every read and shows the money of nothing
else.

🔑 And membership is re-asked rather than inherited from the link: 7a's INSERT
policy checks both halves at *link* time, but nothing re-checks them
afterwards, so a cluster outlives the access that justified it. A new db test
builds exactly that row — the owner keeps the cluster, loses the membership,
and the budget leaves the total.

### Proved by sabotage, not asserted

Nine mutations, every one red, each applied in isolation and the file restored
to its exact SHA-256 afterwards (a first run restored with `git checkout` on an
**untracked** file, which is a no-op, and the sabotages silently stacked — the
counts from that run were discarded):

1. `totalPhp` always a number → 10 red · 2. the couple-membership belt deleted →
the delegate's ₱930,000 enters the year · 3. a missing host row read as "no
budget set" · 4. a `withheld` row's figure counted · 5. a Papic import added ·
6. a refused membership read relabelled `withheld` · 7. `withheld` folded back
into `unknown` · 8. (db) the `couple` predicate widened to any membership ·
9. a surface renders `sort_key` (re-proved after the stripper fix below).

### Also included, and it belongs to #5090

`lib/the-span-is-derived-and-the-sort-key-is-never-shown.test.ts` (7c) grew its
own two-replace comment stripper and fails the required
`lint-one-comment-stripper` check — the reason PR #5090 is currently red. 7d is
stacked on that branch and inherits the failure, so the one-line fix to
`stripComments` is here. 7c's own suite stays green (9/9) and the `sort_key`
guard was re-proved by sabotage after the change.

SPEC IMPACT: `DECISION_LOG.md` — new row for 7d (item 7 complete: budgets roll
up across a cluster, the pot never does, the total is derived on read).
`WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 7 — 7d marked built.
