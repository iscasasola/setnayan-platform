# Final check · Area 6 · Supplier: bookings, chat, payments, calendar

Checker 6 of 8. Checked commit: `fb3f72d` (the pinned check commit). Report only.
Phase A = code pass (`SOURCE: CODE`). Phase B = browser walk on staging (later).

## BLOCKERS

None so far.

## Progress

Pages (22):

- [ ] /vendor-dashboard/booking-fees
- [ ] /vendor-dashboard/booking-fees/[orderId]
- [ ] /vendor-dashboard/calendar/[date]
- [ ] /vendor-dashboard/clients/[eventId]
- [ ] /vendor-dashboard/clients/[eventId]/challenge-photos
- [ ] /vendor-dashboard/clients/[eventId]/cocktail
- [ ] /vendor-dashboard/clients/[eventId]/editorial-media
- [ ] /vendor-dashboard/clients/[eventId]/mood-board
- [ ] /vendor-dashboard/clients/[eventId]/production-sheet
- [ ] /vendor-dashboard/clients/[eventId]/their-event/[part]
- [ ] /vendor-dashboard/contracts/[contractId]
- [ ] /vendor-dashboard/contracts/new
- [ ] /vendor-dashboard/customers
- [ ] /vendor-dashboard/disputes
- [ ] /vendor-dashboard/manpower
- [ ] /vendor-dashboard/messages
- [ ] /vendor-dashboard/messages/[threadId]
- [ ] /vendor-dashboard/notifications
- [ ] /vendor-dashboard/on-the-day
- [ ] /vendor-dashboard/on-the-day/live/[eventId]
- [ ] /vendor-dashboard/on-the-day/live/[eventId]/papic
- [ ] /vendor/lock/[token]

Forwards (12), checked in code. Each `redirect()` target exists and the anchor is drawn by the target:

- [x] /vendor-dashboard/bookings → /vendor-dashboard/customers?tab=bookings&seg=money#bookings (`id="bookings"` drawn when seg=money) — lands
- [x] /vendor-dashboard/calendar → /vendor-dashboard/customers?tab=calendar#calendar (bare) / keeps params — lands (`id="calendar"` in customers-pin.tsx)
- [x] /vendor-dashboard/clients → /vendor-dashboard/customers?tab=clients — lands (Events)
- [x] /vendor-dashboard/contracts → /vendor-dashboard/customers?tab=contracts#customer-tools — lands
- [x] /vendor-dashboard/demand → /vendor-dashboard/shop#analytics — lands (`id="analytics"` in the carousel)
- [x] /vendor-dashboard/earnings → /vendor-dashboard/customers?tab=…#payday — lands
- [x] /vendor-dashboard/events → /vendor-dashboard/on-the-day — lands
- [x] /vendor-dashboard/locked-qr → /vendor-dashboard/invite?mode=locked&ledger=1#issued — lands (`id="issued"` in qr-codes.tsx)
- [x] /vendor-dashboard/payday → /vendor-dashboard/customers?tab=…#payday — lands
- [x] /vendor-dashboard/payment-options → /vendor-dashboard/profile#pay — lands (Fold `anchor="pay"`)
- [x] /vendor-dashboard/proposals → /vendor-dashboard/customers?tab=…#customer-tools — lands
- [x] /vendor-dashboard/recaps → /vendor-dashboard/shop/promote#share — lands (`<section id="share">`)
