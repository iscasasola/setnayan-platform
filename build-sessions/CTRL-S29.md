# S29 · Supplier data integrity and verification (3 items)

> **Model: Opus 5 · effort: medium.** Released by the controller. Theme: **make everything connect properly** (owner, 2026-09-18).

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main` (the full 456-row sweep, merged in #5590). **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. **One PR per item**, in sequence, with one worktree alive at a time. Prune each before starting the next.

- **SUP-28:** revoke the unused signed-out write grants on `vendor_services` (migration). Run `exposure-freeze.db.test.ts` locally first (memory: *a-new-column-inherits-the-public-grant*), and check for a caller in SQL/RLS before revoking (memory: *a-ts-grep-cannot-see-an-rls-policys-caller*).
- **SUP-21:** add a CHECK constraint so `vendor_services.kind` must be in the union vocabulary. ⚠ Build it from the CURRENT prod vocabulary plus live rows (`select distinct kind`). Memory: *a-re-listed-check-vocabulary-drops-a-later-value*.
- **SUP-27:** verification should check that the payout account name matches the business or owner name (today it's only described in help copy). Build the check into the existing verification flow. Where it's ambiguous, flag it for admin review rather than auto-rejecting.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S29 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S29 <what>" && { <cmd>; rc=$?; "$L" release "S29 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S29 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
