/**
 * taxonomy-folder-counts.test.ts
 *
 * Pins the fifteen numbers a customer reads — in the front door's rail and in
 * the marketplace search panel, which now share one definition.
 *
 * ⚠ THIS IS NOT A FREEZE ON THE TAXONOMY. Adding a real service SHOULD change
 * a number here, and updating this file is the correct response. What it stops
 * is the number changing WITHOUT ANYONE NOTICING — because these are promises
 * ("12 services in Photo & video") shown to somebody deciding whether to click,
 * and the two exclusions that make them true (`marketplaceHidden`, `setnayan`)
 * are subtle enough that a future edit could drop one and inflate every folder
 * with things no shop provides.
 *
 * The baseline is the set measured on 2026-08-12 for
 * `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` § 1, re-verified 2026-08-13.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { WEDDING_FOLDER_ORDER, WEDDING_FOLDER_LABEL } from './taxonomy';
import {
  FOLDER_SERVICE_COUNT,
  folderServiceCount,
  FRONT_DOOR_VISIBLE_FOLDERS,
  FRONT_DOOR_MORE_FOLDERS,
} from './taxonomy-folder-counts';

/** The measured baseline — every one verified against the shipped taxonomy. */
// TAXONOMY V2 (owner-approved 2026-11-06, DECISION_LOG "TAXONOMY V2 APPROVED") re-measured every
// folder. These are NOT bumped to match: each equals the count of v2's picker services whose category
// sits in that folder (supabase/data/taxonomy-v2-2026-11-06.json), and the services the merge folded
// are now marketplace-hidden specialties — which is exactly the exclusion this file protects.
// The one difference is `look`: v2 lists 11, the code counts 10, because v2's "Shoes"
// (`custom_made_shoes`) is an admin-made service that exists only in production and has never had a
// code entry. Pre-v2 history of each number is in git (`git log -p` on this file).
const BASELINE: Record<string, number> = {
  venue: 4,
  planning: 4,
  feast: 4,
  design: 14,
  program: 9,
  documentary: 4,
  look: 10,
  booths: 9,
  prints: 4,
  transport: 3,
  experience: 1,
  dining: 1,
  // 2 → 6: v2 adds Staff, security & registration (new category, 4 NEW services).
  logistics_safety: 6,
  insurance: 1,
  specialty: 1,
  // v2 adds Prayers & novena (new category) here; the death-care trades folded to fewer services.
  farewell: 8,
};

test('every folder count matches the measured baseline', () => {
  const drift: string[] = [];
  for (const f of WEDDING_FOLDER_ORDER) {
    const got = folderServiceCount(f);
    const want = BASELINE[f];
    if (got !== want) {
      drift.push(`${WEDDING_FOLDER_LABEL[f]}: ${want} → ${got}`);
    }
  }
  assert.deepEqual(
    drift,
    [],
    `folder service counts moved. If a real service was added this is correct — ` +
      `update the baseline. If not, an exclusion was dropped: ${drift.join(' · ')}`,
  );
});

test('the countable total is 83 — v2\'s 84 picker services less the prod-only Shoes', () => {
  const total = Object.values(FOLDER_SERVICE_COUNT).reduce((a, b) => a + b, 0);
  assert.equal(
    total,
    // Taxonomy v2 (2026-11-06): 84 picker services, of which `custom_made_shoes` has no code entry
    // (admin-made in production). Re-derived from v2's own list, not bumped to match.
    83,
    'the two exclusions (marketplaceHidden, setnayan) must both still apply',
  );
});

test('the five visible folders are the booking-order five, not the biggest five', () => {
  assert.deepEqual(
    [...FRONT_DOOR_VISIBLE_FOLDERS],
    ['venue', 'feast', 'documentary', 'look', 'program'],
  );
  // The point of the rule, asserted rather than described: ranking by count
  // would put Booths (42) above Catering (7) and the church (28).
  assert.ok(
    folderServiceCount('booths') > folderServiceCount('feast'),
    'if this ever flips, the reasoning in the module docblock needs revisiting',
  );
  assert.ok(
    !FRONT_DOOR_VISIBLE_FOLDERS.includes('booths'),
    'Booths is the fun, late, optional spend — it belongs under Show more',
  );
});

test('visible and more together are every folder, with no overlap', () => {
  const all = [...FRONT_DOOR_VISIBLE_FOLDERS, ...FRONT_DOOR_MORE_FOLDERS];
  assert.equal(all.length, WEDDING_FOLDER_ORDER.length);
  assert.equal(new Set(all).size, all.length, 'a folder appears twice in the rail');
  for (const f of WEDDING_FOLDER_ORDER) {
    assert.ok(all.includes(f), `${f} is missing from the rail entirely`);
  }
});
