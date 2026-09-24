# P8 · The register sweep — MEASURE, do not build

> **Model: Fable · effort: high.** **This produces a corrected register, not PRs.**

## The scale

`REFERENCE/ONE_REGISTER.md` carries **456 distinct row IDs** across four families:

| family | mentions | what it covers |
|---|---|---|
| **SUP-\*** | 131 | supplier side — shop, services, packages, payouts, inbox |
| **LAU-\*** | 66 | launch readiness |
| **DAY-\*** | 35 | day-of — Papic, panood, Live Studio, the reception |
| **DSK-\*** | 19 | desktop encoder |

**None of these has been re-measured against the served build.**

## Why this is a measurement task and not a build queue

🔑 **~40% of such rows turn out already done.** On 2026-09-16, **6 of 7** rows
re-measured were already finished. A register's status **rots in both
directions** — rows go stale as done *and* as newly broken.

🔑 **And a register's stated MECHANISM is a hypothesis.** The packs read code, so
a row can name a **real problem** and describe **entirely the wrong cause**.
Never carry a row's explanation forward as fact.

## Method — the part that makes the output trustworthy

For each row, produce exactly three things:

1. **The command you ran** (a `git grep` on `origin/main`, a `select count(*)`,
   or a page you opened in production).
2. **The number or text it printed** — not your verdict. Print what you searched.
3. **One of four statuses:** `DONE` · `OPEN` · `BLOCKED (owner)` · `WRONG (the
   row misdescribes the problem)`.

⚠ **A zero is not evidence unless you searched where the answer lives.** Platform
config is not in the repo. A flag's default in code is not its value in
production. `vercel env ls` says set/not-set, and **absence is decisive**.

⚠ **Bare `grep` on this machine is a ugrep shim** that hides gitignored paths —
a recursive sweep of the spec corpus read **350 of 2,352 files**, i.e. 15% of the
truth. Use `/usr/bin/grep` or `git grep`, and `-P` (never `-E`) if you need `\b`.

## Prioritise

Do **SUP-\*** first. The platform has **1 published shop and it is the FIXTURE** —
supplier-side gaps are the ones sitting between a real supplier and a real
booking.

## What to bring back

A rewritten register with the three fields above per row, and a one-page summary:
**how many were already DONE**, how many are genuinely OPEN, and how many rows
**described the wrong cause**. That last number is the one worth knowing.

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything.
- **Never read code from `/Users/icecasasola`** or the primary checkout — both are
  hundreds of commits behind. `git worktree add --detach /tmp/wt-<name> origin/main`.
- **RULE 0** — paste the four searches into your first reply before building.
- **Auto-merge immediately**: `gh pr merge <N> --auto --merge`. Never ask.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line.
- **Never weaken a guard to go green** — fix its window, keep its assertion.
- **Probe your runner with a deliberate failure first.** Print the numbers.
- Prune the worktree when the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
