## 2026-07-25 · feat(vendor): tier-gate the growth capabilities to the locked monetization matrix (flag-dark)

Reconciles the four GROW-row capabilities in
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 1 + § 8 against the code, with
`lib/vendor-tier-caps.ts` (`TIER_CAPS` + `isTierAtLeast`) as the single source of
truth. Build-sequence step 9 ("reconcile market-intel / favorites / editorial
gating to the tier matrix") plus step 8 ("SEO/GEO/AEO tiering").

**Audited already-correct — no behaviour touched:**

- **Market intel** (Demand Radar + price-position) is already `marketIntel: true`
  from Pro up, and `/vendor-dashboard/performance` is the only live surface,
  already gated on `canSeeMarketIntel()` behind the existing server flag
  `VENDOR_TIER_FEATURE_GATE`. Only the stale doc comment (which still claimed
  "ENTERPRISE-ONLY" while the value was Pro+) was corrected, and the matrix is
  now pinned by a test.
- **Vendor favorites** are already Solo+ via `vendorHoldsActivePaidSub()` in
  `lib/vendor-favorite-gate.ts` behind `VENDOR_FAVORITES_SUBSCRIPTION_GATE`
  (default OFF, untouched — flipping it during free-during-launch would blank
  every saved list). Its existing source-scan guard already forces every
  favorites loader through the gate. Added a cross-check test asserting the gate
  and the tier ladder agree.

**New — SEO/GEO/AEO ladder (§ 8), shipped dark:**

- `TierCaps.seoLevel: 'basic' | 'enhanced' | 'aeo' | 'priority'` — Free/Verified
  basic · Solo enhanced · Pro aeo · Enterprise/Custom priority.
- `lib/vendor-seo-tier.ts` — pure, env-free, clock-free `vendorSeoPlan(tier,
  gateOn)` returning `{ indexable, entityGraph, offerGraph, sitemapPriority }`.
  Basic indexability is `true` for every tier by construction (we never de-index
  a vendor to sell a tier — it also feeds Setnayan's own SEO).
- `lib/vendor-seo-tier-flag.ts` — `NEXT_PUBLIC_VENDOR_SEO_TIER_GATE`, default OFF.
  While OFF `vendorSeoPlan()` returns the LEGACY plan (all enrichments, flat 0.8
  priority) for **every** tier, so `/v/[slug]` JSON-LD and
  `/sitemap-vendors.xml` are byte-identical to today.
- Wired at exactly two sites: `app/v/[slug]/page.tsx` (`knowsAbout` → Solo+;
  `hasOfferCatalog` + `makesOffer` + `priceRange` → Pro+; the identity graph and
  BreadcrumbList stay free) and `app/sitemap-vendors.xml/route.ts` (per-tier
  `<priority>`). The sitemap only *reads* the tier columns when the flag is on.
- `TierCaps.editorialFeatures` (Pro+) added for the matrix's "Editorial features"
  cell. Deliberately **unwired** — see the owner question below.

**Review round 2 — three defects found by adversarial review, all fixed here:**

1. **Lapsed paid vendors kept the paid SEO forever (HIGH).** Tier lapse is
   login-driven — `sweep_vendor_tier_expiry` fires only from the vendor
   dashboard layout, and a public page render and a crawler hit are exactly the
   two paths where nobody is logged in. Both render sites now go through
   `vendorSeoPlanForVendor(row, gateOn, now)`, which collapses a paid tier whose
   `tier_expires_at` has elapsed to `'free'` via the repo's canonical
   `vendorHoldsActivePaidSub()` predicate (same defence as
   `vendor-favorite-gate.ts` / `enterprise-vendor-gate.ts`). `tier_expires_at`
   was added to the `/v/[slug]` select + its skew regex, and to the sitemap's
   gated select. NULL expiry = never expires (admin/comp tier) — unchanged.
2. **A tier-column schema skew republished demo + unverified vendors to
   crawlers (MEDIUM).** The single `(is_demo|verification_state|tier_state)`
   regex routed a `tier_state` 42703 into the pre-existing visibility fallback,
   which drops the `verification_state='verified'` and `is_demo IS NOT TRUE`
   filters. The fallback ladder is now a pure, unit-tested planner
   (`firstVendorSitemapQuery` / `nextVendorSitemapQuery`): a TIER skew drops
   only the tier columns and **keeps every visibility filter**; only an
   `is_demo` / `verification_state` skew takes the filter-dropping fallback
   (pre-existing behaviour, unchanged). Non-skew errors are no longer papered
   over. Ladder is strictly narrowing, bounded at 3 queries.
3. **The legacy-select fallback de-enriched a *currently paying* vendor
   (MEDIUM).** `tier_state: undefined` (column not in the select) is now
   distinguished from `tier_state: null` (column read, vendor is free):
   *unknown* returns the LEGACY plan, so our own deploy skew can never withhold
   an entitlement a vendor bought. An explicit free/null tier is still free —
   "unknown" is not a bypass, and that is asserted.

Flag-OFF remains byte-identical, now more strictly than before:
`vendorSeoPlanForVendor(row, false)` is asserted field-for-field equal to
`vendorSeoPlan(tier, false)` — including the echoed `level` — across every tier
× every expiry state.

**Tests** — `lib/vendor-seo-tier.test.ts` is now 28 tests, and four
locked-matrix reconciliation tests in `lib/vendor-tier-caps.test.ts`. Each of
the three fixes above was **falsified**: reverting the lapse collapse fails 2
tests, reverting the unknown-tier branch fails 1, reverting the skew split fails
1, and reverting both render sites to their pre-fix wiring fails both
source-scan guards. Full unit suite 3447/3447, `tsc --noEmit` clean.

**⚠ OWNER DECISION — "Editorial features → Pro+" collides with a standing lock.**
The locked matrix puts editorial features at Pro+, but Simplicity Canon rule 2
(owner-ratified 2026-07-16) says "Being credited in a story is always free —
editorial or chapter, any tier. You never pay to be named in a story," and
`editorialTagged` is `true` on every tier because of it. I read the new row as
*proactive editorial FEATURING* (§ 8's "AI-surfaced featuring"), kept credit free,
and added a separate `editorialFeatures` cap that is not wired to any credit
path. If the owner instead meant to re-gate editorial CREDIT, that reverses
rule 2 and needs an explicit call — it is one matrix edit, not a code hunt.

SPEC IMPACT: None — implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md`
§ 1 (GROW row) + § 8 as already specced. The editorial-credit-vs-featuring
ambiguity above is raised for owner sign-off rather than resolved in the corpus.
