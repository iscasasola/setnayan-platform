/**
 * preservation-is-counted-not-measured.test.ts
 *
 * 🔒 OWNER-LOCKED 2026-08-10, after two corrections in one sitting:
 *
 *   **₱500/year = 3,000 photos OR 150 videos, or any combination** (a video = 20
 *   photos), running from the day they buy. **Free = the compressed copy of
 *   everything, kept five years** — past five it becomes a paid option and
 *   NOTHING is deleted. So what is sold is **resolution, not space**.
 *
 * Owner, verbatim: *"do not price by drive. price by number of photos and
 * videos"* · *"we will preserve it compressed so they still keep it. we just
 * allow them to preserve it"* · *"if the pay nothing, we still keep their photos
 * for 5 years. but compressed."*
 *
 * ## The three mistakes this file exists to stop
 *
 * **1 · A gigabyte reaching a customer.** The unit is a count, everywhere — the
 * meter, the allowance, the bill and the copy. A byte figure is not a friendlier
 * label away from being correct; it is the wrong unit.
 *
 * **2 · Billing for a compressed copy.** Once an original has been replaced, the
 * capture lives as its compressed copy, which is FREE for five years for
 * everyone. Charging for it bills a couple for the tier they did not buy.
 *
 * **3 · Losing the clips.** The byte model needed an `unmeasured` flag because a
 * clip's raw video has no recorded size, so the events that cost the most would
 * have been billed the least while their meter read low. Counting removes that at
 * the root — a clip is one row worth 20 units whether or not anyone sized it.
 *
 * ⚠ The first figure the owner gave was 1,000 photos. It was raised to 3,000
 * after the arithmetic was put to him: against the shot pools actually sold
 * (3,000 / 6,000 / 10,000), 1,000 would have asked a couple who spent ₱3,000 on
 * shots for ₱5,000 a year to keep them — pricing the best customers onto Google
 * Drive. 3,000 matches the smallest pool exactly, so the sentence is "the pool you
 * bought is the pool you keep".
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRESERVATION_BLOCK_UNITS,
  CLIP_UNITS,
  PRESERVATION_BLOCK_PHP,
  preservationUnits,
  aggregateAccountPreservation,
  blocksNeeded,
  allowanceUnits,
  preservationMeter,
  type StoredRow,
} from './papic-storage-telemetry';

const photo = (dropped = false): StoredRow => ({
  orig_bytes: 4_000_000,
  display_bytes: 300_000,
  thumb_bytes: 20_000,
  full_res_dropped_at: dropped ? '2026-01-01T00:00:00Z' : null,
  is_clip: false,
});

const clip = (dropped = false): StoredRow => ({
  // A clip's original is structurally unsized — that is the point.
  orig_bytes: null,
  display_bytes: 0,
  thumb_bytes: 0,
  clip_web_bytes: 1_100_000,
  full_res_dropped_at: dropped ? '2026-01-01T00:00:00Z' : null,
  is_clip: true,
});

test('the locked numbers are the locked numbers', () => {
  assert.equal(PRESERVATION_BLOCK_UNITS, 3_000, '₱500 buys 3,000 photos');
  assert.equal(CLIP_UNITS, 20, '3,000 photos ÷ 150 videos = 20');
  assert.equal(PRESERVATION_BLOCK_PHP, 500);
  // The owner stated both limbs; they must describe ONE block, or "any
  // combination" is a slogan rather than a rule.
  assert.equal(
    PRESERVATION_BLOCK_UNITS / CLIP_UNITS,
    150,
    'one block must be 3,000 photos OR 150 videos — the two limbs have drifted apart',
  );
});

test('a video costs twenty photos', () => {
  assert.equal(preservationUnits(photo()), 1);
  assert.equal(preservationUnits(clip()), CLIP_UNITS);
});

test('AN ALREADY-COMPRESSED CAPTURE COSTS NOTHING — it is the free tier', () => {
  assert.equal(
    preservationUnits(photo(true)),
    0,
    'billed a photo whose original was already replaced — that is the compressed ' +
      'copy everybody gets free for five years',
  );
  assert.equal(preservationUnits(clip(true)), 0);
});

test('3,000 photos is exactly one block; 3,001 is two', () => {
  assert.equal(blocksNeeded(3_000), 1);
  assert.equal(blocksNeeded(3_001), 2);
  assert.equal(allowanceUnits(1), 3_000);
  assert.equal(allowanceUnits(2), 6_000);
});

test('150 videos is exactly one block — the other limb of the same promise', () => {
  const rows = Array.from({ length: 150 }, () => clip());
  const acct = aggregateAccountPreservation(rows);
  assert.equal(acct.unitsHeld, 3_000);
  assert.equal(acct.blocksNeeded, 1);
  assert.equal(acct.annualPhp, 500);
});

test('any combination adds up — 1,000 photos + 100 videos is one block', () => {
  const rows = [
    ...Array.from({ length: 1_000 }, () => photo()),
    ...Array.from({ length: 100 }, () => clip()),
  ];
  const acct = aggregateAccountPreservation(rows);
  assert.equal(acct.unitsHeld, 1_000 + 100 * CLIP_UNITS); // 3,000
  assert.equal(acct.blocksNeeded, 1, 'the two limbs must be interchangeable, not additive tiers');
});

test('a couple who let their originals go pays for one block, not for their whole history', () => {
  // 5,000 photos shot, all already compressed, plus 500 originals still held.
  const rows = [
    ...Array.from({ length: 5_000 }, () => photo(true)),
    ...Array.from({ length: 500 }, () => photo()),
  ];
  const acct = aggregateAccountPreservation(rows);
  assert.equal(acct.captures, 5_500, 'every capture is still theirs — nothing was deleted');
  assert.equal(acct.originalsHeld, 500);
  assert.equal(acct.unitsHeld, 500);
  assert.equal(acct.blocksNeeded, 1);
  assert.equal(acct.annualPhp, 500);
});

test('the clip-heavy account is the EXPENSIVE one, not the cheap one', () => {
  // The byte model's failure: clip raws had no size, so this account summed near
  // zero and was billed least while costing most.
  const clips = aggregateAccountPreservation(Array.from({ length: 300 }, () => clip()));
  const photos = aggregateAccountPreservation(Array.from({ length: 300 }, () => photo()));
  assert.ok(
    clips.unitsHeld > photos.unitsHeld,
    'a 300-clip account must cost more than a 300-photo one',
  );
  assert.equal(clips.blocksNeeded, 2, '300 clips = 6,000 units = 2 blocks');
  assert.equal(photos.blocksNeeded, 1);
});

test('the meter is a percentage of a COUNT, and it can exceed 100', () => {
  assert.equal(preservationMeter(1_500, 1).percentUsed, 50);
  assert.equal(preservationMeter(3_000, 1).percentUsed, 100);
  assert.equal(preservationMeter(3_000, 1).withinAllowance, true);
  const over = preservationMeter(4_500, 1);
  assert.equal(over.percentUsed, 150);
  assert.equal(over.withinAllowance, false, 'over the paid count must read as over');
});

test('NO GIGABYTE ESCAPES INTO THE PRESERVATION MODEL', () => {
  // The unit is a count everywhere. A byte-shaped field on any of these results
  // is how "price by drive" comes back — the owner corrected it once already,
  // in a row written to record a different decision.
  const acct = aggregateAccountPreservation([photo(), clip()]) as Record<string, unknown>;
  const meter = preservationMeter(21, 1) as Record<string, unknown>;
  for (const [key] of [...Object.entries(acct), ...Object.entries(meter)]) {
    assert.ok(
      !/gb|byte|bytes/i.test(key),
      `"${key}" is byte-shaped — the customer-facing preservation model must count ` +
        `photos and videos, never measure storage`,
    );
  }
});

test('there is no free allowance to grant — the free tier is the compressed copy', async () => {
  const mod = await import('./papic-storage-telemetry');
  assert.ok(
    !('STORAGE_BUFFER_GB' in mod),
    'the 5 GB buffer is back. There is no free photo count: a couple who pays ' +
      'nothing keeps everything compressed for five years, which is the free tier. ' +
      'A gigabyte allowance is still pricing by drive.',
  );
});
