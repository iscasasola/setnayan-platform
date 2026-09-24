# CONTROLLER PLAN · 2026-09-18 · goal: launch-ready and usable

This session is the controller. It builds nothing and only dispatches work. The
source material is `build-sessions/HANDOFF-2026-09-18/` (the zip, unpacked in full).

## What was re-measured at 10:36 UTC (the zip was already out of date)

| claim in the zip | measured now |
|---|---|
| "run everything on Fable, weekly at 98%" | **FALSE NOW.** Usage has reset: 5h 0% · weekly all-models 0% · Fable 0%. Next reset 2026-09-23 22:00 UTC. Models are chosen per task below. |
| #5586 and #5585 are in flight | Both OPEN · auto-merge armed · 0 failing · 2 and 3 checks still pending. Served sha is still `2c3b0dd`. |
| (not in the zip) | **`wt-accept` held uncommitted, never-pushed work**: the copy fix "accepting a quote is not booking it" (proposal-maker.tsx + proposal-send.ts + a guard). It touches the same files as P1, so it must merge first → **S1**. |
| (not in the zip) | `wt-ex1` has 2 unpushed commits, but its own message says they were superseded by #5375. No action; it can be pruned later. |
| worktrees | `wt-chat` (#5584 merged) was pruned. `ACTIVE-qrph-session-do-not-remove` (#5578 merged) was **left alone because its name says not to remove it**. That is an owner call. |

## The machine: 16 GB RAM, 10 cores. Memory rules for every session

A full `tsc`, a `next build`, the full unit suite, the PGlite DB replay, `pnpm install`,
`cargo` and `next dev` each count as a HEAVY job (4–6 GB each). Three at once shut this
laptop down on 2026-09-13.

1. **Only one heavy job runs at a time, machine-wide.** Everything heavy goes through the lock,
   and acquire, run and release must happen in ONE command:
   `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "<label>" && { <cmd>; rc=$?; "$L" release "<label>"; exit $rc; }`
2. **CI is the gate.** Do not run a local full typecheck or DB replay for a commit CI is already
   checking. Read `gh pr view <n> --json statusCheckRollup` instead. Locally, run only the
   targeted test file(s) you touched: `cd apps/web && npx tsx --test <file>`.
3. **Never run `next dev`.** Verify against production (`https://www.setnayan.com`) after the change serves.
4. **Push a DRAFT PR after the first commit**, so a crash or a 429 strands nothing.
5. **Prune your worktree as soon as your PR merges.**
6. **At most 3 BUILD sessions run at once**, plus light read-only ones. The controller holds
   new starts until a slot frees up.

## Model and effort for each session

Rule of thumb: Fable 5.1 for work that is load-bearing, touches the lifecycle or schema, or
drives the owner live. Opus 5 for guarded builds and measurement that needs judgement.
Sonnet 5 for mechanical or small copy work and high-volume triage.

| # | session | prompt | model · effort | kind | wave | starts when |
|---|---|---|---|---|---|---|
| **S1** | Ship the orphaned "accept ≠ booked" copy fix | `S1` | **Sonnet 5 · medium** | build (tiny) | 1 | now |
| **S2** | Payment kill switch on 5 supplier surfaces | P3 | **Opus 5 · high** | build | 1 | now |
| **S3** | Email delivery log (0 writers) | P4 | **Opus 5 · high** | build + migration | 1 | now |
| **S4** | Refunds: measure first | P5 | **Opus 5 · medium** | read-only | 1 | now |
| **S5** | "Update this quote": supersede and re-accept | P1 | **Fable 5.1 · high** | build + migration | 2 | #5586 MERGED **and** S1 MERGED |
| **S6** | End-to-end booking run, steps 4→6, with the owner | P2 | **Fable 5.1 · high** | drive + fix | 2 | #5586 SERVED. Step 6 needs `BOOKING_FEE_RAIL_LIVE` (owner) |
| **S7** | Guest song request, SUP-52 (the join) | P7a | **Opus 5 · medium** | build | 3 | a build slot frees up |
| **S8** | DAY-14 dead branch + LR-21 comment nit (2 PRs) | P7b+c | **Sonnet 5 · low** | build (tiny) | 3 | a build slot frees up |
| **S9** | Venue-NAT throttle, behind an OFF flag | P6 | **Opus 5 · high** | build | 3 | a build slot frees up |
| **S10** | Register sweep: LAU-* first (launch readiness), then SUP/DAY/DSK | P8 | **Sonnet 5 · high** | read-only | 1 (filler) | now; it is light on RAM |
| **S11** | FIXTURE shop `is_demo` | P7d | **Sonnet 5 · low** | 1 flag | — | **only after the owner answers** |
| **S12+** | Whatever S6 and S10 find | new | set per item | build | 4 | the controller writes these |

Wave 1 = S1, S2, S3 as the 3 build slots, plus S4 and S10 read-only. That is 5 sessions and at most 1 heavy job at a time.

## Collision map (why the order is what it is)

- **S1 → S5**: both edit `proposal-send.ts` and `proposal-maker.tsx`. S1 must merge first.
- **#5586 → S5, S6**: S5 rides inside the one-frame chat box, and S6's Lock buttons live in the thread page.
- **S3 and S5 both add migrations and both edit `apps/web/lib/ugat/graph.ts`**. Allocate the
  migration with `pnpm migration:new`. Whichever merges second rebases and does a trial merge, because a grep cannot predict the conflict.
- **S4 reads `lib/notifications.ts` and S3 writes it**. S4 is read-only, so there is no conflict.
- **S6 findings may overlap S5.** S6 reports to the controller before building anything in `proposal*`.

## Launch gate: "ready to launch and usable"

Engineering alone cannot close this gate. The rows below need the **owner**:

| # | owner action | why it gates launch |
|---|---|---|
| O1 | Set `BOOKING_FEE_RAIL_LIVE` in Vercel Production | Without it no booking can ever complete (S6 step 6) |
| O2 | Captcha back on (#5581 is served) | Bot protection on sign-up is off today |
| O3 | Supabase Pro | Backups are not downloadable, and the project can be paused. Needed **before the first real couple uploads a photo** |
| O4 | R2 bucket versioning (Cloudflare → R2 → each of 4 buckets → Settings) | Irreplaceable photos |
| O5 | Browsewrap vs clickwrap on `/signup` | No Terms/Privacy acceptance is recorded anywhere |
| O6 | FIXTURE shop: flag it `is_demo`? | The only published shop is fake |
| O7 | **Supplier recruitment** | 1 published shop, and it is the fixture. **No build fixes this.** Weeks of lead time, so start now |
| — | decisions 2, 3, 5, 6, 9 in `05_OWNER_DECISIONS.md` | these do not block launch day |

**Engineering side of the gate:** #5585, #5586, S1, S5 and S2 merged and served · S6 completes all 6
steps as `testnayan1` · S3 shows at least one delivered email · the S10 LAU-* rows are each either done or
turned into a build.

## How each session reports back

Each prompt ends with a required final line in this exact form:
`CONTROLLER ▸ <S#> · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`.
The controller polls `gh pr list` and the session list, and releases the next wave.
