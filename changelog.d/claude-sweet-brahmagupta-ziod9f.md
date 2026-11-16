## 2026-11-16 · feat(shop-status): a shop can be paused or closed — by its team and by Setnayan (schema + server; no screen yet)

Owner rulings: 2026-10-31 "SHOP STATUS RULED" (*"They can pause and close. Admin can also do that"*) and 2026-11-16
"AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW".

- **Migration `20271350091032_a_shop_can_be_paused_or_closed`** — `vendor_profiles.paused_at` + `paused_by`
  ('supplier' | 'admin'), column grants to `authenticated` only (anon revoked); `guard_vendor_shop_pause` refuses a
  session's direct write; `is_findable` gains `AND paused_at IS NULL` (in place); the booking trigger gains a `paused`
  refusal for NEW asks and bookings (existing ones untouched); ONE definer door `set_shop_status(shop, open|paused|closed)`
  — Setnayan does all three; the owner or a team admin pauses and lifts their own pause; only Setnayan lifts Setnayan's
  pause; only the OWNER closes, and only with no open booking. Close = the existing `public_visibility = 'archived'`.
  `vendor_profiles_self` re-projected.
- **App** — `shopBookingRefusal` gains `'paused'` (and `SHOP_BOOKABLE_COLUMNS` reads `paused_at`), so every booking door
  and the Locked QR (a client import) refuse a paused shop; `isShopFindable` and `shopTakesMessages` read the pause; the
  shop page selects `paused_at`, so a paused shop's page shows no Book / Lock / Inquire. New `lib/shop-status.ts`
  (reader + refusal parser) and ONE dispatcher action `setShopStatus` (admin act → audit row + in-app notice).
- **Not built (waits on an owner-approved Fable drawing):** Shop ⚙ › Shop status row, the "This shop is paused" page
  line, the admin console button.

SPEC IMPACT: None in this PR — the corpus DECISION_LOG rows of 31 Oct and 16 Nov already record the rulings; an AS BUILT
row is due when the screen ships.
