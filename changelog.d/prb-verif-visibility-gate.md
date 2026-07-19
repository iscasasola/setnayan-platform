## 2027-03-31 · feat(vendors): gate public visibility on verification_state (unverified hidden)

PR-B — UNVERIFIED vendors are now private: they never appear on Explore /
marketplace, have no public `/v/[slug]` website, are excluded from the vendors
sitemap + public `/api/v1/vendors` list/detail, are never recommended on any
couple-facing surface, and are never auto-promoted to social. Only VERIFIED
vendors surface publicly. The lone real founder vendor + every paid-tier vendor
stay fully visible.

What changed:
- **Migration** `20270331400000_vendor_verification_visibility.sql`:
  (a) reconcile `UPDATE vendor_profiles SET verification_state='verified' WHERE
  tier_state <> 'free' AND verification_state <> 'verified'` (idempotent — covers
  the founder + every paid vendor so the gate can never empty the live
  marketplace); (b) append `vp.verification_state` as the trailing column on the
  `vendor_market_stats` view (CREATE OR REPLACE, body copied verbatim from
  `20261005000000`, no column dropped/renamed/reordered).
- **Explore** (`app/explore/page.tsx`): replaced the FLAG-DARK
  `.neq('tier_state','free')` tier branch with an ALWAYS-ON
  `.eq('verification_state','verified')` gate (demo carve-out preserved on both
  the marketplace query and the broadened empty-state count). Removed the now-dead
  `isVendorSearchGateEnabled` import.
- **Public website** (`app/v/[slug]/page.tsx`): unverified profiles `notFound()`
  for the public; the page is `force-dynamic` so the OWNING vendor (user_id match)
  can still self-preview, and admins in demo mode are carved out.
- **Sitemap** (`app/sitemap-vendors.xml/route.ts`): `verification_state='verified'`
  filter added (with a schema-fallback for environments where the column lags).
- **Public API** (`app/api/v1/vendors/route.ts` + `[publicId]/route.ts`): both the
  CORS-open list and the detail endpoint gate on `verification_state='verified'`.
- **Recommendation engine** (`lib/wizard-recommendations.ts`): always-on gate;
  the guided-tour demo opts out via a new `includeDemoUnverified` flag
  (`app/tour/vendors/page.tsx`) so its `is_demo` sample vendors still show.
- **Compare** (`app/explore/compare/page.tsx`): `.or(verified OR is_demo)` so the
  public surface drops unverified vendors while the admin demo carve-out holds.
- **Counts** gated for honesty: onboarding congrats stat
  (`app/onboarding/wedding/actions.ts`), dashboard market-pool count
  (`app/dashboard/[eventId]/vendors/page.tsx`), and social milestone + auto-feature
  sweeps (`lib/social/flush.ts`).

Deliberately NOT gated (the couple's own working set / curated relationships, not
public discovery): dashboard shortlist + saved-vendors library + workspace contact
+ studio recommendation-name resolution + editorial vendor credits — these surface
vendors the couple already picked/booked or who explicitly recommended themselves,
so a verification lapse must not erase them from the couple's view.

SPEC IMPACT: None (no new schema beyond the idempotent reconcile UPDATE + one
trailing view column; behavioral gate only — existing column/enum already shipped
in `20260516050000`).
