# S12 · LAU-20: journal-spotlight approval is blocked by a CHECK constraint (live bug)

> **Model: Opus 5 · effort: medium.** Session S12 of `build-sessions/CONTROLLER-PLAN-2026-09-18.md`. Source: the LAU re-measure in build-sessions/REGISTER-SWEEP-2026-09-18.md (on branch claude/register-sweep-lau-launch-readiness / PR #5590 until it merges).

The S10 finding: migration `20270518682623_fraud_enforcement_state_and_audit.sql` rebuilt `admin_approval_requests_action_type_check` and **dropped `'approve_journal_spotlight'`**, so `initiateSponsored()` fails on insert in prod.

1. First, confirm the bug live, read-only: `select pg_get_constraintdef(oid) from pg_constraint where conname='admin_approval_requests_action_type_check';`
2. Write a corrective migration (`pnpm migration:new`). ⚠ **Rebuild the CHECK from the CURRENT prod vocabulary plus the missing value.** Do NOT copy it from any older migration: a re-listed CHECK vocabulary drops any value added later (memory: *a-re-listed-check-vocabulary-drops-a-later-value*). Also query the live rows (`select distinct action_type from admin_approval_requests`) so the new CHECK can't refuse an existing row.
3. Add a db test that inserts every action type the code emits (derive the list from the code, not by hand), so this cannot happen again.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S12 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S12 <what>" && { <cmd>; rc=$?; "$L" release "S12 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S12 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
