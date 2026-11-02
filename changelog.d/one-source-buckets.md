## 2026-10-26 · refactor(taxonomy): one source for "which services are under this category" (③0-a)

Every tile → services and group → services question the product asks now reads the LIVE
taxonomy (`getCanonicalBuckets()` → `servicesInTile` / `servicesInFolder` /
`servicesForPlanGroup` / `rollUpCountsToTile`, all in `apps/web/lib/vendor-counts.ts`) instead of
module-load constants over `TAXONOMY_MAP`. So a category or service an admin adds, moves, hides or
cross-lists in /admin/categories is followed — with no deploy — by: the couple's category search
and "more to compare" row, "unlock a category" inquiries, the onboarding venue search, counts and
availability gate, the /explore save-from-a-tile card pick, the Suppliers page's saved-request
icons and market-pool count, the find-a-supplier counts, and the reception room's booked-supplier
chips.

- The two module-load IIFEs are gone; the const answer is now `deriveBuckets(fallbackSnapshot())`,
  the same function over the snapshot `getTaxonomy()` itself falls back to. The four hand-kept
  copies of the plan-group ladder (subcategoryHint → catalogTile → catalogFolder) are one function.
- The Filipiniana & Barongs cross-view is no longer a hand list (`FILIPINIANA_BARONG_CANONICALS`)
  force-set in code: migration `20271290076754_one_source_filipiniana_cross_view` writes it as
  `secondary_tiles` rows (and `TAXONOMY_MAP` carries the same), so the shelf is edited where every
  other cross-listing is. Same ten services on today's data.
- Still on the const, by name, with their exit: the inspiration-part helpers in
  `lib/moodboard-gallery.ts` and `lib/moodboard-finalization.ts` (③0-b owns them; ③a makes a part
  name services). `lib/one-source-buckets.test.ts` fails any other product importer.
- Guards: `apps/web/tests/db/one-source-buckets.db.test.ts` (the reader equals the deleted
  constants on the replayed seed, tile by tile and group by group; and after a simulated admin
  edit — add a category + service, move, cross-list, hide — the reader follows while the const
  does not) and `apps/web/lib/one-source-buckets.test.ts` (importer allowlist, self-cleaning).

SPEC IMPACT: Implements corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 8.3
step ③0-a (no spec text changes; the plan already describes this step).
