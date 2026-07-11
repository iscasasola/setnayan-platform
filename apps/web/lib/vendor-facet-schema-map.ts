/**
 * vendor-facet-schema-map — the single source of truth mapping a search-scope
 * canonical_service to the ATTRIBUTE-SCHEMA key the couple's facet reads
 * (lib/vendor-facets) must query.
 *
 * ── Why this is (almost entirely) the identity ────────────────────────────
 * The four facet key spaces already coincide. `canonical_service_schemas`,
 * `shared_attribute_groups`, `vendor_service_attributes` and
 * `event_vendor_preferences` are ALL keyed by the taxonomy `canonical_service`
 * (photography, catering, stylist_decorator, …). The 192-entry master taxonomy
 * IS the schema key space — every taxonomy canonical is seeded 1:1 as a
 * `canonical_service_schemas` row (migrations 20260521030000 top-15 +
 * 20260521040000 full-taxonomy), vendors fill `vendor_service_attributes` under
 * a canonical they pick FROM that same table, and `event_vendor_preferences`
 * FK-references it. `canonicalsForGroup()` in the category-search action feeds
 * those same taxonomy canonicals in (via subcategoryHint / tile / folder), so
 * for every REAL canonical this resolver is the identity and the facet reads
 * already line up. (The earlier "taxonomy `photographer` vs schema `photography`"
 * concern does not apply — the plan-group scope is derived from the taxonomy,
 * not from the `VendorCategory` enum, so `photography`/`catering`/… go in
 * verbatim.)
 *
 * ── The one real gap this closes ──────────────────────────────────────────
 * A couple of plan-group `subcategoryHint`s are UI-convenience slugs that are
 * NOT `canonical_service_schemas` rows: `stylist` (the styling umbrella card)
 * and `choreographer` (the dance-instructor card). A search scoped to one of
 * those queries a key that has no schema row, no vendor attribute payloads and
 * no (FK-impossible) saved preference — so the facet layer is inert there even
 * though the real category (`stylist_decorator`, which carries a
 * `theme_specialties` facet) has data. This map aliases those slugs onto their
 * real schema key so the facet catalog / vendor-attribute / saved-pref reads
 * light up. It touches ONLY the facet reads — the vendor RESULT scoping keeps
 * using the raw taxonomy canonicals, so nothing about who shows up changes.
 *
 * ── Adding entries ────────────────────────────────────────────────────────
 * Add an alias ONLY for a key that is provably NOT a `canonical_service_schemas`
 * row (i.e. a plan-group hint that is not itself in the taxonomy). NEVER remap a
 * real canonical — that would silently repoint a category's facets at the wrong
 * schema.
 */

/**
 * Non-canonical plan-group hint slug → its real `canonical_service` schema key.
 * Keep this tiny and evidence-based: each key here is a `subcategoryHint` in
 * lib/wedding-plan-groups.ts that is NOT present in `canonical_service_schemas`.
 */
export const FACET_SCHEMA_KEY_ALIASES: Readonly<Record<string, string>> = {
  // `stylist` plan card (subcategoryHint 'stylist') → the styling schema, which
  // carries the `theme_specialties` multi-select facet.
  stylist: 'stylist_decorator',
  // `dance_instructor` plan card (subcategoryHint 'choreographer') → a real
  // choreography canonical. Its schema has no facets today, so no chips render,
  // but the vendor-attribute + saved-pref reads now target a valid key space
  // instead of a dead slug.
  choreographer: 'entourage_choreographer',
};

/**
 * Map a set of search-scope canonicals to the schema keys the facet reads
 * should query. Identity for every real `canonical_service` (they ARE schema
 * keys); aliases only the handful of non-canonical plan-group slugs above.
 * Deduped + order-stable. Never throws — an unknown/unmapped key passes through
 * unchanged, so the reads graceful-degrade exactly as they do today.
 */
export function resolveFacetSchemaKeys(
  canonicals: ReadonlyArray<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of canonicals) {
    const mapped = FACET_SCHEMA_KEY_ALIASES[c] ?? c;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
}
