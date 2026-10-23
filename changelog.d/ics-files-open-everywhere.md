## 2026-10-23 · fix(calendar): the supplier .ics files parse everywhere — semicolons escaped, lines folded, the file terminated, a failed read said

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"). The shop-wide
"Phone calendar" file (`customers/calendar.ics`) and a customer's day-of timeline (`clients/[eventId]/calendar.ics`)
each hand-rolled their text rules and drifted:

- The shop-wide escape wrote `'\;'` — in a JS string that is just `;` — so a booking named "Ana; Ben" ended its
  SUMMARY at the semicolon. It also ended without the final CRLF RFC 5545 requires.
- Neither file folded a line past 75 octets, and a CR inside a label went through raw.
- A failed read gave an empty-but-valid file (shop-wide: bookings silently missing) or the 404 an event with no
  timeline gets (per customer). Both now answer 503 with a plain sentence.

One shared `lib/ics-text.ts` (`icsEscape`, `foldIcsLine`, `icsDocument`) now builds both. Times were already right
(TZID=Asia/Manila + a fixed +0800 VTIMEZONE; the wall clock is never converted to Z) and are unchanged.

Guard: `lib/ics-text.test.ts`.

SPEC IMPACT: None.
