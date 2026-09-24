# S42 · The second full wedding run, with a PAID booking fee (option C)

> **Model: Fable 5.1 · effort: high.** The owner drives; you confirm every step by read-only SQL, as S6 did.

## Why
The first real booking (rosa-ben × Saysay, 2026-09-18) completed, but its fee was correctly **waived** (Saysay's booking #1 of the free 5), so the **paid** path has never run for real. #5615 (live since 2026-09-19 01:18 UTC) fixed the ledger write and added a DB test of the whole money path. This run proves it on production, with a real supplier-facing fee screen, a real QR payment and a real admin approval.

## Step 0 · owner approval: GIVEN
✅ **The owner approved option C in the controller session on 2026-09-19: "yes let us do the test rows".** You may seed the test ledger rows without asking again. Still **show the owner the exact rows before inserting them**, record every inserted id, and delete them in Step 4. The approval covers these labelled test rows for Saysay only, nothing else.

## Step 1 · measure (read-only)
- The served sha from `/api/health` must contain #5615's merge.
- Saysay's current `booking_fee_ledger` count and ordinals (expected: 1 row, ordinal 1, waived_free5, from rosa-ben).
- The live fee schedule, read from where `/admin/pricing` stores it (5% under ₱100,000 / 1% above). **Never hard-code it.**

## Step 2 · seed (only after the YES)
Insert 4 clearly labelled test ledger rows for Saysay (ordinals 2–5, `waived_free5`, a note/marker saying `S42 TEST — delete after run`), through the same function path the app uses if one exists; otherwise the minimum SQL, shown to the owner first. Record every inserted id. Tell the owner "Saysay is now at 5 of 5 free".

## Step 3 · the owner drives booking #6 (new test event on `testnayan3@test.com`)
Inquiry → quote → accept → lock (couple asks, supplier agrees) → deposit recorded → **supplier confirms deposit**. At that confirmation the fee must open: expect a `booking_fee_charges` row `pending` at the schedule amount, an `orders` row and a pending payment. Then as `testnayan2` open `/vendor-dashboard/booking-fees` → the fee shows as owed → pay via the QR with a test reference → as admin approve at `/admin/payments` → the charge becomes `paid`, and `/admin/booking-fees` shows it paid. Confirm each step by SQL and print the numbers. Also check the Setnayan gift / Papic credits that fire at fee approval (owner lifecycle ruling).

## Step 4 · clean up
Delete the S42 seed rows by recorded id. Leave the real booking #6 records only if the owner wants them; otherwise remove them the way refunds/admin tools do. Re-measure: Saysay's ledger is back to its real state.

## Report
Every step's SQL result, what the supplier and admin screens said, and every defect (open PRs only for fixes outside files other open PRs own). ⚠ Never type credentials; the owner signs in. Never the Google button; never the owner's `is_internal` account.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S42 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S42 <what>" && { <cmd>; rc=$?; "$L" release "S42 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S42 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
