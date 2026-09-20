## 2026-09-20 · fix(vendor-dashboard): the upcoming-schedule row opens the customer card, not the chat

Owner, 2026-09-20, as supplier Saysay on `/vendor-dashboard` (the Today page):
*"pressing the upcoming schedules doesn't open our customer card. where we can
see updates about our project on them."*

Measured from the live DOM: every "Upcoming schedules" row was
`<a href="/vendor-dashboard/messages/<threadId>">`. The builder in
`apps/web/lib/vendor-overview.ts` read `b.threadId ? messages/<thread> :
clients/<event>` — and on a booked event a thread always exists, so the first
arm always won and the customer card had **no door at all on that list**. The
`else` arm was no better: a bare `/vendor-dashboard/clients/<id>` is itself a
chat landing since #5614 (the page redirects to the thread when no `?tab=` is
named). **Both arms opened the conversation**, which is why the row could look
right in source and still be wrong on screen.

The decision now lives in one pure module, `apps/web/lib/upcoming-schedule-door.ts`:
the row opens `/vendor-dashboard/clients/<eventId>?tab=details` — the brief, the
activity log and the completion handshake, i.e. "updates about our project" —
and a small **Message** control sits beside it so the supplier who wants the
chat still gets there in one tap. A booking with no customer card (a
schedule-pool row with no `event_vendors` row and no live thread, i.e. a manual
or off-platform booking) would be bounced by `get_vendor_event_brief`, so it
falls back to the conversation, and to `/vendor-dashboard/calendar` when there
is none — never a dead link, and `opensCard` is returned so the guard can prove
the fallback is taken **only** when the card is unreachable.

Both-ends sweep of the same class — a bare client-card link that #5614 turned
into a chat landing — fixed in the same PR:

- Today · deposit card: "View" → "View the payment", `?tab=quote` (the one money
  section both shells render; `?tab=payments` is not in `normalizeTab`).
- Today · "Confirm the deposit from …" open task → `?tab=quote`.
- Today · "Agree to a booking, or turn it down" open task pointed at
  `/vendor-dashboard` — the page it is already on, so the tap did nothing. Now
  `/vendor-dashboard#whats-new`, the card that answers it.
- Today · meeting card "Offer another time" / "Open the customer" →
  `?tab=schedule`, where `AppointmentsSection` actually is.
- Today · flagged-handover card "Open" → the thread (its own copy says *"read
  what they said and answer them in your own words"*), falling back to
  `?tab=schedule`; the label follows the destination.
- Clients roster (`clients/surface.tsx`) ×2 and the Customers roster
  (`customers/_components/customers-roster.tsx`): "Customer card" went to the
  same place as "Open chat" beside it. → `?tab=details`.
- The five "← Event brief" / "Back to client" links on the card's own sub-pages
  (editorial-media, challenge-photos, cocktail, seat-plan, mood-board) →
  `?tab=details`.
- Day-of console (`on-the-day/page.tsx`): "Your event brief" / "Run the floor" /
  "Your setlist" and "Review the couple" → `?tab=details`.

Guarded by
`apps/web/app/vendor-dashboard/_components/the-upcoming-row-opens-the-customer-card.test.ts`
— four tests EXECUTE the pure rule (a route built correctly and chosen by the
wrong branch is exactly this defect) and four read the source with
`stripComments`. Sabotage-proven four ways: restoring the thread-first ternary,
dropping `?tab=` from the helper, deleting the Message link, and re-baring the
Customers roster each turn it red.
`apps/web/scripts/port-control-baseline.json` regenerated — the diff is the
eight doors above, one readable line each, +1 destination.

⚠ Known blind spot, unchanged by this PR: `/vendor-dashboard/on-the-day` records
**no** client-card destination in the port baseline either before or after,
because both of its links are built in a local conditional rather than bound to
an `href` token. Same shape as the warning already written into
`customers-roster.tsx`.

SPEC IMPACT: None. No schema, no price, no locked decision — every change is a
link destination, and the sections named (`details` · `quote` · `schedule`) are
the ones `normalizeTab` and the Relationship Workspace already ship.
