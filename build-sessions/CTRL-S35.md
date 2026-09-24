# S35 · MONEY tidy: delete the retired token wallet, supplies vertical and dead checkout

> **Model: Sonnet 5 · effort: medium.** Released by the controller.

Source: S26's ranked orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For **every** orphan below, re-measure it, then choose ONE and say which in the PR: **(a) join the missing end** (build the caller, writer, emitter or mount), or **(b) delete the end nobody needs** (a retired or superseded feature: check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). Never add a baseline line. After #5625 merges, the guard prints "paid down" for each one you fix, so delete that line. **One PR per item or tight group.** Theme: *make everything connect properly.*

The token wallet was **RETIRED 2026-05-11** (locked decision) and the supplies vertical is deferred. Their leftover ends are orphans by retirement. **Delete the end that remains** rather than building a caller:
- RPCs: `approve_vendor_token_purchase`, `confirm_vendor_token_purchase_by_reference`, `consume_lead_token_hold_for`, `create_vendor_token_purchase`, `grant_member_purchased_tokens`, `grant_vendor_lifetime_tokens`, `redeem_vendor_token_voucher`, `reject_vendor_token_purchase`, and `confirm_vendor_subscription_by_reference` (verify this one is really dead first: subscriptions are live).
- Tables: `vendor_token_boosters`, `supplier_vendor_skus`, `supplier_vendor_sku_pricing`, `supplies_orders`, `supplies_order_line_items`. ⚠ **Check the live row counts first. If a table holds any rows, stop and report; don't drop it.** A DROP is irreversible.
- Notices: `vendor_token_purchase_pending`, `vendor_tokens_credited`.
- Component: `components/billing/ManualCheckoutModal.tsx` (a recorded decision to leave it exists in `changelog.d/`; read it, and delete only if that decision allows).
Use a migration for the SQL drops (forward-only, `pnpm migration:new`), and keep the Ugat map in step.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S35 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S35 <what>" && { <cmd>; rc=$?; "$L" release "S35 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S35 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
