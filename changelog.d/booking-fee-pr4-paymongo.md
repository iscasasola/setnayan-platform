## 2026-07-23 · feat(vendor): Booking Fee PR-4a — PayMongo integration core (dormant)

The payment-rail core for the Booking Fee (`Booking_Fee_Build_Plan §PR-4`; owner
chose PayMongo 2026-07-23). Ships **dormant** — every path is inert until the owner
sets the PayMongo keys/secret.

- **`lib/paymongo-webhook.ts`** — `verifyPaymongoSignature` (the SDK-authoritative
  scheme: HMAC-SHA256 of `${timestamp}.${rawBody}`, keyed with the `whsk_` webhook
  secret, `t=/te=/li=` header, live-wins-over-test, timing-safe) + `parsePaymongoEvent`.
  ⚠ The public docs describe the wrong scheme (body-only HMAC); a test pins the
  correct one so webhooks don't silently fail.
- **`lib/paymongo.ts`** — `createBookingFeeCheckout` (v2 Checkout Session, Basic
  auth, centavos, `metadata.charge_id` reconciliation key) + `isPaymongoConfigured`.
  Returns null / no-ops until `PAYMONGO_SECRET_KEY` is set.
- **`app/api/webhooks/paymongo/route.ts`** — 503 until `PAYMONGO_WEBHOOK_SECRET`;
  verifies the raw body, then on `checkout_session.payment.paid` settles the mapped
  charge via `booking_fee_settle_charge` (synchronous + idempotent → genuine errors
  500 for PayMongo's retry, already-paid re-deliveries report success).
- **`lib/paymongo-webhook.test.ts`** — 8 tests (valid test/live sig, the docs-bug
  rejection, tamper, wrong secret, fail-closed, event parsing).
- **`.env.example`** — documents the two booking-fee flags, the rail-live flag, and
  the two PayMongo secrets.

⚠ Still owner-BLOCKING for collection: PayMongo account + KYC + API keys + register
the webhook (copy its `whsk_` secret). And the vendor-facing checkout UI (start
checkout from the `fee_unpaid` gate, with the inclusive per-method split) is the
next slice (PR-4b). `tsc` clean.

SPEC IMPACT: None new (implements §PR-4 rail = PayMongo). DECISION_LOG 2026-07-23.
