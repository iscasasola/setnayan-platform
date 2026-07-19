## 2026-07-05 · fix(marketing): no frozen live counts in copy

Replaced hardcoded live counts frozen in public-surface copy with honest,
threshold-gated live reads. The marketplace is founder-only at launch, so a
raw live count is tiny; count-driven copy now renders the number ONLY at/above
a `VENDOR_COUNT_BRAG_THRESHOLD` (50), otherwise it gracefully omits the figure.

- `apps/web/lib/vendor-counts.ts` — new `getVerifiedVendorMarketplaceCount()`
  (`unstable_cache`, 1h revalidate) using the EXACT `/explore` marketplace
  predicate (`public_visibility ∈ {verified, coming_soon}` ·
  `verification_state = 'verified'` · demo/seed excluded · real `business_name`)
  so every public number agrees platform-wide. New `VENDOR_COUNT_BRAG_THRESHOLD`
  constant.
- `apps/web/app/signup/page.tsx` — the "192 verified vendors" benefit bullet is
  now a threshold-gated live count; below the floor it reads
  "Verified vendor marketplace" (no number).
- `apps/web/app/for-vendors/_components/stack-close-vendor.tsx` — removed the
  fabricated "192 verified categories" claim (categories aren't "verified"); no
  live predicate makes it true, so the number was dropped: "browse by category".

Illustrative product-screenshot mocks (e.g. homepage `pillars.tsx`
"6 of 847 vendors", "142 guests") were intentionally left — they are fictional
demo UI, not checkable platform claims. Seed/demo/test fixtures untouched, and
`lib/help.ts` was avoided (owned by a concurrent agent).

SPEC IMPACT: None — corpus already flags "192 verified vendors" as superseded
and mandates factual public numbers only (public-claims lock; vendor-hero
comment 2026-06-15). This aligns code to that existing decision.
