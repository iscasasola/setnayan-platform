## 2026-09-18 · fix(waitlist): one-click "notify" respects the genuinely-open check

The vendor calendar's one-click "a slot opened — notify them" button called
`notifyWaitlistForDate` directly, skipping the "genuinely open" check that
`notifyWaitlistForFreedDate` already runs (no covering calendar block for the
date). A stale click — the date got manually blocked or externally booked
since the vendor last loaded the calendar — could email waitlisted couples
about a date that was not actually free. It now routes through
`notifyWaitlistForFreedDate`, so a covered date is a silent no-op instead of a
false "your date opened up!" email.

SPEC IMPACT: None.
