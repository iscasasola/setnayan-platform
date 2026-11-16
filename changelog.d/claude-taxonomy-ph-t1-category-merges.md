## 2026-11-16 · feat(taxonomy): T1 part 2 — the approved Philippine taxonomy's category merges

Owner, 16 Nov: *"make the taxonomy go live now"*. Stacked on part 1 (#7887). One data migration
(`20271350082350_taxonomy_ph_t1_category_merges.sql`) folds 13 categories WHOLE into the spec's categories:
Men's Attire → Entourage & Sponsors · Wedding Singer → Live Band & Singers · Mocktail → Mobile Bar · Dessert, Food
Truck → Food Carts · Mini Nail Bar, Perfume Bar, Henna → Pampering · Outdoor, Fireworks, Dance Floor → Rentals &
Special Effects · Transfers & Rentals → Van / Coaster Rental · AV / Production → Speakers & AV.

- Every holder of the old category id moves (services, couples' suppliers, inspiration parts' homes, "what couples
  choose" cards, supplier recommendations); the destination keeps every event the merged category served (owner
  "yes": Rentals & Special Effects now shows at weddings); the emptied category stays HIDDEN with
  `merged_into_category_id` (owner "ok") — never deleted. The migration refuses to commit a half merge.
- Inspiration parts keep exactly the shops they had: a service changing category moves no link, so the merged
  Entourage & Sponsors does not hand Bridesmaids to tailors or Groomsmen to dressmakers. The fallback reproduces it
  from a new `mergedFrom` on the moved services (`servicesKeptThroughTheMerges`) — no hand-typed service list.
- Code: `MERGED_TILES` + `forwardTile()` in `lib/taxonomy.ts`; the fallback snapshot hides the merged categories;
  Suppliers rows (`VENDOR_CATEGORY_CANONICAL`), the room parts, the reception scene and the onboarding picks name the
  destinations; an old `/suppliers/<event>/<merged-category>/…` link permanently redirects to the destination's page.
- New guard `tests/db/the-taxonomy-is-the-approved-ph-tree.db.test.ts`: the shipped tree equals the spec's
  categories, the merges and the ⛔ hides.

SPEC IMPACT: None to the spec (this implements `TAXONOMY_PH_FULL_2026-11-07.md`); DECISION_LOG row for part 2 to add.
