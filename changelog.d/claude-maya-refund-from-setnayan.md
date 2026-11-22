## 2026-11-22 · feat(admin-payments): a Maya-paid order is voided or refunded from Setnayan, for as long as Maya allows it

Owner: "make it possible to allow refund until maya allow refund" (specs DECISION_LOG 86f20253).

- `/admin/payments`, opened payment paid through Maya: one live read of Maya's payment (`canVoid` / `canRefund`;
  fallback the documented GMT+8 cut-off on Maya's `createdAt`) draws ONE button — **Void** while Maya allows a
  void, otherwise **Refund** — for the whole payment. Neither → no button, "Maya no longer allows a void or a refund
  for this payment." A failed read → "Couldn't reach Maya — try again." Maya already showing it handed back →
  "Record Maya's refund" (nothing sent again).
- The press posts to `refundOrder` with `intent: 'maya_reverse'` (no new server action). Maya is re-read and asked
  first; ONLY its yes is recorded, through the existing `applyRefund` (status refunded, revocations, `order_refunds`,
  audit with `paid_through: 'maya'`, the payment_refunded notice). Each PY code is one plain line; the
  not-switched-on refusal says "Maya hasn't switched on refunds through the app for this account — ask your Maya
  account manager". Nothing is recorded on any refusal.
- Over ₱25,000 it opens the § 9.1 two-admin request (shared `openLargeRefundApproval`), and Maya is asked only when
  the second admin approves (`executeLargeRefund`, which also requires Maya's amount to equal the approved one).
- BDO/GCash orders keep the by-hand refund record, unchanged.
- ⚠ The void/refund routes (`POST /payments/v2/payments/{id}/voids|refunds`) and bodies are not on any public
  developers.maya.ph page read 2026-11-22; a wrong one is a refusal that records nothing. Confirm with the Maya RM.

SPEC IMPACT: None — implements the existing ruling 86f20253.
