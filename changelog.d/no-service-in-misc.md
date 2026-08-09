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
