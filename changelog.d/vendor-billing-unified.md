## 2026-07-01 · feat(vendor-dashboard): unified Plan & tokens hub with combined-order checkout

`/vendor-dashboard/subscription` is now the single "Plan & tokens" hub — plan
cards, an optional "add tokens to this order" selector, and the full token
wallet in one place. A plan order can fold in a token pack so the vendor makes
**one payment** (one `SUB-` reference, one admin approval) that activates the
tier AND credits the tokens. `/vendor-dashboard/tokens` now redirects to the
hub; the sidebar footer chips relabel to "Plan & tokens".

- Migration `20270425213000` adds add-on columns to `vendor_subscriptions`,
  extends `create_vendor_subscription` with an optional `p_addon_token_pack_sku`
  (DB-priced), and extends `_apply_subscription_credit` to credit the add-on's
  never-expire purchased tokens to the holder (idempotent, reusing the
  token-pack credit shape). Standalone token top-ups are unchanged.
- Admin `/admin/subscriptions` surfaces the token add-on breakdown on pending
  orders so reconciliation knows the total includes tokens.

SPEC IMPACT: None (implementation of an existing apply-then-pay flow; no pricing
or SKU change — prices stay DB-driven in `vendor_billing_catalog`).
