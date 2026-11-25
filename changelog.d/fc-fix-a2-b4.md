## 2026-11-25 · fix(close-out, orders, dates): ten final-check faults (area 2, batch 4)

- Close out the day: offered (and accepted by the action) only once The Day has opened at the venue
  (`lib/close-out-open.ts`, the one clock) (A2-P8); a failed save stays on the page and says so (A2-G17);
  "Stop the livestream" opens the live controller (A2-G18); one confirm asks first — it cannot be undone (A2-G19).
- Nikah: the save reads its error — "Didn’t save · Try again" — and success says "Saved." (A2-I19).
- Order: a refused "Cancel order" says why; the page no longer prints its address bar as is (A2-F4).
- Pay: Maya's "Checking your payment" always has the way back, and "Check again" once it stops asking (A2-F5).
- Souvenir desk: the total is the attending headcount from `computeGuestStats` → `headcountForBasis` (A2-E1).
- Date selection: "a long weekend" only when the span really touches a weekend (`lib/long-weekend.ts`) (A2-H13).
- Find your date: the date-settings doors only for the couple (they 404 for anyone else), in plain words (A2-H16).

Not changed: A2-P1 (Home money counts up from ₱0) follows the owner's 7 Oct rule "all numbers animate" — asked as
🟠 needs-owner. A2-P5 (the import notice) is the owner's own words (DECISION_LOG 2 Nov) — by design.

Guard: `app/dashboard/[eventId]/close-out-orders-and-dates-hold-final-check.test.ts`.

SPEC IMPACT: None (each fix applies a rule already decided).
