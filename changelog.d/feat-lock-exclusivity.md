## 2026-07-11 · feat(vendors): exclusivity on lock — displace + hide losing inquiries (flag-gated)

Extends the payment-gated lock: when a couple locks a **hard-single** pick (one
venue / officiant / coordinator / host / LED at a time), the OTHER marketplace
vendors they were inquiring in the same group are out of the running. Their open
inquiry threads move to `chat_inquiry_status = 'displaced'` (the provisioned
"slot filled by another booking · REVIVABLE" state) and each released vendor is
notified. Gated behind `NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (same flag) —
ships dormant until the owner flips it.

- `finalizeVendor` gains an exclusivity block after the existing archive-others
  cleanup: couple-RLS displace of the losing threads (the couple owns their side;
  the only `inquiry_status` trigger fires solely on →`accepted`, so the write is
  unblocked) + a fail-soft cross-party notify (admin lookup of each vendor's user,
  same pattern as `booking_confirmed`). Hard-single groups only.
- Both inbox lists (couple `dashboard/[eventId]/messages`, vendor
  `vendor-dashboard/messages`) fold `displaced` threads out of the active list into
  the Archived/closed section with a "released" badge — hidden on **both** sides.
- New notification type `inquiry_displaced` (migration
  `20270521628193`, TS `NotificationType` + both label/tone maps).
- `ChatInquiryStatus` TS type widened to match the DB enum (`displaced` /
  `withdrawn` / `expired`).

SPEC IMPACT: Adds lock exclusivity (notify + hide losing inquiries both sides) to
the payment-gated lock, using the provisioned `displaced` inquiry state. Gated by
`NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (OFF in prod). Logged in DECISION_LOG.md
2026-07-11.
