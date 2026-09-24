# S20 · SUP-67: deleting a supplier can destroy a logged payment (live money bug)

> **Model: Opus 5 · effort: medium.** Released by the controller.

Source: the full register sweep, `build-sessions/REGISTER-SWEEP-2026-09-18.md` (PR #5590; until it merges, read it with `git show origin/claude/register-sweep-lau-launch-readiness:build-sessions/REGISTER-SWEEP-2026-09-18.md`). Every finding there is a hypothesis: re-measure first.

`deleteVendor()` guards deletion with `DOWNPAID_STATUSES`, which does not include the status the "record a cost" flow actually produces. So deleting a manually-recorded supplier can cascade-delete a real `event_vendor_payments` row.
1. Reproduce it with a db test first (insert a vendor plus a payment through the real flow, then delete). It must go red on current main.
2. Fix it by the **property**: refuse the delete whenever any payment row exists for that vendor. Do not add one more status to the list, because a list is exactly what drifted. The couple is told why, and how to proceed.
3. Sabotage-prove the test.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S20 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S20 <what>" && { <cmd>; rc=$?; "$L" release "S20 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S20 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
