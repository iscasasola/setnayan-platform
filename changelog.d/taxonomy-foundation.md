## 2026-10-26 · chore(taxonomy): the foundation batch — six ③0/③a PRs in one, conflicts resolved, one follow-up migration

Carries, merged in this order: #6950 (③0-d admin path) → #6952 (③0-c part 1 coarse category column) →
#6955 (③0-c part 2 a new category inherits) → #6949 (③0-a one source for buckets) → #6951 (③0-b one
source for parts) → #6958 (③a a part links services). Each PR's own fragment travels with it.

- **Conflict #6949 × #6951 resolved by keeping BOTH new arguments.** `bookedZoneCandidates(booked,
  venueSetting, buckets, parts)` — ③0-a's live tile → services buckets and ③0-b's live parts snapshot are
  both threaded from the seating lab page (`getCanonicalBuckets()` + `getInspirationParts()`) and through
  `the-room-offers-what-you-booked.test.ts`; `moodboard-gallery.test.ts` keeps ③0-a's
  `canonicalServicesForTile('filipiniana_barongs')` and ③0-b's required `parts` argument.
- **Semantic conflict fixed:** ③0-a deleted `FILIPINIANA_BARONG_CANONICALS`; two ③a/③0-b db tests still
  imported it. Both now read the cross-view as what it is since ③0-a — `secondary_tiles` rows.
- **Follow-up migration `20271292138044_pairs_drop_the_filipiniana_sql_branch.sql`:** ③a's
  `inspiration_category_service_pairs()` kept a hand-kept UNION branch naming the ten Filipiniana & Barongs
  services "until ③0-a writes them as rows". ③0-a does; the branch is dropped, so un-listing a service from
  that category on /admin/categories now actually un-lists it. Eligibility unchanged — held by
  `part-eligibility-is-unchanged-by-the-move.db.test.ts` (old = new for every part) and a new assertion in
  `a-supplier-suggests-only-to-its-own-parts.db.test.ts` that the function equals the rows and names no
  service by hand.
- Generated baselines regenerated with their own commands (never hand-merged): `ugat:screens`,
  `port:baseline`, `admin:jobs`, `exposure:baseline`, `schema:snapshot` (linked CLI, read-only).

SPEC IMPACT: None beyond the six carried PRs (each names its own). Corpus PLAN
`prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 11's "Open, between ③0-a and ③0-b" item is
closed by the follow-up migration; recorded in the § 12 build record with the Categories page build.
