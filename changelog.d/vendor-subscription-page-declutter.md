## 2026-07-02 · refactor(vendor): declutter the Plan & tokens (subscription) page

Owner: "fix the content. arrange and delete those are not needed … simple,
interactive and easy to understand" — for both desktop and mobile.

The `/vendor-dashboard/subscription` page had grown to eight stacked blocks, with
two Wave-6 analytics cards wedged into the *middle* of the plan-purchase flow:

- **Peso-per-lead scorecard** — unit economics that read `₱0` for any vendor who
  hasn't answered a burning inquiry this cycle (most of them).
- **Price-position meter** — badged "Soon" and, in the founder-only market,
  showing only "not enough market data yet."

Both broke the plan → tokens flow and added noise to a purchase page. **Removed
from this page** (owner-confirmed). The component files
(`peso-per-lead-card.tsx`, `price-position-card.tsx`) and their `lib` fetchers
are retained in the codebase for a future insights surface — only their render +
data-fetch were dropped from the subscription page, so the page no longer runs
`fetchVendorPesoScorecard` / `fetchVendorPricePosition`.

Also on this page:
- **Header copy tightened** — the three-sentence marketing block became one plain
  line ("Upgrade to reach more couples and answer unlimited inquiries. Every plan
  includes free tokens each cycle — no features are locked behind a paywall.").
- **Recommended default moved to Pro** — the orange highlight border + a new
  "Recommended" pill now sit on **Pro** (the sensible default for most vendors)
  instead of the top-priced Enterprise card; the "Current" pill still wins when
  it's the active plan.
- **Token add-on selector copy** clarified to "Bundle tokens with your plan —
  optional."
- Minor: removed a dead `isPaid ? … : ''` branch in the renewal-date line (the
  span is already gated by `isPaid`).

Resulting flow (desktop + mobile, all responsive stacks unchanged): header +
current-plan status → cycle toggle → plan cards (with optional token bundle) →
apply-then-pay panel → token wallet. No pricing, SKU, RPC, or schema changes —
prices stay DB/catalog-driven; the apply-then-pay + one-payment-for-both flow is
untouched.

SPEC IMPACT: None (UI arrangement only within the locked V1 vendor-dashboard
scope; the Plan & tokens hub + Wave-6 benefit inventory remain as specced — the
two cards were relocated off the purchase page, not retired).
