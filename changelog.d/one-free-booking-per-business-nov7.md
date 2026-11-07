## 2026-11-07 · feat(booking-fee): [migration] one free first booking per BUSINESS, not per account (D2)

Owner, 2026-11-06 (DECISION_LOG "🛡 ONE FREE FIRST BOOKING PER BUSINESS, NOT PER ACCOUNT — THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION DESK"): a business that opens a second account no longer gets a second free first booking.

- **Migration `20271319712279_one_free_first_booking_per_business`.** `booking_fee_business_matches(uuid[])` finds the other shops of the same business: same registration/permit number (`registration_number_raw`, normalized like `normalizeRegistrationNumber`), same phone (`contact_phone`, +63/0 stripped) or same payout account (`vendor_payment_methods.account_number`, bank/e-wallet rows not removed). Demo shops never match. `booking_fee_business_free_standing(uuid)` answers `available` / `used_by_business` / `unreadable`, and any error inside it is caught as `unreadable`.
- **The charge (`booking_fee_open_lock_charge`).** A booking inside the shop's own free place is free ONLY if the standing is `available`. Otherwise it is billed the normal fee and the reason is frozen on the new `booking_fee_ledger.free_booking_withheld_reason` (`business_already_used` · `business_check_unreadable`). The advisory lock now covers every shop of the business in uuid order, so two matched shops cannot both take the free place at once. Frozen places are never re-derived.
- **The quote (`setnayan_gift_quote_applies`)** asks the same standing before it promises `free_booking`.
- **The supplier's forecast (`resolveBookingFeeStanding`)** asks the same RPC. A refused read shows "we could not work out your booking fee". A business that already used its free booking is shown a billable line saying so, without naming the other shop.
- **The verification desk (`/admin/verify`)** shows a read-only "Same business as another shop" note with links to each matching shop, what matched, and who used the free booking. A refused read says it could not check. The proof lab is `/dev/verify-desk-lab`.
- `decideLockFee` (the pure TS mirror) now REQUIRES `businessFree`, and only `available` counts as free.
- Exposure baseline: +1 line for the new ledger column (same grants as its sibling columns; RLS on the table is SELECT-only). Ugat: the lab is added to `no-door.baseline.txt`, and `screens.generated.json` is regenerated.

Tests: `tests/db/one-free-first-booking-per-business.db.test.ts` (9) and `lib/one-free-booking-per-business.test.ts` (5), each sabotage-checked.

SPEC IMPACT: None to the corpus. The ruling is already recorded in DECISION_LOG 2026-11-06. The readings made while building it (direct matches only, demo excluded, fail closed = billed) are listed in the PR for the owner.
