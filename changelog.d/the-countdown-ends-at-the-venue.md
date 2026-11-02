## 2026-09-17 · fix(guest): the countdown ends at the venue, not in UTC

`events.event_date` is a `DATE` column, so it reaches the guest page as
`"2027-02-14"`. The countdown did `new Date(targetIso)`, and ECMAScript parses a
DATE-ONLY string as **UTC** — putting the target at 08:00 in Manila instead of
midnight.

- a guest at Manila midnight on the 13th was shown **1d 8h**; the truthful local
  remaining was **1d 0h**;
- the clock then hung on eight hours into the wedding day instead of retiring at
  its start.

🔑 **The row that reported this had the sign backwards** — it was filed as "ends 8
hours EARLY". It ends eight hours **LATE**, and the two have opposite fixes: anchor
the date to the venue, never shift it. The guard asserts the direction, not just the
magnitude.

🔑 **The widget was never wrong.** `target - Date.now()` is instant arithmetic and was
always correct. The entire defect was the value handed to it — so anyone opening
`countdown.tsx` to find the bug finds clean code and concludes the row is false.
Measure where a value ENTERS, not where it is used.

`countdownTargetMs` resolves a date-only value against the venue's zone via
`wallClockToInstant` — the math is **not** reimplemented; that function's own docblock
records this exact eight-hour Manila failure on the day-of surfaces, the same bug one
surface over. Both guest call sites pass the coords-derived zone; the Save-the-Date
path has no coords in scope and takes `DEFAULT_EVENT_TZ`, which is still strictly
better than the UTC parse it had.

An unanchorable date now draws **no** clock. A missing countdown is a gap; a countdown
running to the wrong instant is a lie a guest would act on.

Guarded by `apps/web/lib/the-countdown-ends-at-the-venue.test.ts`, asserting absolute
instants so it cannot pass or fail because of the runner's own zone — the same class of
mistake it exists to catch. Sabotage-checked four ways with the measured numbers printed
before any verdict: the UTC parse restored · **a flat −8h shift** (right for Manila,
caught only by the New York fixture, which is why that fixture exists) · the widget
parsing the date itself again · the no-clock guard disabled.

SPEC IMPACT: None.
