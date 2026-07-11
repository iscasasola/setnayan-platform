## 2026-07-12 · feat(payments): PayMongo one-time gateway — Phase 0 (seam + fulfillment refactor) + Phase 1 (Checkout Sessions)

Wire the automated PayMongo one-time payment rail behind the existing manual
apply-then-pay flow. DORMANT until BOTH the keys AND the build-time flag
`NEXT_PUBLIC_PAYMONGO_STATUS=APPROVED` are set — nothing is live in this PR.
Opened as a DRAFT (owner review · live-money code); auto-merge deliberately NOT
enabled.

**Phase 0 — provider seam + fulfillment refactor**

- `resolvePayMongoConfig()` + `resolvePayMongoWebhookSecrets()`
  (`lib/integration-config.ts`): DB-first / env-fallback, mirroring
  `resolveMayaConfig`. Single API SECRET key (HTTP Basic `base64("<key>:")`, no
  public pair) + separate test/live webhook signing secrets + REST base URL
  (default `https://api.paymongo.com`).
- New encrypted columns via `supabase/migrations/20270728000000_integration_paymongo_payments.sql`
  (`paymongo_secret_key_enc`, `paymongo_webhook_secret_test_enc`,
  `paymongo_webhook_secret_live_enc` on `platform_integration_secrets`;
  `paymongo_api_endpoint` on `platform_settings`). NOT pushed — owner applies.
- `PAYMONGO_INTEGRATION` registry const (+ 3 secret columns added to
  `ALL_SECRET_COLUMNS`), a `PayMongoCard` admin component, and
  `savePayMongoConfig` / `clearPayMongoSecrets` actions — mirroring the Maya card.
- Build-time status gate `NEXT_PUBLIC_PAYMONGO_STATUS` (default OFF), mirroring
  `NEXT_PUBLIC_MAYA_STATUS`.
- **Fulfillment refactor:** extracted `finalizePaidOrder()` into
  `lib/finalize-paid-order.ts` (order→paid · order_paid notification · referral
  qualify · analytics · app receipt · vendor payouts · `activateOrderSku`) —
  lifted VERBATIM from `approvePayment`'s promote block (the two helpers
  `issueReceiptForOrder` + `schedulePayoutsForOrder` moved with it, code-line
  identical). The manual admin-approve path now CALLS this same helper, so manual
  and webhook fulfillment are byte-identical. Pure refactor — behavior preserved.
- Built the real `/checkout/return`, `/checkout/cancel`, `/checkout/failure`
  routes (the retired Maya lane's dangling redirect targets). `return` is
  webhook-truth-aware (never marks anything paid).

**Phase 1 — Checkout Sessions**

- `createPayMongoCheckout(orderId)` (`lib/paymongo.ts`): POST
  `/v1/checkout_sessions` with one line item (SKU title, order gross in centavos,
  PHP, qty 1), `reference_number` = the order's `reference_code`,
  `payment_method_types` = card · gcash · paymaya · grab_pay · qrph, success/cancel
  URLs; returns `checkout_url`.
- `app/api/webhooks/paymongo/route.ts`: clones the token-purchase webhook's
  fail-closed 503 / after() notify / 200-401-500 retry discipline, but REWRITES
  the signature verify to PayMongo's scheme — `Paymongo-Signature: t=…,te=…,li=…`,
  HMAC-SHA256 over `"<t>.<rawBody>"` with the webhook signing secret, timing-safe
  compared against `te` (test) or `li` (live). On `checkout_session.payment.paid`
  it branches by reference prefix: couple orders (`SN…`) → `finalizePaidOrder`;
  vendor token packs (`TKN…`) → the existing
  `confirm_vendor_token_purchase_by_reference` RPC. Idempotent; NEVER trusts the
  browser return_url as proof of payment.
- Checkout UI: the inline drawer routes through `createPayMongoCheckout` (via
  `submitOrderAction` `payment_mode='paymongo'`, no screenshot) when
  `NEXT_PUBLIC_PAYMONGO_STATUS='APPROVED'`, KEEPING the manual GCash/BDO path as
  the fallback branch.

**Review fixes (draft PR #3146)**

- **M1 (correctness):** wrapped `issueReceiptForOrder()` in `finalizePaidOrder`
  in a best-effort try/catch (log, don't rethrow), mirroring the adjacent
  `schedulePayoutsForOrder` guard. Previously an ungrated receipt-insert failure
  AFTER the order was already flipped to `paid` would throw → webhook 500 →
  PayMongo retry short-circuits at the route's `status==='paid'` idempotency
  guard → `schedulePayoutsForOrder` + `activateOrderSku` never ran (customer
  charged, order paid, capability never granted). The receipt is idempotent and
  back-fillable; SKU activation now always runs.
- **L3 (analytics parity):** the webhook now threads the order's pending-payment
  `amount_php` (VAT-inclusive gross) into `finalizePaidOrder` as `amountPhp`, so
  the `order_paid` PostHog event records the real figure instead of `null` —
  matching how the manual admin lane threads the matched payment's `amount_php`.
- **L2 (replay defense-in-depth):** `verifyPayMongoSignature` now rejects a
  delivery whose signed `t` (unix seconds) is more than 300s from now (either
  direction), so a captured valid delivery can't be replayed indefinitely. HMAC
  scheme unchanged.

Not in scope (deferred): Phase 2 recurring / Subscriptions. No paywall/status
flag enabled. Maya lane (dead, no live callers) left intact.

SPEC IMPACT: New automated one-time payment gateway (PayMongo) added alongside the
manual apply-then-pay rails; supersedes the dead Maya "Branch B" seam as the
intended automation path. Fulfillment is now a single shared helper
(`finalizePaidOrder`) used by both admin manual-approve and the gateway webhook.
Belongs in the corpus DECISION_LOG (2026-07-12 · "PayMongo one-time gateway
design" — one-time Checkout Sessions first, Subscriptions deferred; 0% commission
unchanged; still webhook-authoritative apply-then-pay). Owner to add the
DECISION_LOG row on sign-off (surfaced here — live-money design).
