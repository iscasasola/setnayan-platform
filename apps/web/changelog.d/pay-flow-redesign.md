## 2026-07-11 · feat(checkout): calmer payment UI + PayMongo "coming soon" rail

Restyle the inline checkout drawer to the calmer, cleaner payment flow the owner
approved in the prototype, and surface PayMongo's instant-payment options as a
visible-but-locked "Coming soon" rail (unlocks after merchant verification —
BIR COR → PayMongo submit → approval). Manual BDO/GCash stay the working rails;
the native-app purchase suppression (Apple 3.1.1 / Play Billing) and all server
behavior are unchanged.

- `apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx` —
  `ChannelToggle` reworked from a pill into selectable **method cards** (GCash /
  BDO, brand badges, "Ready" chip, radio semantics preserved); new
  `PayMongoSoon` disabled rail (Card / Maya / GrabPay, lock icon + "Coming soon"
  pill, purely presentational); `PaymentDetailsBlock` restyled with a framed QR
  and **one-tap copy** on the account name + number (reuses the shared
  `CopyButton`); `SubmitSuccess` restyled to a calmer confirmation
  (pending-verification pill, copyable reference code, a 3-step "what happens
  next"). Light-only (checkout is theme-locked); reuses only existing
  `mulberry` / `terracotta` / `cream` / `ink` / `success` / `warn` tokens.

Scope: UI-only restyle of one client component. Native-app suppression, voucher
flow, `submitOrderAction`, and the `platform_settings` QR/account plumbing are
untouched.
No schema change. tsc clean · next lint clean · radius guard clean.
SPEC IMPACT: None — matches the locked apply-then-pay manual-rail model; PayMongo
stays unbuilt/locked pending verification (tracked in the corpus'
`Solo_Operator_Admin_Plan_2026-07-11.md`).
