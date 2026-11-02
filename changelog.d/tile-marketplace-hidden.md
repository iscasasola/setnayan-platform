## 2026-07-04 · feat(taxonomy): honor tile-level marketplace_hidden on couple-facing surfaces

`service_categories.marketplace_hidden` (tier-1/tier-2) existed in the DB but was
never read. Wired through taxonomy-db → taxonomy-snapshot (new sparse
`hiddenCategories` map, same shape family as `categoryIcons`/`categoryPhotos`) and
filtered on couple-facing consumers only: the /explore tile grid and the onboarding
tile picker (`getOnboardingTiles`). Vendor services picker + admin Taxonomy Studio
intentionally UNFILTERED — vendors can still list under hidden tiles (faith-readiness
counts) and admins see hidden tiles with a badge + a new "Hidden from couples" toggle
(`setCategoryHidden`, audit action `taxonomy.set_hidden`).

Behavioral no-op today: zero tiles have marketplace_hidden=TRUE in prod. Unblocks
filing 30 hidden canonical services into 4 admin-only tiles without /explore leakage.

Also fixed in review: the couple Shortlist (`buildShortlistFolders` in
lib/shortlist-taxonomy.ts) now only drops a hidden tile when the couple has NO
considered/booked vendor under it. The inherited diff filtered hidden tiles
unconditionally, which would have hidden a couple's own already-shortlisted
vendor from their own Shortlist the moment an admin flagged that tile —
regression risk once any tile actually gets hidden. Covered by two new tests in
lib/shortlist-taxonomy.test.ts.

SPEC IMPACT: None (implementation-level wiring; no corpus claims change).
