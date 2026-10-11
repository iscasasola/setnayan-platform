## 2026-10-11 · fix(guest): the invited guest's faults — a named guest's walk of a real event (Batch C)

An independent tester walked a real test event as a named guest on a phone
(375×812) and listed 25 faults, N01–N25. These are the ones that were plainly
wrong and needed no design decision. Built, not live. One commit each.

**N06 · An event with no date never prints a sentence with a hole in it.** The
Event Hub's line read "We'd love to celebrate with you on . You're joining us
as Guest · Both sides." — the date's words were empty and the "on" stayed.
`app/[slug]/_components/site-body.tsx` (`greetingBlock`): with no date the line
is "We'd love to celebrate with you. You're joining us as…" (solemn: "We hope
you can be with us.") — the words the Maker's own drawing of this line already
used. `app/[slug]/welcome/page.tsx`: the plus-one's door no longer ends
"Marco & Marga · ". The Event details list says "Date · To be confirmed"
instead of a dash. The five waiting states that say "on the day" (find-seat,
find-my-table, seat, venue, hub) add "The date is still to be confirmed." when
the event has none (`app/[slug]/_lib/day-words.ts` `withDayNote`). The film,
the countdown, the landing, the keepsake and the checklist were read and
already had a no-date form.
Guard: `lib/a-dateless-event-prints-no-hole.test.ts` (draws the real guest
page with no date; names any new bare `formatEventDate(` under `app/[slug]`).

SPEC IMPACT: None.
