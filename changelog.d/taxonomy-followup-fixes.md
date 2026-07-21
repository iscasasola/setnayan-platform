## 2026-07-21 · fix(taxonomy): venue anonymity vocabulary + third dead tile + guard that can't be faked

Follow-up to PR #3477 (`claude/taxonomy-dead-tiles-v2`). Six review findings,
all verified against prod (`njrupjnvkjkitfctetvi`) before fixing.

### 1. Venue name-anonymity applied to none of the 23 new canonicals (MEDIUM/HIGH)

`VENUE_EXEMPT_SERVICES = ['religious_venue','venue']` in `lib/vendors.ts` was
matched against `vendor_profiles.services`, which is a **mixed vocabulary**:
coarse `vendor_category` values (profile picker + the `20260529000000` venue
seed) *and* canonical service keys (`syncProfileFromCoverages` writes the
covered leaves back). The list named only the coarse pair, so every canonical
seeded by #3477 — `catholic_church_venue`, `hotel_ballroom`, … — lost the
exemption. A parish or function hall declaring itself through the Coverage
picker (the **only** self-serve path) would have been anonymized as
"Manila Ceremony Venue #12", which is the one case the exemption exists for.

`isVendorVenueExempt` now checks both vocabularies, and the canonical half is
**derived** from `TAXONOMY_MAP` (tile ∈ `ceremony_venue` / `reception`) instead
of hand-listed, so a leaf seeded later is exempt the day it lands.

**Vendors whose name state changes: ZERO.** Measured, not assumed — prod has 47
`vendor_profiles` (46 demo), **none** carry `venue` / `religious_venue` (the
2026-05-29 venue-directory rows are gone from prod) and **none** carry any
venue-tile canonical. The fix is entirely forward-looking. `accommodation`
(tile `reception`) is now exempt too — a hotel is exactly the "couples search
it by name" case; zero prod vendors list it.

### 2. Faith parity was one key short (LOW)

#3477 claimed "one place of worship per live `faith_vocab` key" but seeded 16 of
the **17** active keys — `Chinese` was missing, despite already having 5 Tsinoy
specialist leaves (`20270310764093`) and its own `ceremony_type='chinese'`.
Adds `chinese_temple_venue` ("Chinese Temple / Ancestral Hall", `faith='Chinese'`,
`is_ph`) and a unit test that fails when a faith key has no room.

### 3. Civil ceremonies rendered under a religious label (LOW)

`civil_ceremony_venue → 'religious_venue'` is **kept** — that enum value is what
the CEREMONY plan group reads while `venue` routes to the RECEPTION card, so
remapping would land a city-hall booking on the reception card. The **label**
was the bug: `VENDOR_CATEGORY_LABEL.religious_venue` is now **"Ceremony Venue"**
(was "Religious Ceremony Venue"). Renaming the enum instead would need an
`ALTER TYPE` + backfill + plan-group rewrite to fix a string.

### 4. Migration assertions policed rows they did not write

`20270830256997`'s assertions (d) blank-display-name and (e) no-event-type-scope
were scoped `tile_id IN ('ceremony_venue','reception')`, so they also policed
pre-existing rows such as `accommodation` — an unrelated admin edit could abort
the migration and block the push. Both are now scoped to the 23 inserted ids.
Safe to edit in place: **verified unapplied in prod** (top ledger row is
`20270830038893`).

### 5. `applicable_event_types` NULL semantics are not uniformly fail-open

The migration header claimed "NULL = universal = fail-open". True of the vendor
coverage picker, `parseEventTypes`, and both admin scope editors — **false** of
`lib/leaf-suggestions-core.ts`, which reads NULL as **wedding-only**
(fail-CLOSED) so a recommender can't push a wedding coordinator at a birthday.
The inversion is correct and stays; the silence was the defect. New
`lib/taxonomy-event-scope.ts` states both rules, explains the split (offering →
fail-open, volunteering unasked → fail-closed), is consumed by all four
surfaces, and is locked by tests. Migration header corrected. Matters beyond
this PR: owner decision 3 would have relied on the wrong half.

### 6. A THIRD dead tile — and the guard was counting a hard-code (🚨)

`filipiniana_barongs` reported 10 canonicals **only** because
`vendor-counts.ts` hard-coded `map.set('filipiniana_barongs', […])`. Zero
`TAXONOMY_MAP` rows and zero prod `canonical_service_taxonomy` rows named the
tile (verified). Marketplace advertised it; the vendor picker pruned it.

- **Data fix:** the 10 attire leaves cross-list via `secondary_tiles`, like
  `accommodation → catering` and every other cross-view. They keep their
  primary attire tile — nothing is re-homed, no vendor re-bucketed. Both
  hard-coded overrides (sync + DB paths) are deleted.
- **Guard fix (the durable half):** `taxonomy-tile-reachability.test.ts` now
  re-derives tile → canonicals from `TAXONOMY_MAP` alone and asserts it equals
  `canonicalServicesForTile()` **exactly, per tile**. Any future `map.set`
  injection fails ("injected=[…]"), and any dropped cross-listing fails too.
  Verified by temporarily re-adding an injection: 5 pass / 1 fail, restored: 6/6.
  A dead tile can no longer be made to *look* alive.

### 🚨 DEPLOYMENT GAP — owner action

Both couple-facing surfaces read the **DB**, not the TS map (`/explore` via
`getCanonicalBuckets()`, and category-search). Neither `20270830256997` (#3477)
nor `20270830324110` (this PR) is applied to prod, and **nothing in CI enforces
that**. Until they are pushed, `ceremony_venue` stays empty and
`filipiniana_barongs` now resolves to zero on the DB path (the override used to
hide that on one side only — the tile was undeclarable by vendors either way).
Not pushed by this PR.

SPEC IMPACT: `Taxonomy_Expo_Gap_Verdict_2026-07-21.md` — the "one room per
faith" claim was 16/17 (Chinese added); `filipiniana_barongs` is confirmed as
the third instance of the dead-tile class and is now fixed in data, not by an
override. The venue name-anonymity rule (CLAUDE.md 2026-05-30 refinement row)
should be restated as "venue **tiles**", not "venue category values".
