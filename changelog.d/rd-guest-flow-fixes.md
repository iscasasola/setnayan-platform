## 2026-10-02 · fix(guest-flow): an invited guest reaching a host address lands on the Event Hub; the account keeps the reply's mobile

Pre-flight for the owner's live guest test (owner: *"when invited guests see the event on their account and opens it. it does not go to the dashboard but instead it goes to the event hub"* · *"make sure all data will be complete even how guests create their account"*).

- **Event layout (`app/dashboard/[eventId]/layout.tsx`)** — a signed-in GUEST member who reaches `/dashboard/{id}` by any route other than their board card (bookmark, notification, typed URL) is redirected to the Event Hub through the same resolver the card uses (`eventBoardHref`), reading the address from the board's own invited-events read (`fetchUserEvents(…, 'guest')`) — never the event row — instead of meeting "not found". Hosts and co-hosts are admitted exactly as before; a non-member is still refused before any event read.
- **Account from an invitation (`lib/seat-details-carry.ts`, `lib/link-guest-account.ts`)** — `carrySeatDetailsToAccount` fills the new account's blank `users.phone` from the mobile the guest typed on the reply (the 2026-09-30 "PROFILE ALREADY FILLED" ruling lists mobile), and carries meal + dietary on BOTH on-purpose doors — previously only the same-browser cookie door carried meal/dietary and neither carried the mobile. Blank-only, one update per field, never throws.
- Guard: `lib/a-guest-card-opens-the-event-hub.test.ts` (guest card → `/{slug}`, host/helper → dashboard, host-and-guest → host, layout redirect order, reply fields read+written, carry executed against a fake client). Sabotaged twice (redirect removed; phone write renamed) → RED; restored → GREEN.

SPEC IMPACT: None
