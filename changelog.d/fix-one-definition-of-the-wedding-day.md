## 2026-08-06 · fix(day-of): one definition of "the wedding day", not two that disagree

P1 from the 2026-08-06 cleanliness register.

### What a couple saw

For roughly **a day and a half after their wedding**, the bottom nav swapped to
the day-of menu — Now · Check-in · Seats · Services · Schedule — while the Guests
**"Day-of" stage it points at stayed MUTED.** The menu said the day was
happening; the thing it offered said it wasn't.

**Late check-ins happen exactly in that window.**

The same contradiction ran 12 hours the other way before the event.

### Two definitions, consumed in the same component

| | window | timezone-aware |
|---|---|---|
| `isDayOfOpen` · `lib/guest-journey.ts` | `new Date(eventDate) ± 24h` | ❌ |
| `getDayOfPhase` · `lib/day-of-mode.ts` | −12h .. +36h live, .. +60h post | ✅ |

`customer-section-subnav.tsx` computed `dayOfOpen` from the first, received
`phase` from the second, and passed **both** into `buildCustomerMenuTree`.
`customer-sidebar.tsx` did the same. Neither file was wrong on its own.

🔴 **The naive copy also carried the date-is-not-an-instant defect.**
`new Date('2026-12-12')` is midnight **UTC** — already 8 hours off in Manila.
That class was fixed in 41 places on 2026-08-04; this copy was missed because it
did not look like a date bug. It looked like a menu.

### The fix

`isDayOfOpen` now **delegates** to `isEventDayActive`. It does not restate the
window — restating is what produced the drift.

`getDayOfPhase` / `isEventDayActive` gained an optional `nowMs`, so the client
component can still defer its read to an effect and avoid a hydration mismatch —
the reason the second copy existed at all. Both params are optional; all 16
existing call sites are untouched.

### Also corrected: the docblock described a different function

`getDayOfPhase`'s own comment listed `live: T−1h .. T+8h` and
`post: T+8h .. T+24h`, while the constants beneath it have always been 12h / 36h
/ 60h. The bounds are now written as expressions of those constants, so the prose
cannot disagree with the code again.

### The guard

`lib/one-day-of-window.test.ts` sweeps **every hour from T−48h to T+96h** and
asserts the two predicates return the same answer at each one. It does not assert
the numbers are right — a window may legitimately change; **two windows may not
legitimately disagree.**

It also asserts `isDayOfOpen`'s source contains no window arithmetic and no
`new Date(eventDate)`, because a restated copy passes an hour-sweep the day it is
written and drifts the first time one side moves. And a non-vacuity test proves
the window actually has edges, so agreement can't come from both sides returning
a constant.

**Sabotage-verified:** restoring the ±24h copy fails 2 of 4 and names the exact
hours (`T−16h: guest-journey=true day-of-mode=false`).

**Run in four zones** — UTC · Asia/Manila · America/New_York ·
Pacific/Kiritimati — because CI runs in UTC, the one clock where this class of
bug cancels out.

### Verification

`tsc` exit 0 · all 15 lint scripts pass · **6,739 lib tests pass under
`TZ=Asia/Manila`**.

SPEC IMPACT: None — no schema, pricing or product decision changed. The product's
window was always day-of-mode's; only the second copy disagreed.
