## 2026-07-24 · fix(privacy): hide vendor booking-fee orders from the couple's view

A couple / co-host could see the VENDOR's booking-fee order. The vendor-payer fee
order (`lib/booking-fee-lock.server.collectBookingFeeAtLock`) is stamped with the
couple's `event_id` so the vendor's own pay screen can scope it — `user_id` = the
vendor's account, `service_key` = `vendor_booking_fee__{chargeId}`. The co-host
read policy (`orders_owner_read`, from `20270129279924_orders_cohost_read.sql`)
admits ANY order carrying the event's id, so the couple's event-order reads
(`lib/orders.fetchOrdersForEvent`, the budget page's paid/fulfilled sum, the event
dashboard Services card) surfaced it — the couple could see the fee amount,
reference code and status. A couple must never see what their vendor is charged.

Closed at BOTH layers (defense in depth), vendor + admin access intact:

- **RLS (the real guard):** `20270930100000_orders_cohost_exclude_vendor_payer.sql`
  tightens the co-host branch so it only admits orders whose PAYER is themselves
  an `event_members` row of that event (new SECURITY DEFINER helper
  `public.is_event_member(event_id, user_id)`). Couple purchasers + co-hosts are
  members → their shared-planning orders stay fully visible; the vendor is not a
  member → the vendor-payer fee order is excluded from every event-scoped read at
  the row level. Non-brittle (keyed on membership, not on parsing the
  service_key). The VENDOR still reads their own fee order via
  `user_id = auth.uid()`; admins still see everything via `public.is_admin()`; the
  WRITE policy is untouched. The fee-charge lane
  (`finalizeVendor` / `collectBookingFeeAtLock`, written with the RLS-bypassing
  service-role client) is untouched.

- **App-side belt:** `lib/orders.COUPLE_ORDERS_HIDE_VENDOR_FILTER` — a null-safe
  PostgREST `.or()` predicate (`service_key IS NULL OR service_key NOT LIKE
  'vendor_%'`) applied to `fetchOrdersForEvent`, the budget page's paid/fulfilled
  orders read, and the event dashboard's paid/fulfilled orders read. Drops every
  vendor-billing order (none belong in a couple's event-order list) while keeping
  legacy NULL-service_key ad-hoc orders (a bare `.not(...like...)` would silently
  drop NULLs).

Tests: `tests/db/orders-hide-vendor-fee.db.test.ts` — replayed-migration RLS
verification (couple/co-host don't see the fee order incl. adversarial
direct-by-order_id and by-reference_code; couple still sees own + co-host + ad-hoc
orders; vendor still reads own fee order; admin sees all; stranger sees none) plus
the app-side belt predicate proven RLS-off.

SPEC IMPACT: None (privacy fix — vendor fee orders are no longer visible to the couple; no product-surface or pricing change).
