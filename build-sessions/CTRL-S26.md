# S26 · Every connection has both ends: an executable guard for half-built features

> **Model: Fable 5.1 · effort: high.** Released by the controller. Owner-approved 2026-09-18: *"every connection has both ends. yes."* Owner's framing: **"my role first is to make everything connect properly."**

## Why (measured in ONE day, 2026-09-18)
The same defect shape turned up again and again: **both ends were built and the connection between them was missing or silent.**
- **Song requests:** the DB function `guest_submit_song_request` (July) and the band's inbox both existed; **no app code called the function** (fixed by #5601).
- **Supplier payment methods:** the table, editor and couple-facing `VendorDirectPay` sheet existed but were **not mounted at the deposit step** (#5599), and `vendor_payment_methods` has 0 rows.
- **Booking fee:** the `booking_fee_open_lock_charge` RPC exists, and the deposit acknowledge completed, but **no ledger row was written**. It was either never called or it failed into a fail-open branch that discards the reason (S6 is fixing this).
- **Chat box:** converted on 2 thread pages, **not on the page suppliers actually land on** (S18).
- **Delivery log:** 0 writers for months (#5588).
- **S22 + S7:** two PRs that were correct alone went red together on `main`.

## Build: an executable guard, not a document (owner steer: long-term build, not an audit)
Extend the existing connection map, don't start a second one: **`apps/web/lib/ugat/graph.ts`** plus its db tests `tests/db/ugat-schema-claims.db.test.ts` and `ugat-concept-coverage.db.test.ts`. Today those check that the map's CLAIMS about schema are true. Add the missing half: **each connection has a live caller on both sides.**

Detect at least these orphan classes, each with a **baseline file** (green on day one, fails on any NEW orphan, shrinks as items are fixed):
1. **DB functions (RPCs) with no caller**: nothing in `apps/web` calls `.rpc('<name>')`, AND no SQL (trigger, policy, other function, cron) references it. ⚠ Memory: *a TS grep cannot see an RLS policy's caller.* Search the migrations and `pg_proc`/`pg_policies` in the replay, not only TypeScript.
2. **Tables with no writer**: no insert/upsert/update in app code AND no SQL writer (trigger or function body).
3. **Notification types with no emitter**: registered in `lib/notifications.ts` / the email allowlist, but never passed to `emitNotification`. Also the reverse: emitted, but not registered or allowlisted when it should be.
4. **Components with no mount**: exported `_components/*.tsx` with zero importers, or imported only by tests. ⚠ Memory: *a mount guarded by a constant false still counts*, and *an enumeration finds what exists, not what is reachable.*
5. **Swallowed results on a money or connection path**: a fail-open branch that returns `skipped` or `null` **without recording the reason anywhere** (the booking-fee shape). Coordinate with S16's guard (#5596, "a Supabase error never read"): extend that one, don't duplicate it.

## Rules
- **Measure before asserting.** For each class, print the counts found, and hand-verify 3 random hits to prove each detector is not producing false positives. Read the memories *green-shaped-nothing-five-costumes*, *two-ways-a-guard-passes-without-proving-anything*, *a-name-collision-is-more-persuasive-than-an-absence*, *a-mechanism-is-rarely-under-the-name-you-expect* first.
- **Sabotage-prove each detector:** add a fake orphan of each class and watch it go red.
- **Do not fix the orphans in this PR.** The deliverable is the guard plus the baseline, with the baseline **grouped and ranked by user impact** (money > booking lifecycle > couple-facing > supplier-facing > admin). The controller turns the top of that list into build sessions.
- If a detector is too noisy to be honest, ship the others and say which one and why. Don't weaken it into passing.
- `main` may still be red from the song_request collision (S25 is fixing it). Rebase after S25 merges.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S26 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S26 <what>" && { <cmd>; rc=$?; "$L" release "S26 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S26 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
