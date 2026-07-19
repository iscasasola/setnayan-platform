/**
 * The 14 taxonomy GAP LEAVES for non-wedding event types (2026-07-20 ·
 * Whats_Next_Suite_AI_Pricing §gap-leaves + Setnayan_AI_Gap_Leaves_Travel_
 * Dinner_Date_2026-07-17 Part A) — unit-level proof that the data maps the
 * /admin/taxonomy Studio renders from are complete and mutually consistent:
 *
 *   • every leaf is a live tier-2 tile under its Part-A family
 *     (tile order + parent + label + slug — what the Studio tree shows);
 *   • the 12 NET-NEW canonicals place at their same-named tile via
 *     TAXONOMY_MAP (the Studio's service→tile placement read);
 *   • the couple-side VendorCategory vocabulary carries all 14 keys with
 *     labels + a canonical tile anchor that survives the runtime drift check
 *     (validateVendorCategoryMapping) against the fallback snapshot;
 *   • `performers` + `choreographer` are RECONCILED (pre-existing tiles, no
 *     duplicate canonical minted);
 *   • `reveal_element` — previously a checklist-only key — is now a real
 *     taxonomy node under the exact id the gender_reveal checklist def uses.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TAXONOMY_MAP,
  TILE_PARENT,
  WEDDING_FOLDER_ORDER,
  WEDDING_TILE_LABEL,
  WEDDING_TILE_ORDER,
  WEDDING_TILE_SLUG,
  type WeddingFolder,
  type WeddingTile,
} from './taxonomy';
import { fallbackSnapshot } from './taxonomy-snapshot';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from './vendors';
import {
  VENDOR_CATEGORY_CANONICAL,
  tilesForVendorCategory,
  validateVendorCategoryMapping,
} from './vendor-category-taxonomy';
import { EVENT_TYPE_CHECKLIST_DEFS } from './checklist-event-type-defs';

/** leaf → its Part-A family (folder). The two pre-existing PROGRAM tiles are
 *  the "program/production" + "program" rows of the doc's matrix. */
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
const NET_NEW = GAP_LEAVES.filter((l) => l !== 'performers' && l !== 'choreographer');

test('all 14 gap leaves are live tier-2 tiles under their Part-A family', () => {
  assert.equal(GAP_LEAVES.length, 14, 'the doc lists exactly 14 gap leaves');
  for (const leaf of GAP_LEAVES) {
    assert.ok(WEDDING_TILE_ORDER.includes(leaf), `${leaf}: not in WEDDING_TILE_ORDER`);
    assert.equal(TILE_PARENT[leaf], GAP_LEAF_PARENT[leaf], `${leaf}: wrong parent family`);
    assert.ok(WEDDING_TILE_LABEL[leaf], `${leaf}: missing tile label`);
    assert.ok(WEDDING_TILE_SLUG[leaf], `${leaf}: missing tile slug`);
  }
  for (const folder of ['experience', 'dining', 'logistics_safety', 'insurance', 'specialty'] as const) {
    assert.ok(WEDDING_FOLDER_ORDER.includes(folder), `new family "${folder}" not in folder order`);
  }
});

test('the 12 net-new canonicals place at their same-named tile (the admin Studio placement read)', () => {
  for (const leaf of NET_NEW) {
    const entry = TAXONOMY_MAP[leaf];
    assert.ok(entry, `${leaf}: no TAXONOMY_MAP canonical`);
    assert.equal(entry.tile, leaf, `${leaf}: canonical must place at its same-named tile`);
    assert.equal(entry.folder, GAP_LEAF_PARENT[leaf], `${leaf}: canonical folder mismatch`);
    assert.notEqual(entry.marketplaceHidden, true, `${leaf}: gap leaf must be marketplace-visible`);
  }
});

test('performers + choreographer are reconciled, not duplicated (no new canonical minted)', () => {
  // The tiles pre-exist with their own canonical rosters (acoustic_performer,
  // first_dance_choreographer, …) — the gap-leaves build must NOT mint a
  // same-named canonical on top of them.
  assert.equal(TAXONOMY_MAP['performers'], undefined);
  assert.equal(TAXONOMY_MAP['choreographer'], undefined);
  // But they remain live tiles a couple-side category can anchor to.
  assert.ok(WEDDING_TILE_ORDER.includes('performers'));
  assert.ok(WEDDING_TILE_ORDER.includes('choreographer'));
});

test('couple-side VendorCategory carries all 14 keys with labels + a service group', () => {
  const grouped = new Set<VendorCategory>(SERVICE_GROUPS.flatMap((g) => [...g.members]));
  for (const leaf of GAP_LEAVES) {
    const cat = leaf as string as VendorCategory;
    assert.ok(VENDOR_CATEGORIES.includes(cat), `${leaf}: not in VENDOR_CATEGORIES`);
    assert.ok(VENDOR_CATEGORY_LABEL[cat], `${leaf}: missing couple-side label`);
    assert.ok(grouped.has(cat), `${leaf}: not a member of any SERVICE_GROUP`);
    // 1:1 tile anchor (bucket A) — the marketplace deep-link target.
    const anchor = VENDOR_CATEGORY_CANONICAL[cat];
    assert.equal(anchor.kind, 'tile', `${leaf}: must anchor to a single tile`);
    assert.deepEqual(tilesForVendorCategory(cat), [leaf], `${leaf}: anchor tile mismatch`);
  }
});

test('no vendor-category drift against the taxonomy snapshot (what /admin/taxonomy runs)', () => {
  // The admin page calls validateVendorCategoryMapping(tax) on the live DB
  // snapshot; the fallback snapshot mirrors the seeded tree, so drift here
  // means the migration seed and the code maps diverged.
  assert.deepEqual(validateVendorCategoryMapping(fallbackSnapshot()), []);
});

test('fallback snapshot renders every gap leaf (tile order + label + parent bucket)', () => {
  const snap = fallbackSnapshot();
  for (const leaf of GAP_LEAVES) {
    assert.ok(snap.tileOrder.includes(leaf), `${leaf}: missing from snapshot tileOrder`);
    assert.ok(snap.tileLabel[leaf], `${leaf}: missing snapshot label`);
    const parent = GAP_LEAF_PARENT[leaf];
    assert.ok(parent, `${leaf}: no expected parent in the test fixture`);
    assert.ok(
      (snap.tilesByParent[parent] ?? []).includes(leaf),
      `${leaf}: not bucketed under "${parent}" in the snapshot`,
    );
  }
});

test('reveal_element reconciles the gender_reveal checklist def (checklist key = taxonomy id)', () => {
  const def = EVENT_TYPE_CHECKLIST_DEFS.gender_reveal;
  assert.ok(def, 'gender_reveal checklist def exists');
  assert.ok(def.tier2Core.includes('reveal_element'), 'checklist still names reveal_element');
  assert.ok(
    WEDDING_TILE_ORDER.includes('reveal_element'),
    'reveal_element is now a real taxonomy tile under the exact checklist key',
  );
});
