## 2026-11-16 · feat(shops): an unverified shop is found only once verified, and is booked on its own page

Owner rulings, 15 Nov (DECISION_LOG 2026-11-15 "🌐 AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE"):
**"Verified only"** for Discover and Suppliers › Find, and **"We allow booking. Since they can get bookings on
their website"**. Together they supersede the 2026-11-07 "findable until its first inquiry" rule.

- Migration `20271348170528`: `vendor_profiles.is_findable` is redefined (`ALTER COLUMN … SET EXPRESSION`) as
  verified AND listed only. `enforce_booking_requires_verified_vendor` now lets a booking through for an
  undecided (`unverified` · `pending_review`) shop that is not archived. Rejected, demoted and archived shops are
  still refused. The migration writes no data.
- One gate, in two languages: the column, plus its TypeScript twin `isShopFindable` (now `isShopLive` plus papers).
  `shopBookingRefusal` mirrors the trigger.
- The shop page's Check-a-date door opens for an undecided shop.
- The ⓘ drops "booking opens once Setnayan verifies them" and says the booking fee applies as usual.
- The first-inquiry lock still stamps but decides nothing. Removed:
  - the admin "Lift the lock" action (`liftFindLock`)
  - the "Out of Find" tab
  - the supplier's "get verified to be found again" notice
- Tests renamed to the new rule:
  - `lib/an-unverified-shop-is-messaged-and-booked-on-its-page.test.ts`
  - `tests/db/an-unverified-shop-is-booked-on-its-page-and-found-only-once-verified.db.test.ts`

SPEC IMPACT: None new. The ruling is already logged as DECISION_LOG 2026-11-15 "🔎✅ UNVERIFIED SHOPS: NOT IN
DISCOVER/FIND; BOOKABLE NOW" (specs commit 7a621ca0), which this change implements.
