## 2026-09-14 · feat(shop): a couple picks WHICH celebration a shop is for

D1. The shop page never asked. It took the couple's FIRST event and used it for
everything — the existing-thread lookup, the inquiry composer's scope, and the
inquiry that eventually puts the shop on somebody's list.

🔑 AND "FIRST" IS NOT A PROPERTY OF ANYTHING. `fetchUserEvents` issues its query
with NO `.order()`, so `events[0]` is whatever Postgres returned first —
arbitrary per request for anyone holding more than one celebration. `is_primary`
is SELECTED by that query and never sorted on. Two call sites take it, and BOTH
carry a comment calling it the couple's "primary" event:

    app/v/[slug]/page.tsx            coupleEventId = events[0]?.event_id
    app/v/[slug]/inquiry-actions.ts  : (events[0]?.event_id ?? null)

The name in the comments and the value in the variables were two different
things, which is why this was invisible. A couple planning a wedding AND their
parents' anniversary asked a caterer a question from the shop page and could not
tell, and were not told, which celebration it attached to.

- The page now honours `?event=` when the id is one the viewer actually
  organises, checked against the membership list it had already read.
- The picker is the SHIPPED one (`app/_components/marketing/add-to-event*`,
  owner-ruled 2026-08-21) — its drawer, search, empty sentences and create row.
  Only the data shape is new.
- ⚠ THE FILTERING RULE IS REUSED UNTOUCHED. `eventsForStudioApp` takes a
  `ServiceGate` and its own docblock says a service with no `surface` is
  universal and skips the compatibility gate. A shop IS universal — a caterer is
  not incompatible with a birthday — so it passes a surfaceless gate and gets
  gates 1 and 2 exactly as shipped: "yours to change" and "ongoing and upcoming
  only". No second copy of either predicate, and no edit to the rule.
- Nothing is written. Each row is a link back to the same shop carrying
  `?event=`, so choosing is navigation: no new table, no new server action, and
  the existing inquiry action receives the choice as the `eventId` it already
  validates.

🔑 THE FALLBACK STAYS. A couple with exactly one celebration is never made to
choose, and keeps today's behaviour byte for byte. The picker earns its place
only where "first" was meaningless.

SPEC IMPACT: None — the picker and its rule are the recorded 2026-08-21 ruling.
This gives a shop page the question the Studio pages already ask.
