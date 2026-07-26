## 2026-07-26 · fix(security): SEC-4b — revoke direct orders/payments INSERT, make the server the only minter

The DB half of SEC-4. PR #3731 closed the app-layer hole (`createOrder` took its
price from the form); this closes the layer underneath it, which no application
code could reach.

**The attack.** The anon publishable key is public and PostgREST is reachable
directly, so an authenticated user could skip apps/web entirely and
`POST /rest/v1/orders` with `requested_total_php: 1` for any SKU. Every gate let
it through: `orders_owner_write` is `FOR ALL … WITH CHECK (user_id = auth.uid())`
— it authenticates the buyer and says nothing about the amount;
`orders_insert_status_guard` constrains STATUS only (and `'submitted'` is on its
allow-list); and `guard_orders_protected_columns`, which *does* protect
`requested_total_php`, is a **BEFORE UPDATE** trigger that can never fire on an
INSERT. The attacker pays ₱1 for real, `/admin/payments` reconciles ₱1 against the
order's own ₱1 asking price, approval runs `activateOrderSku`, and they own the
SKU. `public.payments` carried the identical shape.

**The fix** is a privilege fix, not a validation fix — deliberately no SQL price
re-derivation, which would be a second source of truth (the authoritative charge
spans two catalogs, a pax curve, per-event-type AI pricing and cycle
multiplication) and would trip over the overloaded `is_active` flag.

- Migration `20271008178212` — `REVOKE INSERT ON public.orders, public.payments
  FROM authenticated, anon`, plus a BEFORE INSERT deny-list caller guard
  (`guard_money_row_insert_caller`) so a stray re-GRANT becomes a loud 42501
  instead of a silent re-opening. Before/after privilege snapshot in the
  migration asserts INSERT went and nothing else moved.
- 10 session-role write sites moved to `createAdminClient()` — 8 order minters
  plus **2 payments-only sites the triage missed** (`logPayment`,
  `logBookingFeePayment`). Rollback DELETEs moved with their inserts.
- New `lib/order-mint-identity.ts` — `orderRowFor()` / `paymentRowFor()` stamp
  `user_id` / `event_id` / `vendor_profile_id` / `order_id` from server-derived
  values and make supplying them a **type error**. service_role bypasses every
  policy, so this is what replaces the `WITH CHECK (user_id = auth.uid())` the
  revoke removes.
- Two authorization gaps closed while converting: checkout pinned `event_id` to
  NULL on the eventless AI-subscription branch (it carried a caller-supplied,
  never-verified event id), and the Custom-plan action moved from the
  global-highest `resolveVendorRole` to the profile-scoped
  `resolveVendorRoleForProfile`.
- Bug fixed in passing: checkout's voucher-race rollback deleted the payments
  row with the session client, and `public.payments` has no DELETE policy for
  `authenticated` — so it silently rolled back nothing.
- Tests: `tests/db/orders-payments-insert-revoke.db.test.ts` (13, with the
  mandatory role/owner/BYPASSRLS meta-test and a neutralisation proof — 8 of 13
  fail when the fix is removed), `lib/order-mint-identity.test.ts` (9, incl. a
  compile-time assertion proven non-vacuous), and 3 new structural tests in
  `lib/order-price-authority.test.ts`.

SPEC IMPACT: None. No pricing, SKU, or product-surface change — this is an
enforcement-layer fix that makes the already-documented "the server resolves the
price" rule true at the database. Reported but NOT fixed (follow-ups): an
authenticated user can still DELETE their own paid orders (`orders_owner_write`
is FOR ALL with no restrictive DELETE counterpart — now a safe one-line revoke,
since every app-side rollback DELETE moved to service_role), and
`event_vendor_payments` / `event_vendor_payment_plan` / `vendor_reviews` share
the BEFORE-UPDATE-only guard shape that left this hole open.
