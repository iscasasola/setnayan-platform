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
  // ── T1 · THE PHILIPPINE TAXONOMY (2026-11-13, migration 20271341706505) ──────────────
  // Every delta below is (✚ new visible) − (⇢ folded) − (⛔ hidden) ± (moved), re-derived
  // from the plan, not bumped to match: 71 new visible − 36 folded − 15 hidden = +20.
  // 28 → 18: ✚ other place of worship (+1) · ⇢ Born Again + 9 faiths into it/Christian (−10) ·
  // ⇢ accommodation into hotel stay (−1).
  venue: 18,
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
  // 17 → 17: ✚ PSA / CENOMAR runner (+1) · ⛔ visa logistics (−1).
  planning: 17,
  // 7 → 11: ✚ christening package · fast-food party · packed meals · wake catering.
  feast: 11,
  // 26 → 29 on 2026-10-01: the three Chairs & tents rentals (chair_table_rental ·
  // tent_canopy_rental · event_lights_rental) — new services, every other
  // folder unchanged.
  // 29 → 26 (T1): ✚ 6 (proposal · balloon · cold sparks · lounge · stage & truss · ribbon) ·
  // ⇢ 5 (decorator general · 3 lights/sound · tent) · ⛔ 4 (chuppah · bug · parasol · weather).
  design: 26,
  // 20 → 33 (T1): ✚ 15 (8 kids' party · kids' host · videoke · fire dancers · cotillion ·
  // family dance · booth builder · team-building) · ⇢ 2 (band/live music · pre-Cana dance).
  program: 33,
  // 12 → 9 (T1): ✚ toga & class photos · ⇢ engagement · highlight reel · drone videographer ·
  // ⛔ boudoir.
  documentary: 9,
  // 54 → 62 on 2026-11-07: the eight Ceremony essentials services (owner "add that to the
  // taxonomy") — new services, nothing moved.
  // 62 → 60 (T1): ✚ 6 (baptismal · toga & cap · costumes · 3 shoes) · ⇢ 3 (hair stylist ·
  // maternity · mature MUA) · ⛔ 5 (garter · 4 bridal wellness).
  look: 60,
  // 42 → 43 on 2026-11-07: the photoman (instant prints), a new Photo booth service. Hiding
  // `pabati` the same day changes nothing here: it was already excluded as a Setnayan row.
  // 43 → 52 (T1): ✚ 21 (juice bar · 10 food carts · 10 make & take) · ⇢ 8 · ⛔ 4 (tarot ·
  // palmistry · silhouette · poetry typewriter).
  booths: 52,
  // 15 → 12 (T1): the 5 souvenir services MOVED to the new Gifts group (−5) · ✚ 4 (tarpaulin ·
  // prayer cards · diploma · tickets) · ⇢ 2 (cards designer · digital save-the-date).
  prints: 12,
  // NEW (T1): the 5 souvenir services that left `prints` + ✚ 10 gift items.
  gifts_giveaways: 15,
  // 11 → 9 (T1): ⇢ van rental · private car charter into the guest shuttle.
  transport: 9,
  experience: 2,
  dining: 1,
  // 2 → 4 (T1): ✚ event staff & ushers · security guards.
  logistics_safety: 4,
  insurance: 3,
  specialty: 1,
  // NEW 2026-08-27 (second change that day): a wake's own trades — owner ruled
  // yes to listing death-care suppliers. 12 services under three tiles
  // (funeral home · cremation · memorial park).
  //
  // 🔑 THE ARITHMETIC AGAIN: +12 here and EVERY OTHER FOLDER UNCHANGED. These
  // are new services, not moved ones — nothing left another folder to get here,
  // which is what a -n/+n pair would have shown.
  farewell: 12,
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

test('the countable total is 285 of the 373 taxonomy entries', () => {
  const total = Object.values(FOLDER_SERVICE_COUNT).reduce((a, b) => a + b, 0);
  assert.equal(
    total,
    // 236 + the 5 put on sale 2026-08-27 + the 12 farewell services added the
    // same day = 253, + the 3 Chairs & tents rentals 2026-10-01 = 256, + the 8 Ceremony
    // essentials and the photoman 2026-11-07 = 265, + T1 2026-11-13 (71 new visible − 36
    // folded − 15 hidden) = 285.
    // Re-derived from the deltas, not bumped to match.
    285,
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
