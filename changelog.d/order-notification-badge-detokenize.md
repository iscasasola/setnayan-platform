## 2026-06-24 · fix(notifications): de-tokenize order + subscription badges ("only keep the vendor tokens")

Couple orders and vendor subscriptions were borrowing the vendor token-pack
notification types, so the notifications tray (which renders the `type` as its
badge) showed **"TOKEN PURCHASE AWAITING PAYMENT"** on a couple's PHP order
(e.g. Animated Monogram) and **"TOKENS CREDITED"** on a vendor plan activation.
The customer token wallet is retired and a subscription is not a token pack —
owner: *"no tokens … only keep the vendor tokens."*

- **Two new `notification_type` values** (migration
  `20270221018919_add_order_reconciliation_notification_type.sql`):
  `order_awaiting_reconciliation` (badge **"Awaiting reconciliation"**, amber)
  and `subscription_activated` (badge **"Plan active"**, emerald).
- **`lib/order-admin-notify.ts`** — couple apply-then-pay orders now emit
  `order_awaiting_reconciliation` (was `vendor_token_purchase_pending`).
- **`lib/subscription-purchase-notify.ts`** — admin "pending" emits
  `order_awaiting_reconciliation`; vendor "plan is active" emits
  `subscription_activated` (was `vendor_tokens_credited`). The activation body
  still mentions any **bundled vendor tokens** — those are real and stay.
- **Untouched:** `lib/token-purchase-notify.ts` (the genuine vendor token-pack
  flow keeps `vendor_token_purchase_pending` / `vendor_tokens_credited`).
- **Behavior preserved:** neither old type was in `EMAIL_ENABLED_TYPES` /
  `PUSH_ENABLED_TYPES`, and neither new type is either — these stay in-app-only,
  exactly as before. Only the badge label/tone changed. Both exhaustive
  `Record<NotificationType, …>` maps (LABEL + TONE) updated.

Migration applied in-session (additive `ALTER TYPE … ADD VALUE IF NOT EXISTS`,
no-txn, idempotent) so the new enum values exist before the code deploys.

SPEC IMPACT: None (notification copy/labels; reinforces the retired-customer-
token-wallet lock — vendor token economy unchanged).
