## 2026-09-11 · fix(hosts): no coordinator email a couple can see is a shop's own account email

N2 item 1 (post-merge review of #5404). The couple's Hosts page "Promote your
coordinator" row printed the booked coordinator's `event_vendors.contact_email`
in plain text and in a hidden form field, gated only on category + booked
status. For a genuinely off-platform coordinator that column is their real
business contact, worth showing. For a marketplace-linked (Setnayan) shop
booked as a coordinator, the SAME column holds the shop's own account email —
copied in by the package-lock path
(`app/dashboard/[eventId]/vendors/packages/actions.ts`) — which a couple was
never meant to see printed on their own page.

`app/dashboard/[eventId]/hosts/page.tsx` now splits the booked-coordinator
list with `isOffPlatformSupplier` (`lib/supplier-invite-eligibility.ts`, the
same predicate #5404 used elsewhere): an off-platform coordinator keeps the
existing email-based "Invite as delegate" row; a Setnayan coordinator instead
gets a "Message them" link into their existing chat thread for the event — no
email printed, no email used. `autoInviteCoordinator` already auto-creates
that coordinator's delegate invite the moment their downpayment is marked
(unless the data-privacy consent gate is active), so the in-app thread is the
couple's way to reach them in the meantime.

Investigated the package-lock's contact_email copy itself
(`vendors/packages/actions.ts` ~495) per the session brief's "stop copying if
nothing legitimate reads it" — `lib/coordinator-broadcasts.ts` reads
`event_vendors.contact_email` to send the platform's own night-before-style
broadcast to a booked vendor's address, a legitimate email channel unrelated
to what a couple can see, so the copy itself is left in place. Only what the
couple's OWN page prints/uses is changed.

`lib/no-door-out-of-the-app.test.ts`'s `CONTACT_TEXT_BILL` entry for
`app/dashboard/[eventId]/hosts/page.tsx` is updated to gate on both the
booked-status query AND the new off-platform filter feeding the print site —
mutation-checked (reverting either the filter or its use in the render source
turns the guard RED).

SPEC IMPACT: None.
