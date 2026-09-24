# S36 · BOOKING LIFECYCLE: inquiry → quote → lock → contract → deposit, the missing ends

> **Model: Fable 5.1 · effort: high.** Released by the controller.

Source: S26's ranked orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For **every** orphan below, re-measure it, then choose ONE and say which in the PR: **(a) join the missing end** (build the caller, writer, emitter or mount), or **(b) delete the end nobody needs** (a retired or superseded feature: check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). Never add a baseline line. After #5625 merges, the guard prints "paid down" for each one you fix, so delete that line. **One PR per item or tight group.** Theme: *make everything connect properly.*

The booking flow is the core of the product. Its orphans:
- `table-no-writer vendor_contract_signatures`: **contracts can't be signed?** Establish what the contract step does today (there's a Contract button on the supplier's client page), and connect the signature write or explain what replaces it.
- `component-no-mount thread-quotations-card.tsx`: ⚠ this is in the chat, which **S18 (#5614)** is rewriting. Read S18's PR first. If S18 already replaced it, delete it. Otherwise hold it for S33.
- `unlock_vendor_event` · `get_pending_inquiry_basics` · `get_vendor_thread_summaries` · `list_vendor_delivery_bookings` · `set_service_slot_day_capacity` · `finalize_guest_claim` · `count_vendor_disputes_30d` (RPCs with no caller)
- `couple_waitlist_signups` · `feature_reviews` · `event_vendor_booth_placements` (no writer)
- `component-no-mount app/_components/states/locked-state.tsx`
For each one, say whether it's a real gap in the booking flow (then connect it, with a test) or superseded (then delete it). The owner drove the first real booking today (rosa-ben). Anything he'd have hit is top priority.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S36 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S36 <what>" && { <cmd>; rc=$?; "$L" release "S36 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S36 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
