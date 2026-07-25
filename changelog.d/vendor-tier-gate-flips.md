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
  `<priority>`). The sitemap only *reads* `tier_state` when the flag is on, and
  `tier_state` joined the skew-tolerant column regex so a schema/deploy skew
  degrades to the flat-priority fallback instead of emitting an empty sitemap.
- `TierCaps.editorialFeatures` (Pro+) added for the matrix's "Editorial features"
  cell. Deliberately **unwired** — see the owner question below.

**Tests** — `lib/vendor-seo-tier.test.ts` (14 tests: flag-OFF byte-identity across
every tier incl. unknown/null, flag-parsing, the full flag-ON matrix, ladder
monotonicity, and source-scan guards on both render sites) and four new
locked-matrix reconciliation tests in `lib/vendor-tier-caps.test.ts`. Both
source-scan guards were verified to FAIL with the wiring removed.

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
