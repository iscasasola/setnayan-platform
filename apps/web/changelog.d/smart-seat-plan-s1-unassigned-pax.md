## 2026-07-08 · feat(guests): unassigned-pax pool on the guest-list + mobile pax meter

Smart Seat-Plan guest-reactive program, **PR S1** (points #1/#2). Adds a
target-vs-listed "pax pool" beside the existing sure-attending meter: the pool
starts full at event creation (0 guests → `unassigned = estimated_pax`) and fills
as guests are **listed** (any non-declined guest), independent of RSVP.

- `lib/guests.ts` — `computePaxProgress` / `PaxProgress` gain `listed`
  (`total − declined`, via the `invited` basis so it ignores the display basis),
  `unassigned` (`max(0, target − listed)`), and `overListed` (`max(0, listed − target)`).
- Desktop guest list (`SummaryStrip`) + mobile carousel render a compact pool line
  under the target bar ("N unassigned · L of T listed" / "L listed · X over target").
- `lib/guests.pax.test.ts` — 4 new cases incl. the fresh-event (0-guest) full-pool
  invariant.

Display-only: `estimated_pax` / `final_pax` / attending `headcount_basis` are
untouched — pricing and the finalize snapshot stay on sure-attending (owner-locked).
No schema change.

SPEC IMPACT: Implements PR S1 of `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md` (spec already in the corpus; decision A/B locked 2026-07-08). No further corpus edit needed.
