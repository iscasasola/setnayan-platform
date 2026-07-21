/**
 * Coverage contract for the Shortlist's category → tile bridge
 * (`CATEGORY_TO_TILE` in lib/shortlist-taxonomy.ts).
 *
 * WHY this file exists: `buildShortlistFolders` does `if (!tile) continue;` —
 * a category with no tile means the couple's CONSIDERED vendor is dropped from
 * the Shortlist tab entirely, silently. Until 2026-07-21 the bridge's docstring
 * claimed to be "exhaustive over the enum" while missing the 14 non-wedding gap
 * leaves (tour_guide, referee_official, …), so a travel / tournament /
 * corporate / birthday / gender-reveal pick vanished. The contract asserted
 * here is ALL 45 enum values map — and the placements are locked so nobody
 * "simplifies" a tour guide onto a wedding tile.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tileForCategory, categoryForTile } from './shortlist-taxonomy';
import { primaryTileForVendorCategory } from './vendor-category-taxonomy';
import { VENDOR_CATEGORIES, type VendorCategory } from './vendors';
import { TILE_PARENT, WEDDING_TILE_ORDER, type WeddingFolder, type WeddingTile } from './taxonomy';

/** Same table shape as lib/taxonomy-gap-leaves.test.ts — the ADMIN-side proof
 *  that these 14 leaves live under non-wedding tier-1 families. Duplicated
 *  deliberately: this file locks the COUPLE-side bridge to those same families,
 *  so if the two ever disagree one of the two suites goes red. */
const GAP_LEAF_PARENT: Record<string, WeddingFolder> = {
  referee_official: 'logistics_safety',
  event_medic: 'logistics_safety',
  tour_activity: 'experience',
  tour_guide: 'experience',
  travel_insurance: 'insurance',
  av_production: 'program',
  speaker_talent: 'program',
  performers: 'program',
  kids_entertainer: 'program',
  choreographer: 'program',
  reveal_element: 'specialty',
  event_insurance: 'insurance',
  personal_accident_insurance: 'insurance',
  restaurant_reservation: 'dining',
};
const GAP_LEAVES = Object.keys(GAP_LEAF_PARENT) as WeddingTile[];

test('every VendorCategory bridges to a tile (no considered pick is ever dropped)', () => {
  assert.equal(
    VENDOR_CATEGORIES.length,
    45,
    'enum size changed — re-derive the contract before editing this number',
  );
  for (const c of VENDOR_CATEGORIES) {
    assert.ok(
      tileForCategory(c),
      `${c}: no tile — a considered pick under this category vanishes from the Shortlist`,
    );
  }
});

test('every bridged tile is a LIVE taxonomy tile', () => {
  // Types alone can't catch a tile that was renamed or deleted out of the tree;
  // this is the same runtime intent as validateVendorCategoryMapping().
  for (const c of VENDOR_CATEGORIES) {
    const tile = tileForCategory(c);
    assert.ok(
      tile && WEDDING_TILE_ORDER.includes(tile),
      `${c} → ${tile}: not in WEDDING_TILE_ORDER`,
    );
  }
});

test('the 14 non-wedding gap leaves land on their OWN tile, under a non-wedding family', () => {
  assert.equal(GAP_LEAVES.length, 14);
  for (const leaf of GAP_LEAVES) {
    assert.equal(
      tileForCategory(leaf as unknown as VendorCategory),
      leaf,
      `${leaf}: must anchor 1:1 to its same-named tile, never be re-filed onto a wedding tile`,
    );
    assert.equal(TILE_PARENT[leaf], GAP_LEAF_PARENT[leaf], `${leaf}: wrong tier-1 family`);
  }
});

test('gap-leaf round-trip survives the "Add manually" write-back', () => {
  // categoryForTile() supplies the `category` stored when a couple adds a vendor
  // straight from a tile. Before the bridge fill this returned 'misc' for all 14
  // (which maps back to the `escort` tile) — a silently mis-filed record.
  for (const leaf of GAP_LEAVES) {
    const tile = tileForCategory(leaf as unknown as VendorCategory);
    assert.ok(tile);
    assert.equal(categoryForTile(tile), leaf, `${leaf}: broken tile → category round-trip`);
  }
});

test('canonically-EXEMPT categories still get a Shortlist home', () => {
  // The Shortlist deliberately does NOT delegate wholesale to
  // primaryTileForVendorCategory: officiant / church_fees / security / misc are
  // bucket-C "exempt" (null) in the canonical bridge, but the Shortlist must
  // still park them somewhere or the pick disappears. This assertion is the
  // tripwire — a future refactor to `= primaryTileForVendorCategory` fails here
  // instead of silently dropping four categories' worth of picks.
  for (const c of ['officiant', 'church_fees', 'security', 'misc'] as VendorCategory[]) {
    assert.equal(primaryTileForVendorCategory(c), null, `${c}: expected canonically exempt`);
    assert.ok(tileForCategory(c), `${c}: exempt canonically, but the Shortlist must still place it`);
  }
});
