# S43 · Supplier pages, second pass: AREA-VENDOR's "found, not fixed" list

> **Model: Opus 5 · effort: medium.** DO NOT OPEN / DISPATCH until **#5634 has merged** (item 1 shares its test file).

From AREA-VENDOR's report (2026-09-18). Re-measure each first. One PR per item.
1. The **Clients** section lists booked customers only from pool bookings, the same gap #5634 fixed on Today. Apply the same rule (after #5634 merges; reuse its helper).
2. The **Bookings** list tags "New" / "Stale" from chat activity only, never from the booking itself. Derive it from the booking state.
3. Links to `/vendor-dashboard/bookings` and "View on calendar" loop back to the same My Customers page. Make each land on what it names.
4. Pinning a review older than the newest 5 doesn't change the public page. Honour the pin.
5. **Explore cards** leave out inclusions, discounts and showcase photos that the shop page shows. Use the same card face and data (see S27 #5620 / #5622).
6. The card-maker intro sample promises an "Exclusive" perk suppliers can't write, and says "shoot". Make the sample honest and neutral to supplier type.
7. The Pro upgrade on My Performance advertises "Price-Position", which no page shows (S34 found `price-position-card.tsx` unmounted). Mount it or stop advertising it.
8. The shot list on the On-the-day page shows for every supplier. Show it for photo/video suppliers only (check how DAY-10 #5612 decides who gets the list).

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S43 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S43 <what>" && { <cmd>; rc=$?; "$L" release "S43 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S43 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
