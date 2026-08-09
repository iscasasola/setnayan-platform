## 2026-08-09 · fix(taxonomy): 194 of 246 live services were filed as "Miscellaneous" — now none are

Owner, 2026-08-09: *"fix the taxonomy if needed. we do not like having categories under misc."*

**The measurement.** The product carries two service vocabularies that do not line up. The admin taxonomy — **15 parents → 70 branches → 246 marketplace-visible leaves** — is what a vendor NAVIGATES. The `vendor_category` enum is what gets STORED on `vendor_profiles.services` and what every marketplace filter reads. The only bridge between them was `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY`, keyed on LEAVES and built for packages: it covers **52 of 246**. The other **194 fell through a `?? 'misc'`** — silently, with nothing logged and nothing red.

**🔑 THE FIX IS TO MAP AT THE BRANCH, NOT THE LEAF.** A leaf map needs 246 entries and grows every time an admin adds a service in the console — which is exactly how it fell 194 behind. `lib/vendor-branch-category.ts` maps all **70 branches**, and **a leaf added tomorrow inherits its branch with no code change**. Keyed on `tile_id`, never the label: labels are admin-editable free text, so renaming "Photo Booth" would silently break a label-keyed map with no error anywhere.

`vendorCategoryForLeaf(leaf, tileId)` resolves leaf-map → branch-map. Order matters: the leaf map is the more specific answer where it exists — the "Photo & Video" branch holds both photography and videography leaves and only the leaf can tell them apart. `resolveVendorCategory` is left alone and now carries a warning that it is package-scoped and covers 52 of 246; it was never wrong for packages, only for everything else.

**Two branches genuinely had no home**, so migration `20271122676773` adds them:
- **`wellness_fitness`** — the Wellness & Fitness branch (5 leaves). `makeup_artist` would have been plainly wrong.
- **`guest_booth`** — seven guest-ACTIVITY branches (massage chair · perfume bar · arcade/games · henna/tattoo · mini nail bar · tarot/astrology/palmistry · caricature/calligraphy/painting). `photobooth` exists but means the photo booth specifically. Drinks and food booths are **not** here — they map to `mobile_bar` / `catering` / `cake_maker`, the trades that actually supply them.

**⚠ THE ENUM WAS ALREADY AHEAD OF THE CODE.** It carried **51** values while the TypeScript union listed **45**: `bridal_gown`, `groom_suit`, `bridal_shoes`, `groom_shoes`, `entourage_attire`, `parents_attire` all exist in the database and are unknown to the app. Deliberately NOT surfaced here — they overlap `gown_designer` / `suit_designer`, so exposing them is a product decision, not a side effect of this fix. Recorded so the next reader doesn't mistake the gap for damage. (Worth noting the owner's expo reference lists **Shoes** as its own booth category, and `bridal_shoes` / `groom_shoes` are sitting there unused.)

**🛡 `tests/db/no-service-lands-in-misc.db.test.ts` — 6 cases, mutation-verified.** It reads the **LIVE** taxonomy rather than a fixture, because the whole failure mode is code falling behind a tree that admins edit at runtime; a hand-written expectation list would drift exactly as the leaf map did, and go green doing it.
- a META case asserts the taxonomy is actually populated, so "0 offenders" can't mean "nothing was checked"
- it fails on any branch missing from the map **even with zero leaves today** — an empty branch is precisely where the next leaf gets added
- it checks the branch map against the **DATABASE enum**, not just the TypeScript union: those are two hand-maintained lists that were *already* out of step, and a typo would be REJECTED at the column rather than thrown — silent, in this codebase's recurring shape
- removing the `food_cart` branch (8 leaves) turns two independent cases red; restoring it turns them green

Compile-time drift protection did its share too: `VendorCategory` feeds three exhaustive `Record<VendorCategory, …>` maps (label · icon · canonical tile), so TypeScript refuses to let a new category be half-added.

SPEC IMPACT: `Vendor_Onboarding_Redesign_Verdict_2026-07-21.md` — the "wrong-canonical landing fails SILENTLY" risk it names is now partly closed: a service can no longer land in a bucket that means nothing. `DECISION_LOG.md` row added.

### Follow-up in the same PR — CI refused the first cut, correctly

The `typecheck + lint` job went red on two independent counts, and both were the change being **half done**:

**1 · A new category with no planning card is swept into "Logistics & Misc".** `shortlist-taxonomy-coverage.test.ts` asserts that every unbucketable `vendor_category` is one of the 14 known gap leaves. `wellness_fitness` and `guest_booth` were not, so picks under them would have landed in the catch-all — **the exact outcome the owner rejected**, arriving through a different door. The guard was right to stop it.

`GAP_LEAF_PARENT` was considered and **rejected for both**: it is the *declaration* that a category is deliberately swept into Logistics & Misc, so taking that route would have satisfied the test by conceding the point. It also could not have worked for `guest_booth` — a gap leaf must be a live tier-2 tile whose id equals the category name, and `guest_booth` is an alias spanning seven tiles. **Both 14-entry tables are untouched.**

Two real plan groups instead:
- **Wellness & fitness** — Big-bookings tier, 6 months out (derma and dental courses run 3–6 months before the first fitting), `catalogTile: 'wellness_fitness'`. NOT folded into Hair & Makeup: the tile bridge is first-writer-wins, so a bridal spa would have silently rendered under the HMUA tile.
- **Guest booths & activities** — Extras tier, 3 months out, sitting beside the existing Cocktail Booths and Photobooth cards. **Deliberately no `catalogTile`** — the category is an alias over seven tiles and pinning one would re-file the other six onto it.

🪤 **A `countsTowardLockable: false` variant was drafted and dropped.** It would have rendered a Lock button (`bench-card-actions.ts` keys on `planGroupForCategory`) while `countUnlockedCategories` skipped the group in both numerator and denominator — a control that moves nothing. It was also a regression on today: a wellness vendor currently stores `misc`, buckets into `logistics`, and counts. Both variants compiled and passed identically, so **CI could not have caught this** — it was a judgement call, and the honest answer is to count them.

**2 · An unrelated hard-coded count.** The same file pinned `VENDOR_CATEGORIES.length === 45`; the enum is now 47. Its own message says "re-derive the contract before editing this number" — done, the two new values are the ones above.

**Also fixed while in there: the inverse tile bridge was single-valued.** `CATEGORY_TO_TILE` maps one tile per category, so an alias category only ever claimed its FIRST tile and the rest fell to `misc` — meaning the new card's own hint advertised six activities while five of them still stored `misc`. An alias pass now walks the full inverse. Measured: couple-side tiles resolving to `misc` drop **45 → 34 of 71**, and all seven booth tiles flip to `guest_booth`.

⏭ **Those remaining 34 are pre-existing and NOT closed here** — they are categories with no planning card (choreographer, performers, av_production, the 14 gap leaves and friends). Closing them means adding ~11 planning cards to every couple's wedding plan, which is an owner product decision, not a taxonomy repair. The **vendor** side, which is what this PR is about, is now **0 of 246**.

Verified: 7191/7191 unit tests · 6/6 the new db guard · 19/19 the two files that were red · all 20 `lint-*.mjs`. Mutation-checked independently of the workflow that proposed it — deleting the `guest_booth` plan group turns `shortlist-taxonomy-coverage.test.ts` red and restoring it turns it green.
