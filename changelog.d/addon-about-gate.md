## 2026-07-31 · fix(studio): gate the add-on About deep-link on event type — a hidden card is not a closed URL

Follow-up to #3953, found while auditing whether the re-wired Papic Pool gate
had any *other* entrance.

`app/dashboard/[eventId]/studio/about/[addon]/page.tsx` had **no event-type
gating at all**. The Suite grid filters its cards, but a grid that hides a card
does not close the URL behind it — and this route is that URL. So
`/dashboard/<id>/studio/about/papic-guest` rendered the Papic Pool pitch on a
`travel` event (the one type on the permanent V1 deny list), and
`/about/save-the-date` rendered on types whose profile disables that surface.
Every "learn more" link in the product points here, so the deep link is not
exotic — it is the ordinary path with the grid skipped.

**Extracted `addOnOfferedForEvent(entry, profile, communityId)`** into
`lib/add-ons-catalog.ts` and pointed BOTH surfaces at it. Pure + synchronous
(callers pass the already-resolved profile and `events.community_id`), so it adds
no I/O to the Suite grid and one cheap join to the About route.

It carries both layers, and the second is not derivable from the first:
1. the generic `surface` gate (0053);
2. `papicGuestPassAccess()` for `papic-guest` — the permanent `travel` deny, the
   anniversary controller split, the phase ladder, and fail-closed for a type
   nobody has scoped. Needed because migration `20270804110223` put `rsvp` on
   **every** non-wedding profile row, so the surface check alone admits the pool
   on all 16 types.

`notFound()` rather than a redirect: the couple asked for a service their event
type does not offer, and there is no honest "instead, try…" — bouncing them into
the Suite grid would imply the thing exists somewhere in it.

**Added** `lib/add-on-offered.test.ts` — pins the predicate (travel denied,
unscoped types fail closed, the anniversary split, the surface gate for
non-Papic add-ons) **and** asserts source-level that both surfaces call it. The
split between them is what let this survive; a second hand-rolled copy is how
they drifted in the first place.

SPEC IMPACT: None — enforces the existing access predicate on a route that was
never wired to it. No pricing, SKU or scope change.
