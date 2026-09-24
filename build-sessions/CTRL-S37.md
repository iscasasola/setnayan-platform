# S37 · COUPLE-FACING: Papic camera, guest deliveries, delegates, and unmounted home pieces

> **Model: Opus 5 · effort: high.** Released by the controller.

Source: S26's ranked orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For **every** orphan below, re-measure it, then choose ONE and say which in the PR: **(a) join the missing end** (build the caller, writer, emitter or mount), or **(b) delete the end nobody needs** (a retired or superseded feature: check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). Never add a baseline line. After #5625 merges, the guard prints "paid down" for each one you fix, so delete that line. **One PR per item or tight group.** Theme: *make everything connect properly.*

- **Papic camera:** `papic_reserve_camera_capture`, `papic_reserve_camera_points`, `papic_release_camera_points`, `papic_camera_remaining`, `papic_reserve_event_points_for_seat`, `report_guest_capture`, and `vendor_papic_capture_grants` (no writer). Is guest in-app capture wired to spend points at all? Establish what the live Papic capture path calls (#5585 retired the seat model, so seat-keyed RPCs may be dead ends to delete).
- **Guest deliveries:** `confirm_guest_delivery`, `undo_guest_delivery`, `vendor_guest_deliveries` (no writer).
- **People:** `event_delegates` (no writer), `notice-no-emitter guest_claim_rejected`, `register_guest_claim_otp_attempt`, `cluster_guest_roster`.
- **Other:** `couple_briefs`, `event_category_build_state`, `event_feature_policy_override`, `event_scene_objects`, `papic_photo_challenge_sponsorships`, `vendor_release_history`, `wedding_season_factors`, `release_event_lead_holds`, `sweep_ghosted_lead_holds`, `user_holds_founder_seat`, `open_submit_song_request` (S7 used a different song RPC; check whether this one is the walk-in path).
- **Unmounted launcher and home components** (`alaala-*`, `home-board`, `expandable`, `account-inline`, `creator-benefits`, `shop-logo`, `life-flash-home-card`, `event-type-carousel`, `setnayan-ai-story`, `dashboard-placeholder`, `service-poster`): likely leftovers of a replaced home. Confirm, then delete, unless a design says they should be showing.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S37 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S37 <what>" && { <cmd>; rc=$?; "$L" release "S37 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S37 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
