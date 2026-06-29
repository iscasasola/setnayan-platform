## 2026-06-30 · feat(vendor): notify the couple when a vendor suggests a service (Phase 3b delivery polish)

Closes the delivery gap in Phase 3b: a vendor's Studio-hub suggestion previously
went unseen until the couple happened to visit the hub. Now `suggestToCouple()`
pings the couple.

- New notification type `vendor_feature_suggested` (migration
  `20270327434080_…` — `ALTER TYPE notification_type ADD VALUE`), registered in
  the `NotificationType` union + label + tone records.
- `suggestToCouple()` emits to each couple member ONLY on a fresh suggestion
  (never the idempotent re-submit), deep-linking to `/dashboard/[eventId]/studio`.
  Recipient lookup uses the admin client (the vendor can't read the couple's
  `event_members` under RLS); the INSERT already cleared the accepted-thread gate.
  Best-effort — `emitNotification` fails soft.
- Added to the email allowlist (`EMAIL_ENABLED_TYPES`) so it reaches a couple
  who isn't currently in the app — a 1:1 paid-service nudge is high-signal +
  actionable (unlike the in-app-only `mood_board_share`). One line to dial back
  to in-app-only if the owner prefers.

Verified: typecheck, next lint, prod build, navicon + entitlement-gate + botnav
lints all green.

SPEC IMPACT: None — additive notification on an existing flow; no schema/pricing
/SKU/product-lock change beyond the enum value.
