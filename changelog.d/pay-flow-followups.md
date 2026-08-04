## 2026-07-11 · feat(checkout): pre-minted reference shown before payment + calmer order-tracker

Two follow-ups to the payment-flow redesign (PR #3129):

1. **Reference shown before paying.** The checkout drawer now mints the Setnayan
   reference code client-side when it opens and shows it (with one-tap copy) in
   the payment step, asking the couple to include it in their BDO/GCash transfer
   note. `submitOrderAction` accepts that pre-minted code (validated `SN` +
   8-hex, else server-generates) so the created order carries the *same*
   reference the couple wrote — which is what lets the reconciliation matcher
   pair the inbound bank/GCash message to the order automatically. No draft
   orders (minted client-side, threaded through submit); minted in a mount
   effect to avoid an SSR hydration mismatch.
2. **Calmer order-tracker.** `/orders/[orderId]` payment instructions restyled
   to match the drawer: amount + reference as copyable cards (reference in the
   gold accent), framed QR, softer rails.

- `apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx` —
  new `generateClientReference` helper; `referenceCode` minted on mount, passed
  to `PaymentDetailsBlock` (new gold reference card + copy + "put this in your
  note") and threaded to submit as `preminted_reference`.
- `apps/web/app/dashboard/[eventId]/checkout/actions.ts` — `submitOrderAction`
  accepts `preminted_reference` (validated `^SN[0-9A-F]{8}$`, else
  `generateReferenceCode()`); non-sensitive tag — a collision just fails the
  unique-`reference_code` INSERT, never hijacks another order.
- `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` — payment-
  instructions section restyled (amount/reference cards, framed QR, softer rails).

Scope: the checkout drawer + its server action + the order-tracker page.
Native-app suppression, voucher flow, amount/VAT math, and the admin
reconciliation queue are untouched.
No schema change. tsc clean · next lint clean · radius guard clean.
SPEC IMPACT: None — strengthens the locked apply-then-pay manual rail
(reference-in-note is what makes a manual payment matchable); consistent with
the matcher section of the corpus' `Solo_Operator_Admin_Plan_2026-07-11.md`.
