## 2026-07-25 · feat(vendor-pricing): free-tier concurrent-booking cap logic (inert foundation, flag-dark)

Phase-3 foundation of the LOCKED 2026-07-25 vendor monetization model
(`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § "Free-tier mechanics"). A
FREE vendor (`free`/`verified`) may hold at most 3 concurrent active bookings; at
the cap they surface as "Fully booked" and can't be newly Locked until a booking
completes or they subscribe (Solo+ = unlimited). Inbox/chat are never gated by
this — only the couple's Lock action.

Lands only the **pure cap logic** so the lock-path wiring PR has one tested place
to read from:

- `lib/vendor-free-tier-booking-cap.ts` — `FREE_TIER_ACTIVE_BOOKING_CAP` (3) +
  `freeTierBookingCapApplies()` (free tiers only, reuses `isTierAtLeast`) +
  `freeTierRemainingBookingSlots()` + `isAtFreeTierBookingCap()`. PURE.
- `lib/vendor-free-tier-booking-cap-flag.ts` — `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP`
  (default OFF); switches the live lock path onto the cap.
- `lib/vendor-free-tier-booking-cap.test.ts` — 9 cases (applies/remaining/atCap
  across tiers, clamp-to-0, non-finite/negative count fail-safe, cap constant).

INERT: no lock path reads this yet, so booking behaves exactly as today. Wiring
into the couple's Lock/Book action (with the "Fully booked" state + upsell) lands
in a follow-up PR — and coordinates with the payment session, which owns the lock
path (`finalizeVendor` / `chat-lock-booking`).

SPEC IMPACT: None (implements the already-locked model + DECISION_LOG 2026-07-25).
