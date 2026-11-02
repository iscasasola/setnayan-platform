## 2026-07-02 · feat(vendor): service-card redesign Phase 4 — couple-facing card surfacing

Surface the service-card child-table data (Phase-1 schema, migration
`20270502342558`) to COUPLES on the public vendor profile's "Services & pricing"
gallery (`/v/[slug]`). Each service card now shows, in addition to the existing
"from ₱X" anchor:

- **Best applicable discount** as a single badge (e.g. "20% off · early booking"
  or "₱2,000 off · bundle"). Among a service's discounts we pick ONE with a
  simple, honest heuristic: drop expired offers, then choose the one that saves
  the couple the most pesos on the anchor (pct → anchor × rate/100; php → rate,
  capped at the anchor), breaking ties by the vendor's own `sort_order`.
- **FREE inclusions** with their stated worth — "Includes: <label> · ₱X free",
  listing up to 3 with a "+N more included" overflow line.
- **"Not included" expectation flags** — "Crew meal not included" when
  `crew_meal_included=false`; "Transport not included" / "Transport: ₱X" when
  `transport_included=false` (fee shown when `transport_flat_fee_php` is set).
  These set the couple's expectation and feed the 0007 budget line items.

The universal **"Request a quote"** path is unchanged — the profile's
InquiryComposer remains the single quote entry point ("Final quotes happen in
chat"); no per-card CTA was added.

New file `apps/web/lib/vendor-service-public.ts` owns the couple-facing reads
(`fetchInclusionsByService`, `fetchDiscountsByServicePublic`,
`fetchPriceBracketsByService`) + the `pickBestDiscount(discounts, anchorPhp)`
helper, kept separate from the vendor-write module `lib/vendor-services.ts`
(imports READ-ONLY types from it only). All fetchers fail-soft to empty maps so
an unapplied migration / RLS hiccup degrades to the pre-enrichment card rather
than crashing the profile.

Explore per-vendor `VendorCard` already carries an off-peak badge at the
vendor-summary level; the richer inclusion/discount/not-included detail belongs
on the per-service card and was scoped there. Serves/faith Explore filtering was
DEFERRED (touches the large `explore/page.tsx` query + filter chrome — higher
risk, out of the low-risk card-enrichment scope).

Files: `apps/web/lib/vendor-service-public.ts` (new),
`apps/web/app/v/[slug]/_components/services-gallery.tsx`,
`apps/web/app/v/[slug]/page.tsx`.

SPEC IMPACT: None. Activates existing Phase-1 schema on the couple-facing
profile; no new migration, no schema change.
