# S34 · MONEY: live money paths with a missing end

> **Model: Opus 5 · effort: high.** Released by the controller.

Source: S26's ranked orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For **every** orphan below, re-measure it, then choose ONE and say which in the PR: **(a) join the missing end** (build the caller, writer, emitter or mount), or **(b) delete the end nobody needs** (a retired or superseded feature: check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). Never add a baseline line. After #5625 merges, the guard prints "paid down" for each one you fix, so delete that line. **One PR per item or tight group.** Theme: *make everything connect properly.*

Highest tier. **Do these in this order:**
1. `component-no-mount app/admin/pricing/_components/fee-form.tsx`: is the owner's booking-fee form (5% / ₱100,000 / 1%) actually reachable on `/admin/pricing`? `booking-fee-form.tsx` may be the mounted one and `fee-form.tsx` a stale twin. Establish which, and make sure the owner can edit his numbers. **Report this one to the controller as soon as you know.**
2. `verify_and_activate_manual_payment` (no caller): how are manual GCash/BDO payments activated today? If another path does it, delete this. If activation is actually missing, connect it.
3. `table-no-writer event_vendor_3d_plan_unlocks` · `vendor_ad_subscriptions`: sold products with no writer. Find the purchase flow and connect it, or confirm the product is retired.
4. `notice-no-emitter gift`: the Setnayan gift notification is never sent. Connect it at the point the gift is granted.
5. `component-no-mount app/vendor-dashboard/subscription/_components/price-position-card.tsx`: mount it or delete it.
6. The three `booking_fee_*` RPC results in `lib/booking-fee-charge.ts` that return `null` on any error: record the reason, never drop it. ⚠ **Wait for S6's PR #5615 to merge first.** It is fixing the same fee path.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S34 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S34 <what>" && { <cmd>; rc=$?; "$L" release "S34 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S34 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
