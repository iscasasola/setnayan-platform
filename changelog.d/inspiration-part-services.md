## 2026-10-26 · feat(taxonomy): ③a — a part links SERVICES (`inspiration_part_services`), byte-identical on ship day

Migration `20271291224109_inspiration_part_services.sql`, stacked on ③0-b:

- **`inspiration_part_services(slot_key, canonical_service, sort_order)`.** Created with RLS at CREATE TABLE, the
  same way as step ①: authenticated SELECT only, writes through the service role. The FKs point to
  `inspiration_parts` (CASCADE) and `canonical_service_taxonomy` (RESTRICT).
- **Backfill.** Each part's home plus its also-categories are expanded to their services through the new
  `inspiration_category_service_pairs()`, which is the one category → service rule. ③0-b's
  `inspiration_category_services` now reads it. The backfill only writes into an empty table. It produced **385
  links**, the same 385 measured read-only on prod. For every part the old eligibility equals the new one.
- **Derived categories.** A part's categories are now DERIVED from its services: the view
  `inspiration_part_categories_derived`, which `getInspirationParts()` reads. The rule is: every category whose
  services are all linked comes first, then the own tile of any linked service those don't cover. It reproduces all
  28 parts' categories, so credit lines and "Book a … first" words do not move. The plan's literal rule ("home ∪
  tile_id") would have changed 11 attire parts.
- **Double write.** Until ③c, a trigger rewrites `inspiration_part_categories` from the same derivation whenever a
  link changes or a part is re-homed.
- **`inspiration_suggestion_services`** now reads the link table.
- **Recorded controller calls.** Part `groom` is labelled "Groom’s attire" (the key is unchanged). Part `entourage`
  is hidden, and its photos are kept.

App:

- The snapshot carries `services`, and `canonicalServicesForSlot` reads them.
- The fallback (`services: null`) still expands its categories.
- Studio's attire label and the fallback consts read "Groom’s attire", and `entourage` is hidden in the fallback.

Ugat: joint **J56** (part ↔ service) with its claims. The J55 and suggestions-joint prose is updated.

Tests: `tests/db/part-eligibility-is-unchanged-by-the-move.db.test.ts` (old = new, derivation, double write, RLS and
FKs, the two calls), plus `a-supplier-suggests-only-to-its-own-parts.db.test.ts` re-aimed at the link table.

SPEC IMPACT: corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 10 "Build record" (③a: 385 links, the derived-category rule, re-home semantics, the 22-service groom count). No new decision of its own. This implements PLAN `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md`
§ 3 / § 5 step ③a under the corpus DECISION_LOG row "2026-10-26 · APPROVED — BUILD THE TAXONOMY". Flagged for the
owner/controller:
- the derived-category rule differs from PLAN § 3's literal wording, for the reason above;
- the row's "Groom's attire keeps all 14 services" is really 22 services on the tables today. That 22 is today's
  eligibility, kept unchanged.
