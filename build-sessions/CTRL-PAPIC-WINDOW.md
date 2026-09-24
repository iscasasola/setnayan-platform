# PAPIC-WINDOW · Capture runs 12 hours past the end of the event day

> **Model: Opus 5 · effort: high.** Touches the capture gate. A mistake here refuses a real
> shutter tap at a real wedding, which is the defect class this file exists inside.

## The ruling

Owner, 2026-09-22: *"okay, we give them until lunch the next day."* then *"just do 12 hours after
the event ends."*

🔑 **THOSE ARE THE SAME RULE, AND THAT IS WHAT MAKES IT BUILDABLE.** `events` stores
`event_date` and `event_end_date` as **`date`** columns and holds **no clock time for an event
anywhere** (the only `time` columns on the table are the partners' birth times; no `run_of_show`
table carries times either — both measured 2026-09-22). So "when their event ends" can only mean
*the end of the event's calendar day*, 23:59:59 Manila. Twelve hours after that is **11:59:59 the
next morning** — which is lunch the next day. One rule, no new column, no new question asked of a
couple.

⚠ **Do not add an event end-TIME field to make this more precise.** That was considered and
rejected: it puts a new required question in front of every couple to buy accuracy nobody asked
for, and `event_end_date` is NULL on **all 11 live events** — a second optional field would be
null too, and the rule would fall back to this one anyway.

## What is true today (measure it again; do not trust this list)

- `lib/papic-window.ts` docblock: the window *"may extend BEFORE it but never AFTER (the end is
  pinned to event_date)"*. `resolvePapicWindow` returns `manilaEndOfDayIso(anchor)` for every
  non-travel event.
- `paparazzi_seats.valid_from` / `valid_until` are **`date`** columns.
- `app/dashboard/[eventId]/studio/papic/actions.ts` writes `valid_until: win.endIso` — an ISO
  **timestamp** into a **date** column, so Postgres truncates it.
- `captureWindowState(validFrom, validUntil, now)` reads `valid_until` as a whole Manila DAY,
  to `23:59:59.999`.

## 🛑 The trap that makes this a real build and not a one-line change

**Stamping `valid_until` = event day + 1 grants the WHOLE next day, not until lunch.** A DATE
column cannot express 11:59am, and `captureWindowState` deliberately reads a date as a full day —
for a good reason, documented in its own docblock: six of thirteen prod seats once had
`valid_from = valid_until`, the window collapsed to one millisecond, and **every shutter tap both
claimed photographers ever made was refused.** That is why `papic_photos` had zero rows.

So there are exactly two honest options, and the PR must say which it took and why:

- **A — widen `valid_until` to `timestamptz`** (`ALTER … TYPE timestamptz USING valid_until::timestamptz`,
  24 rows today). Then `captureWindowState` must honour a precise instant when it gets one and keep
  the whole-day reading for a bare date, or every legacy seat changes meaning silently.
- **B — leave the seat dates coarse and gate on `events.papic_window_end`** (already `timestamptz`).
  Then the seat date is a mirror, not the truth, and every reader of `valid_until` must be found —
  `app/api/upload/route.ts`, `app/papic/actions.ts`, and anything else `git grep valid_until` finds.

**A is the recommendation**: one source of truth, and the seat keeps meaning what it says.

## Also moves with the window end — check each, do not assume

- `lib/papic-challenge-clock.ts` — the last challenge closes when the capture window ends.
- `lib/papic-fullres-clock.ts` — the retention clock keys off first capture; confirm whether a
  later window end shifts anything it promises.
- `formatWindowSummary` and the picker copy: the page must say *"Cameras close Aug 2, 2pm"*, not a
  date alone. 🔑 **If the screen says the new end and the gate keeps the old one, this build has
  made things worse than before it started.**

## Definition of done

1. The gate really refuses at the new instant and really allows at 11:00am the next morning —
   proved by an executed test with a fixed clock, under **Asia/Manila**, not UTC (the existing
   docblock says a UTC-only suite is blind to exactly this class).
2. A sabotage run: revert the 12-hour term and watch the test go red with a readable message.
3. The couple-facing summary and the gate agree — assert them against ONE resolver, not two.
4. Travel events: decide and state whether a trip's last day gets the same 12 hours. (It should,
   for consistency; say so either way.)

## Controller rules

- Own worktree off `origin/main`; never read code from `/Users/icecasasola`.
- Heavy jobs through `~/Documents/Claude/Projects/heavy-lock.sh`; run unit tests from `apps/web`.
- Changelog fragment in `changelog.d/`. `gh pr merge <N> --auto --merge` right after `gh pr create`.
- RULE 0 first: `gh pr list --state open`, `git log origin/main -15`, then state
  **what exists · what is missing · the delta**.
- **Your final message must end with:**
  `CONTROLLER ▸ PAPIC-WINDOW · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
