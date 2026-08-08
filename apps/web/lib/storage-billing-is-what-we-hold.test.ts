import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BYTES_PER_GB,
  STORAGE_BLOCK_GB,
  STORAGE_BUFFER_GB,
  STORAGE_BLOCK_PHP,
  storedBytes,
  aggregateAccountStorage,
  blocksNeeded,
  allowanceGb,
  hardCapGb,
  storageMeter,
  type StoredRow,
} from './papic-storage-telemetry';

/**
 * WE BILL FOR WHAT WE ARE STORING — NOT FOR WHAT WAS ONCE UPLOADED.
 *
 * 🔒 OWNER-LOCKED 2026-08-08: ₱500/year per 10 GB block, charged on ACTUAL stored
 * bytes, accumulating across every event on the ACCOUNT ("this will accumulate all
 * the data they collect on their account"). The customer sees a PERCENTAGE, never a
 * GB figure, and always gets a 5 GB buffer.
 *
 * ── THE MISTAKE THIS EXISTS TO PREVENT ──────────────────────────────────────
 * The byte columns were built for INGEST telemetry — how big was the original when
 * it arrived — so the pricing councils could check the modelled ~8% web-copy ratio.
 * A bill asks the opposite question. After the retention window we REPLACE the
 * original with its compressed copy, so summing `orig_bytes` would invoice a couple
 * whose gallery is 0.4 GB for the 4.4 GB they uploaded a year ago. Same columns,
 * opposite meaning — the "two values that look alike and mean different things"
 * shape this project keeps paying for.
 *
 * 🚨 AND AN UNMEASURED BYTE MUST NEVER LOOK LIKE ZERO. A clip's raw video has no
 * recorded size (the derivative writer deliberately omits `orig_bytes` for clips —
 * a clip's "original" is a video, not the poster still it derives from). Those are
 * the LARGEST objects on the platform. If that silently summed to zero, the
 * clip-heavy events — the ones that cost the most — would be billed the least, and
 * a customer's meter would read reassuringly low while their real usage was far
 * higher. Wrong in both directions at once, with nothing erroring.
 */

const GB = BYTES_PER_GB;

/** A still whose original we are still holding. */
const still = (origGb: number, webGb = 0.01): StoredRow => ({
  orig_bytes: origGb * GB,
  display_bytes: webGb * GB,
  thumb_bytes: 0,
  full_res_dropped_at: null,
  is_clip: false,
});

test('a REPLACED original is not billed — only the compressed copy that survives it', () => {
  const held = still(4);
  const swapped: StoredRow = { ...held, full_res_dropped_at: '2026-08-01T00:00:00Z' };

  assert.equal(storedBytes(held).bytes, 4.01 * GB, 'while held, the original counts');
  assert.equal(
    storedBytes(swapped).bytes,
    0.01 * GB,
    'once replaced, ONLY the compressed copy remains — billing for the original ' +
      'invoices bytes that no longer exist. This is the whole reason the billing ' +
      'view is separate from the ingest telemetry.',
  );
  // Non-vacuity: the two must actually differ, or the filter is doing nothing.
  assert.notEqual(storedBytes(held).bytes, storedBytes(swapped).bytes);
});

test('🚨 a clip whose raw is still held is flagged UNMEASURED, never counted as zero', () => {
  const clip: StoredRow = {
    orig_bytes: null, // structurally null for clips — this is the gap
    display_bytes: 0.002 * GB, // poster still
    thumb_bytes: 0,
    clip_web_bytes: 0.0005 * GB, // the small playable copy
    full_res_dropped_at: null,
    is_clip: true,
  };
  const r = storedBytes(clip);

  assert.ok(r.unmeasured, 'a held clip raw is real storage we cannot size — say so');
  assert.ok(r.bytes > 0, 'the copies we CAN measure still count');
  assert.ok(
    r.bytes < 0.01 * GB,
    'and the figure is a floor — a real clip raw is megabytes larger than this',
  );
});

test('a clip whose raw has been replaced is fully measured — nothing is unknown', () => {
  const clip: StoredRow = {
    orig_bytes: null,
    display_bytes: 0.002 * GB,
    thumb_bytes: 0,
    clip_web_bytes: 0.0005 * GB,
    full_res_dropped_at: '2026-08-01T00:00:00Z',
    is_clip: true,
  };
  const r = storedBytes(clip);
  assert.equal(r.unmeasured, false, 'the unknown object is gone, so nothing is unknown');
  assert.equal(r.bytes, 0.0025 * GB);
});

