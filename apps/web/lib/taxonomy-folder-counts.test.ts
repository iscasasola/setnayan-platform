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
const BASELINE: Record<string, number> = {
  venue: 28,
  // 12 → 17 on 2026-08-27. The owner opened `wedding_paperwork` (3 services)
  // and `travel_honeymoon` (2) to the marketplace, and Paperwork & Government
  // moved from the `venue` folder to `planning` in the same change.
  //
  // 🔑 THE ARITHMETIC IS THE PROOF THAT NOTHING ELSE MOVED: +5 here and `venue`
  // UNCHANGED at 28. The three paperwork services left `venue` but were
  // marketplace-hidden, so they were never in its count to begin with — a
  // folder move alone would have shown as -3/+3. Seeing +5/-0 is what says the
  // delta is exactly the five services that went on sale, and no exclusion was
  // quietly dropped (which is the failure this baseline exists to catch).
  planning: 17,
  feast: 7,
  design: 26,
  program: 20,
  documentary: 12,
  look: 54,
  booths: 42,
  prints: 15,
  transport: 11,
  experience: 2,
  dining: 1,
  logistics_safety: 2,
  insurance: 3,
  specialty: 1,
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

test('the countable total is 241 of the 276 taxonomy entries', () => {
  const total = Object.values(FOLDER_SERVICE_COUNT).reduce((a, b) => a + b, 0);
  assert.equal(
    total,
    // 236 + the 5 services the owner put on sale 2026-08-27.
    241,
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
