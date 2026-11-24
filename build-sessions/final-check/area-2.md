# Final check · Area 2 · Couple: create an event and plan it

> Checker 2 of 8. Report only, no fixes. Main frozen at `fb3f72d`. Phase A = code pass (`SOURCE: CODE`);
> phase B = browser walk on staging (`SOURCE: SEEN`), not started (no staging address yet).
> Page list from `pnpm exec tsx scripts/staging/areas.ts --area 2` (67 pages + 6 forwards, same as kit § 4),
> plus `/signup/you`, which the task names for this area although `areas.ts` files it under Area 1.
> Marks on each line: **OFFLINE** (NEEDED + where signal is lost / READ-ONLY IS ENOUGH / NOT NEEDED) and
> **SHAPE** (TODAY → SHOULD; `=` when they agree).

## Progress

### Create an event
- [ ] /onboarding/[type]
- [ ] /onboarding/simple
- [ ] /onboarding/wedding
- [ ] /dashboard/create-event
- [ ] /signup/you
- [ ] /host/accept/[token]

### Home and the event
- [ ] /dashboard
- [ ] /dashboard/[eventId]
- [ ] /dashboard/[eventId]/activity
- [ ] /dashboard/year → /dashboard?seg=events#worth-planning
- [ ] /dashboard/[eventId]/more → /dashboard/[…]
- [ ] /dashboard/[eventId]/progress → /dashboard/[…][…]

### Account
- [ ] /dashboard/notifications
- [ ] /dashboard/search
- [ ] /dashboard/billing
- [ ] /dashboard/api-keys
- [ ] /dashboard/profile
- [ ] /dashboard/profile/concierge
- [ ] /dashboard/people
- [ ] /dashboard/people/[dependentId]
- [ ] /dashboard/clusters
- [ ] /dashboard/clusters/[clusterId]
- [ ] /dashboard/samahan → /dashboard?seg=people&view=samahan[…]
- [ ] /dashboard/samahan/[communityId]
- [ ] /dashboard/samahan/new

### Guests and seats
- [ ] /dashboard/[eventId]/guests
- [ ] /dashboard/[eventId]/guests/[guestId]
- [ ] /dashboard/[eventId]/guests/new
- [ ] /dashboard/[eventId]/guests/quick
- [ ] /dashboard/[eventId]/guests/import
- [ ] /dashboard/[eventId]/guests/claims
- [ ] /dashboard/[eventId]/guests/checkin
- [ ] /dashboard/[eventId]/guests/souvenirs
- [ ] /dashboard/[eventId]/guests/tea-ceremony
- [ ] /dashboard/[eventId]/seating
- [ ] /dashboard/[eventId]/seating/chart
- [ ] /dashboard/[eventId]/seating/lab
- [ ] /dashboard/[eventId]/seating/walkthrough
- [ ] /dashboard/[eventId]/access-requests
- [ ] /dashboard/[eventId]/people
- [ ] /dashboard/[eventId]/hosts

### Money
- [ ] /dashboard/[eventId]/budget
- [ ] /dashboard/[eventId]/orders
- [ ] /dashboard/[eventId]/orders/[orderId]
- [ ] /dashboard/[eventId]/orders/new
- [ ] /pay/[reference]
- [ ] /receipts/[receiptId]
- [ ] /receipts/order/[orderId]
- [ ] /receipts/payment/[paymentId]
- [ ] /dashboard/[eventId]/refer
- [ ] /proposals/[publicId]

### Suppliers
- [ ] /dashboard/[eventId]/vendors
- [ ] /dashboard/[eventId]/vendors/[vendorId] → /dashboard/[…]/vendors/[…]/workspace
- [ ] /dashboard/[eventId]/vendors/categories
- [ ] /dashboard/[eventId]/vendors/packages/[bookingId]
- [ ] /dashboard/[eventId]/vendors/[vendorId]/review
- [ ] /dashboard/[eventId]/contracts
- [ ] /dashboard/[eventId]/contracts/[contractId]
- [ ] /dashboard/[eventId]/disputes
- [ ] /dashboard/[eventId]/clearance
- [ ] /dashboard/[eventId]/messages
- [ ] /dashboard/[eventId]/messages/[threadId]
- [ ] /dashboard/[eventId]/manpower

### Plan the day
- [ ] /dashboard/[eventId]/details
- [ ] /dashboard/[eventId]/details/field/[row]
- [ ] /dashboard/[eventId]/details/change → /dashboard/[…]/details/field/area
- [ ] /dashboard/[eventId]/date-selection
- [ ] /dashboard/[eventId]/find-date
- [ ] /dashboard/[eventId]/checklist
- [ ] /dashboard/[eventId]/schedule
- [ ] /dashboard/[eventId]/documents
- [ ] /dashboard/[eventId]/paperwork
- [ ] /dashboard/[eventId]/sponsors
- [ ] /dashboard/[eventId]/nikah

## BLOCKERS

None found in the code pass so far.

## Findings
