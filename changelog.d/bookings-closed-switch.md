## 2026-11-02 · feat(bookings): bookings are closed at launch — one switch, eight doors, no fee

Owner 2026-11-02 (supplier gate): *"for now, they cannot add bookings. just create their websites and cater our event if they are part of the event"*. Supplier gate audit G1/G2.

- **One DB switch** `platform_settings.bookings_open` (migration `20271302310560_bookings_closed_switch.sql`): NULL = closed (launch default), FALSE = closed, TRUE = open (today's behaviour). `public.bookings_are_open()`; app read `areBookingsOpen()` (`lib/bookings-open.server.ts`, remembered, fail-closed).
- **Backstop trigger** `event_vendors_require_bookings_open` — same scope and grandfathering as the verified trigger: a marketplace row moving INTO a booked status raises `bookings_closed`. Hand-added rows and a claim approval's link onto an already-booked row still pass (the founders' event).
- **All eight doors ask first**: lock a package, lock a service, the wizard, chat Book, reuse a booking, the supplier's yes, a Locked QR (issue and claim), and the fee (`mintBookingFeeForBooking` + the catch-up sweep make nothing while closed). Each says "Bookings open soon" / a supplier sentence instead of a generic error.
- **Packages still show** on `/v/[slug]` with prices and inclusions; the Book button gives way to a quiet "Bookings open soon". The Locked QR deal form gives way to one line.
- **Admin flips it** on `/admin/booking-fees` (audited, clears the platform_settings tag).
- Test replay opens bookings by default (`createReplayedDb`, opt-out `{ bookingsAsMigrated: true }`) so the ~90 booking db tests keep testing booking; the switch itself is proven as migrated.
- Guards: `lib/bookings-closed-doors.test.ts` (each door's own function asks before it books), `tests/db/bookings-closed-switch.db.test.ts`.

SPEC IMPACT: None in this PR's code beyond the owner ruling it implements. Not in this PR: "a shop can publish without being verified while bookings are closed" (needs an RLS change to `vendor_profiles_public_read`; its own PR).
