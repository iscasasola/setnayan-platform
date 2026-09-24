# S40 · ADMIN + UNCLASSIFIED orphans

> **Model: Sonnet 5 · effort: medium.** Released by the controller.

Source: S26's orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For each orphan, re-measure it and then choose ONE, saying which in the PR: **(a) join the missing end** or **(b) delete the end nobody needs** (check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). ⚠ Before any DROP TABLE, check the live row count (read-only SQL). **If a table holds rows, stop and report.** One PR per item or tight group.

- Admin: `execute_manpower_telemetry_reward`; tables `concierge_brain_chunks`, `concierge_response_cache`, `render_jobs` (**Remotion renders: is anything rendering at all?** Check before you touch it), `seo_suggestions`.
- Unclassified: `current_user_gallery_counts`, `hamming_distance` (pHash: check the inspiration-gallery duplicate check before deleting), `moderator_can_see_row` (may be policy-called; the detector checks policies, but verify); tables `bespoke_monogram_generations`, `founder_time_log`, `person_stewardships`, `stewardship_transfers`; notices `deletion_request_nudge`, `kwento_flash_auto_walled`; components `bespoke-monogram-motion`, `category-filter-chips`, `ceremony-type-radio-group`, `live-studio/broadcast-readiness`, `nav/doorway-sidebar-header`, `nav/top-nav-utils`, `states/loading-skeleton`, `verification/application-progress`, `explore/_components/mega-column-tabs`.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S40 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S40 <what>" && { <cmd>; rc=$?; "$L" release "S40 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S40 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
