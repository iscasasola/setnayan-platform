## 2026-11-22 · fix(seating): a guest's seat number counts from 1 on the ticket, the print and the seat pass

`event_seat_assignments.seat_number` counts from 0 — the auto-draft's first chair is 0 (`seatAt` in `lib/seating.ts`),
and prod (SELECT only, 2026-11-22) read `min(seat_number) = 0`, with 33 of 263 numbered seats on chair 0 across 3
events. Seats › List already writes `Seat ${formatCount(seat + 1)}`. Three readers printed the column raw, so the first
chair read **"Seat 0"** and every seat was one lower than the seat plan:

- `lib/pass-card.server.ts` (`readTicketSeats`) — the Digital ticket, the Wallet pass's SEAT field and the guest
  landing all read this map.
- `lib/print-set.server.ts` — the printed passes (`Seat` row, stub line).
- `app/[slug]/seat/page.tsx` — the guest's own seat pass heading ("You're at … · Seat N"). Not in the original brief;
  found by the `seat_number` reader sweep.

New `seatNumberWords(n)` in `lib/table-words.ts` (`formatCount(n + 1)`, the bare number) and all three read through it.
Every other `seat_number` reader was checked: the rest use it as a chair index (3D scene, seat-plan engine, print
chairs, moves) or already add 1 (`seat-move-assess.ts`, `guest-seat-preview.tsx`, `seat-list.tsx`).

New guard `lib/seat-number-counts-from-one.test.ts`: the rule (chair 0 → "1"), the three readers anchored on
`seatNumberWords(`, and a comment-stripped scan of `app/` + `lib/` that fails on `String(…seat_number…)`,
`seat_number.toString()`, or a `Seat {…}` / `` `Seat ${…}` `` printing a seat number without `+ 1` / `seatNumberWords`.
Two already-worded strings are excused by file and expression, each with its reason, and a stale excuse fails.
Sabotage-tested: with the three readers reverted it goes red on exactly those three lines.

SPEC IMPACT: None — a display fix to match the seat plan the couple already sees; no rule changes.
