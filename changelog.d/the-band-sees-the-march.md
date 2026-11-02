## 2026-10-23 · feat(event-hub): the band and the coordinator see the Wedding March, read-only, in their event Hub

Owner, tracker 2026-10-23: YES — "the band and the coordinator (suppliers booked in those categories) see the Wedding
March read-only in their event Hub, the same data the couple's march uses." Before this, `march_walks` RLS admitted
only the couple and their moderators, so the Song Desk read "Processional" with no line-up behind it.

- The live console (`/vendor-dashboard/on-the-day/live/[eventId]`) draws a folded "Wedding March · N walks ·
  read-only" plate for a booking in a music category or the coordinator trade (`supplierSeesMarch`,
  `lib/supplier-march.ts`), asked of what the shop was booked FOR on this event — never its whole service list.
- The data is the couple's own loader (`loadMarch` → `marchSections`), as applied (never the unapplied draft), read
  with the admin client after the page has proved the booking or day-of grant, scoped to the event.
- `MarchRead` is presentational: no button, form, drag or handler; walk numbers run on across sections like the
  maker's. A march that could not be read is said; an event where nobody walks draws nothing.
- Lab: `/dev/supplier-plan-lab?s=march` (`&unread=1`).

Guard: `lib/the-band-sees-the-march.test.ts`.

SPEC IMPACT: DECISION_LOG row (owner YES 2026-10-23).
