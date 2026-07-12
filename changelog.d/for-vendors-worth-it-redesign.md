## 2026-07-01 · feat(for-vendors): worth-it redesign — Free tier column, value/ROI section, stale-soon scrub

Targeted high-impact upgrade to `/for-vendors` (owner ask: "make it feel worth
it · show the 4 tiers from free to subscription").

- **4-tier matrix.** `VendorPricingMatrix` re-introduces a **Free** column as the
  leftmost tier → Free · Solo · Pro · Enterprise (was Solo/Pro/Enterprise since
  2027-02-18). Desktop 5-col grid, mobile 4-pill switcher (default Pro). The
  deep-dive tier intro now opens with the Free framing ("get found · get
  messaged"). ⚠ Free/Solo boundary cells are a **conservative assumption**
  (Free = verified profile + chat + pipeline + pay-per-token inquiries, capped
  10-photo portfolio, local reach, 1 category; Solo adds the full toolkit) —
  flagged for owner sign-off against the real vendor-tier entitlement gates.
- **New `VendorWorthIt` section** (between StackCloseVendor and the deep-dive):
  value-stack anchoring (typical standalone tool costs totalled vs included
  price), one-booking ROI card, and the 8-tools→1 cost-replace strip. All prices
  DB-driven via `getVendorPrices()` (never hardcoded).
- **Stale "Coming soon" scrub.** The "Crew-rate marketplace — Coming soon"
  benefit was wrong (the `manpower` module is shipped). Reframed to live
  behavior: "Manpower marketplace · pick up paid gigs from events already on
  Setnayan." Genuine not-yet-shipped "soon"s (native apps, TL/CEB toggles) left
  intact.

Files: `app/for-vendors/page.tsx`, `app/for-vendors/_components/vendor-worth-it.tsx`
(new), `vendor-pricing-matrix.tsx`, `for-vendors-deep-dive.tsx`.

Verification: `tsc --noEmit` clean on all touched files. Browser render blocked
locally — `~/apps/web` has no `.env*`, so middleware's Supabase client 500s every
route; renders on the Vercel deploy which has the secrets.

SPEC IMPACT: Vendor marketing surface now shows a 4th (Free) tier in the
comparison matrix — reverses the 2027-02-18 "Free/Verified dropped from the
marketed matrix" decision. Logged at the bottom of `DECISION_LOG.md`. The
Free-tier feature-gating cells need owner confirmation before they are treated
as canonical entitlements.
