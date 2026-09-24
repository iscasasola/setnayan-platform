# S30 · The couple's budget connects to what they're deciding (4 items)

> **Model: Opus 5 · effort: medium.** Released by the controller. Theme: **make everything connect properly** (owner, 2026-09-18).

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main` (the full 456-row sweep, merged in #5590). **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. **One PR per item**, in sequence, with one worktree alive at a time. Prune each before starting the next.

- **SUP-65:** `budgetByPlanGroup` is computed but only feeds an internal ranking score. Render it as a visible per-category ₱ target on the couple's plan/budget, using the existing resolver (`resolveEventMoney`; memory: *budget-truth-flag-is-on-in-prod*, *budget-page-shows-only-finalized-money*). Don't create a second money source.
- **SUP-64:** budget export: CSV plus a print view, from the same resolver.
- **SUP-8:** `vendor-overview.ts` Upcoming still uses the narrower pool read ("named not fixed"). Fix the read so a supplier's Upcoming matches their real bookings. Verify against the rosa-ben booking (contracted, Oct 30).
- **SUP-106:** the event-delete confirmation lists only what the couple loses. Say plainly what happens to suppliers' records, matching TODAY's behaviour (they cascade away, DATA-01). The owner hasn't ruled on changing that, so describe it, don't change it.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S30 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S30 <what>" && { <cmd>; rc=$?; "$L" release "S30 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S30 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
