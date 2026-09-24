# S19 · Paying the supplier: show their payment methods at the deposit step, and make it easy

> **Model: Opus 5 · effort: high.** DO NOT OPEN until the controller says so.

## The owner, live on the booking run (2026-09-18)
*"there is no mode to pay the vendor the deposit… the payment modes of the vendor must show. and an easier way to pay of course."*

## What already exists (the controller measured it; re-verify)
- `vendor_payment_methods` table (bank / QR / link, `is_shown`, `moderation_status`), the supplier editor at `/vendor-dashboard/payment-options`, and admin moderation at `/admin/payment-options`.
- `app/dashboard/[eventId]/_components/vendor-direct-pay.tsx`: the couple-facing "Pay {vendor} directly" sheet with the required off-platform disclosure. It is mounted on the **budget page** and in `vendor-itemization-card.tsx`, but **NOT in the deposit step** (`vendors/[vendorId]/workspace/_components/deposit-reservation.tsx`).
- **`vendor_payment_methods` has 0 rows in production.** No supplier has ever set one up, so even where the sheet is mounted it has nothing to show.

## Build
1. **At the deposit step, show the supplier's approved payment methods first** (reuse `VendorDirectPay`; do not rebuild it). The order: pay them using these → then "Record deposit". Keep the disclosure: Setnayan never holds this money.
2. **After Lock, the couple must see a next step.** On the Vendors page the locked card shows "Locked in ✓" and nothing to do. Add a clear "Pay your deposit" call to action that goes to that step. Also check the panel's "IN BUILD ₱0" next to "LOCKED ₱10,170". If it is misleading after lock, fix the wording and cite what it measures.
3. **If the supplier has no approved method,** the couple is told so plainly (not an empty sheet), and the **supplier** is prompted to add one: on agreeing to a Lock, and on their client page. Nudge them at the moment it matters.
4. Before building, check `changelog.d/` and the corpus for the payment-disclosure decision (`project_setnayan_vendor_payment_disclosure`) and anything deliberately left out.

⚠ Money surface: nothing here moves money through Setnayan. It only shows the supplier's own destinations. Never invent a destination or an amount.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S19 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S19 <what>" && { <cmd>; rc=$?; "$L" release "S19 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S19 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
