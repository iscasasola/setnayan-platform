## 2026-07-24 · fix(checkout): hide the PayMongo "coming soon" card — QR/manual payment only

Owner directive 2026-07-24: PayMongo stays fully out of sight until it's built next year. The inline checkout drawer previously rendered a locked, presentational `<PayMongoSoon />` card (Card / Maya / GrabPay list under a "Coming soon" badge) between the QR/BDO/GCash `PaymentDetailsBlock` and the submit form, per the 2026-07-11 "shown but LOCKED" directive. That directive is now superseded: the card is removed so the drawer shows the manual QR/BDO/GCash rail and the submit form only.

**Change — `apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx`:**
- Removed the `<PayMongoSoon />` render (and its `(3b)` explanatory comment).
- Removed the entire `PayMongoSoon` function (its JSDoc + body — the locked Card/Maya/GrabPay list).
- Removed the now-orphaned lucide imports `Clock`, `Smartphone`, `Wallet` (used only inside `PayMongoSoon`). Kept `CreditCard` (still used by the trigger button, ~line 318) and `Lock` (still used by the native-app locked chip, ~line 305).

Purely presentational removal — no state, action, schema, or payment-flow change. PayMongo remains unbuilt and inaccessible; this only stops surfacing the locked "coming soon" card. QR block, voucher block, channel toggle, and submit form untouched. `tsc --noEmit` clean, `next lint` clean (no unused-import/var), zero remaining `PayMongoSoon` references.

SPEC IMPACT: None
