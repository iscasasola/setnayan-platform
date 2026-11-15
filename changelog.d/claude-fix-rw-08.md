## 2026-11-13 · fix(suppliers): a claimed per-guest booking shows the supplier the couple's figure and count (RW-08)

Re-walk RW-08: a couple adds their own supplier priced per guest; after the shop claims it, the couple's card follows
the guest list (₱4,000 at 4 · ₱5,000 at 5) — but the supplier read "no quote yet" on the Clients row and "Est. pax 150"
(the event's estimate) on the client card. One read, `readShopPerGuest` (`lib/claimed-per-guest-shop.server.ts`) — this
shop's own claimed `per_pax` bookings, the total now (`total_cost_php`, moved by `quote_follow_claimed_per_guest`) and
the guests it bills (`event_vendor_guest_follow`, else the guests agreed):
- the Clients row says "₱4,000 · 4 guests" instead of "no quote yet";
- the client card says "Guests counted 4" and "Total · priced per guest ₱4,000" instead of "Est. pax 150".
A refused read draws as shipped, never a guessed figure.

SPEC IMPACT: None.

- CI follow-up: the reader prints the agreed total NOW (headline + change lines, `agreedTotalNow` over
  `CHANGE_LINES_EMBED`), and is registered as a service-role reader of the booking amounts on both guards
  (`SERVICE_ROLE_READS`, `PROVEN_BY_HAND`) and on the total-now roster.
