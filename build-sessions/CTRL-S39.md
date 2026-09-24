# S39 · SUPPLIER-side orphans: the missing ends a supplier would hit

> **Model: Opus 5 · effort: medium.** Released by the controller.

Source: S26's orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For each orphan, re-measure it and then choose ONE, saying which in the PR: **(a) join the missing end** or **(b) delete the end nobody needs** (check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). ⚠ Before any DROP TABLE, check the live row count (read-only SQL). **If a table holds rows, stop and report.** One PR per item or tight group.

- RPCs with no caller: `consume_vendor_assets`, `grant_verified_vendor_bonus` / `grant_verified_vendor_bonus_on_insert` (**is the verified-supplier bonus ever granted?** That's a promise to suppliers, so check first), `handle_vendor_lead_report` (can a supplier report a bad lead?), `recompute_market_funnel_bands`, `rival_signals_for_vendor`, `vendor_set_booth_studio_content`, `vendors_worked_together`.
- Tables with no writer: `vendor_2307_filings` (BIR 2307: tax, so be careful and report before deleting), `vendor_bid_submissions`, `vendor_meetings`, `vendor_self_comp_caps`, `vendor_tool_bundles`.
- Unmounted: `OfflineSyncProvider.tsx` (**do not delete.** This is DAY-11 offline sync, a known large open item, so report its state), `profile-menu.tsx`, `welcome-parallax.tsx`, `eager-disclosure.tsx`, `performance/_components/scope-note.tsx`.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S39 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S39 <what>" && { <cmd>; rc=$?; "$L" release "S39 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S39 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