test('🔑 the account ACCUMULATES — three 4 GB events are 12 GB, not three 1-block bills', () => {
  // The owner's model: a wedding, then a christening, then a birthday, all on one
  // account. Billing each event separately would charge 3 x ₱500 for 12 GB, when
  // 12 GB is 2 blocks = ₱1,000. Rolling up is the whole point of account scope.
  const rows = [still(4, 0), still(4, 0), still(4, 0)];
  const acct = aggregateAccountStorage(rows);

  assert.equal(acct.storedGb, 12);
  assert.equal(acct.blocksNeeded, 2, '12 GB needs 2 blocks');
  assert.equal(acct.annualPhp, 2 * STORAGE_BLOCK_PHP);
  assert.notEqual(
    acct.annualPhp,
    3 * STORAGE_BLOCK_PHP,
    'per-event billing would over-charge — that is the bug this scope prevents',
  );
});

test('the account summary carries the unmeasured count forward', () => {
  const rows: StoredRow[] = [
    still(4),
    { display_bytes: 1000, clip_web_bytes: 500, is_clip: true, full_res_dropped_at: null },
  ];
  const acct = aggregateAccountStorage(rows);
  assert.equal(acct.captures, 2);
  assert.equal(
    acct.unmeasuredCaptures,
    1,
    'the flag must survive aggregation — a total that quietly drops it is the ' +
      'silent-undercount bug wearing a summary object',
  );
});

test('blocks round UP and never go below one', () => {
  assert.equal(blocksNeeded(0), 1, 'an account on the plan always holds one block');
  assert.equal(blocksNeeded(0.5 * GB), 1);
  assert.equal(blocksNeeded(10 * GB), 1, 'exactly one block is one block');
  assert.equal(blocksNeeded(10.1 * GB), 2, 'a sliver over rounds up — we cannot sell a part block');
  assert.equal(blocksNeeded(25 * GB), 3);
  assert.equal(blocksNeeded(-5 * GB), 1, 'a negative total cannot bill negative');
});

test('🔒 the 5 GB buffer is real headroom past 100%, not a hard stop at the allowance', () => {
  // Owner: "a 5Gb allowance always to alot extra space when needed."
  assert.equal(allowanceGb(1), STORAGE_BLOCK_GB);
  assert.equal(hardCapGb(1), STORAGE_BLOCK_GB + STORAGE_BUFFER_GB);

  const at100 = storageMeter(10 * GB, 1);
  assert.equal(at100.percentUsed, 100);
  assert.ok(at100.withinBuffer);
  assert.equal(at100.inBuffer, false, 'exactly at the allowance is not yet into the buffer');

  const intoBuffer = storageMeter(13 * GB, 1);
  assert.equal(intoBuffer.percentUsed, 130, 'the meter is ALLOWED past 100 — that is the buffer');
  assert.ok(intoBuffer.withinBuffer, '13 GB is inside 10 + 5');
  assert.ok(intoBuffer.inBuffer);

  const overrun = storageMeter(15.1 * GB, 1);
  assert.equal(overrun.withinBuffer, false, 'past allowance + buffer is genuinely out of room');
});

test('🗣 the meter reports a PERCENTAGE and flags when that percentage is a floor', () => {
  // Owner: "we do not have to say the Gb size. we will only show percentage."
  // Showing a percentage does NOT make an unmeasured total safe — it hides which
  // number is wrong. `approximate` is how the UI can be honest about it.
  const exact = storageMeter(5 * GB, 1, 0);
  assert.equal(exact.percentUsed, 50);
  assert.equal(exact.approximate, false);

  const floored = storageMeter(5 * GB, 1, 7);
  assert.equal(floored.percentUsed, 50);
  assert.ok(
    floored.approximate,
    'with 7 unsized clip raws the true usage is higher — the UI must be able to ' +
      'say so rather than imply a precision it does not have',
  );
});

test('the percentage is a whole number', () => {
  // A meter reading "62.4%" invites an argument about the precision of a figure
  // that is a floor.
  const m = storageMeter(6.24 * GB, 1);
  assert.equal(m.percentUsed, 62);
  assert.equal(Number.isInteger(m.percentUsed), true);
});

test('🪤 GB here is DECIMAL (10^9), matching how the storage bill is actually charged', () => {
  // Cloudflare bills decimal GB. Using 2^30 would make every block ~7% smaller
  // than the cost basis it was priced against, silently eroding the margin.
  assert.equal(BYTES_PER_GB, 1_000_000_000);
  assert.notEqual(BYTES_PER_GB, 1024 ** 3);
  assert.equal(aggregateAccountStorage([still(1, 0)]).storedGb, 1);
});

test('the locked commercial constants are what the owner set', () => {
  assert.equal(STORAGE_BLOCK_GB, 10);
  assert.equal(STORAGE_BLOCK_PHP, 500);
  assert.equal(STORAGE_BUFFER_GB, 5);
});
