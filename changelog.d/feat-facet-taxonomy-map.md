## 2026-07-11 · fix(vendors): map taxonomy category keys to schema keys so facet search lights up

Couple category-search facet chips (PR #3089) read from `canonical_service_schemas`
+ `shared_attribute_groups`, `vendor_service_attributes`, and `event_vendor_preferences`.
Audited the key spaces: all four are keyed by the taxonomy `canonical_service`
(`photography`, `catering`, `stylist_decorator`, …) — the 192-entry master taxonomy
IS the schema key space (seeded 1:1 by `20260521030000` + `20260521040000`), and
`canonicalsForGroup()` already feeds those same taxonomy canonicals into the reads.
So the feared broad "taxonomy `photographer` vs schema `photography`" mismatch does
NOT exist here — the plan-group scope is taxonomy-derived (subcategoryHint / tile /
folder), not the `VendorCategory` enum, so keys coincide for every real category and
the facet reads already resolve.

The one genuine gap: two plan-group `subcategoryHint`s are UI-convenience slugs that
are NOT `canonical_service_schemas` rows — `stylist` (should be `stylist_decorator`,
which carries the `theme_specialties` facet) and `choreographer` (should be a real
choreography canonical). A search scoped to one of those queried a dead key → inert
facets even where data exists.

- New `apps/web/lib/vendor-facet-schema-map.ts` — a single source-of-truth
  `resolveFacetSchemaKeys()` resolver: identity for every real canonical (the
  common case, zero behavior change), aliases only the two non-canonical slugs
  (`stylist` → `stylist_decorator`, `choreographer` → `entourage_choreographer`),
  deduped + order-stable, never throws.
- `apps/web/app/dashboard/[eventId]/vendors/_actions/category-search.ts` — the three
  facet reads (facet catalog, saved-pref seed loop, vendor-attribute match) now key
  on the resolved schema canonicals; the vendor RESULT scoping keeps using the raw
  taxonomy `canonicals`, so which vendors appear is unchanged. Graceful-degrade
  preserved: unmapped keys pass through untouched.

SPEC IMPACT: None. Code-only reconciliation between the plan-group hint slugs and the
attribute-schema key space; no SKU, schema, pricing, or product decision changes.
The audit finding — that the taxonomy canonical IS the schema key for all real
categories — matches the existing corpus (0044 per-category schemas seeded from the
192-entry taxonomy master); nothing to restate there.
