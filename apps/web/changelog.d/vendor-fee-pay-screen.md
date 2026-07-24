## 2026-07-24 · feat(vendor): booking-fee pay surface + charge notification

Gives a vendor a place to SEE and PAY the 5% booking fee. Until now the fee
order (`orders.service_key` = `vendor_booking_fee__{chargeId}`, vendor as payer)
only surfaced in the admin `/admin/payments` queue — the vendor had no doorway.
Pure SURFACING layer: additive + read-mostly, it never mints or mutates a fee
(the charge path — `finalizeVendor` / `booking-fee-lock` /
`collectBookingFeeAtLock` — is untouched, parallel lane).

**Booking fees hub** — `/vendor-dashboard/booking-fees` lists the vendor's own
fee orders bucketed Due / Paid / Closed; each row deep-links to
`/vendor-dashboard/booking-fees/[orderId]`, a rebuild of the couple manual
GCash/BDO QR pay flow (reference + amount + merchant QR + 24-hr verification
copy) reachable without couple-dashboard access (the couple pay page's layout
`notFound()`s non-couple members). Doorway = a flag- + count-gated card on the
Plan hub (`/vendor-dashboard/subscription`) — shows only when
`NEXT_PUBLIC_BOOKING_FEE_ENABLED` is on AND the vendor has ≥1 unpaid fee (no fee
→ nothing shows).

**Notification on charge** — DERIVED read-side (not a create-time hook, to avoid
the parallel fee lane): a CRON-FREE `after()` sweep in the vendor layout
(`maybeSweepVendorBookingFeeNotifications`) materialises an in-app + email
notification for each unpaid fee order the vendor doesn't yet have one for.
Idempotent (keyed on the pay-page `related_url`), flag-gated (no-op when the fee
system is dark). Reuses the existing `emitNotification` pattern with the
transactional `order_quoted` type (amber, on the email allowlist) — no new
notification type, no migration.

**Safety.** RLS (`orders_owner_read` · `user_id = auth.uid()`) scopes every read
to the vendor's OWN fee orders; the detail page + log-payment action additionally
assert the `vendor_booking_fee__` key. The vendor can log a payment (proof) but
NEVER self-approve — the `payments_insert_status_guard` write-guard pins a
non-admin insert to `status='pending'`; promotion to paid stays the admin
`/admin/payments` path.

New pure helpers `lib/vendor-booking-fees.ts` (+ `.server.ts` DB/sweep half),
tested in `lib/vendor-booking-fees.test.ts` (fee-key predicate, due/settled/
closed classification, payable gate, deep-link + copy).

SPEC IMPACT: None — surfacing layer over an existing fee order + notification
system; no schema, pricing, or SKU change.
