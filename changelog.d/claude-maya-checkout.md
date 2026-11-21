## 2026-11-21 · feat(pay): Maya Checkout — an automatic rail beside the BDO QR (switch off by default)

Owner, 2026-11-21 (Setnayan-specs DECISION_LOG "MAYA CHECKOUT — BUILD IT"): payments may also be taken through
Setnayan's Maya Business merchant account (cards + Maya QR). BDO QR stays the default and unchanged.

- `platform_settings.maya_checkout_enabled` (DEFAULT FALSE) — the admin switch on Admin › Settings › Payment methods.
  The rail shows only when the switch is ON **and** both Maya keys are set; with the switch ON and a key missing the
  admin page says which one. Replaces the build-time `NEXT_PUBLIC_MAYA_STATUS` gate.
- `public.maya_checkouts` (service_role only) — one row per Maya checkout; `maya_payment_id` UNIQUE so one Maya payment
  is one Setnayan payment.
- `/pay/[reference]`: one secondary "Pay with card or Maya" button under the BDO QR. The payer pays the order total
  exactly; Setnayan absorbs Maya's fee (no surcharge line).
- Automatic approval only when Maya's API, called server-side with the SECRET key, confirms PAYMENT_SUCCESS for the
  exact reference and exact PHP amount. Webhook bodies are never trusted on their own. Any mismatch → the admin queue
  with the reason. Approval runs through `approvePaymentCore` with a gateway (system) actor.
- `app/api/webhooks/maya/route.ts` — receives Maya events, re-verifies, approves or queues; always 200.
- Admin › Integrations › Maya: "Register webhooks", sandbox vs production label. Admin › Payments: "Paid via Maya" tag.
- No Maya refund API in V1 — the existing admin refund records it; the owner refunds in the Maya dashboard.
- A webhook saying PAID is always re-verified, even for a checkout already closed by the clock — a late bank clearing is settled, never dropped.
- Back from Maya with nothing paid → "Payment not finished. Nothing has been charged." (only on `?maya=success` with no payment at Maya).
- Sandbox keys approve only when the payer AND the order's owner are internal; an owner we cannot read queues the payment.

SPEC IMPACT: None beyond the 2026-11-21 DECISION_LOG row already in the corpus (commit 85d26be7).
