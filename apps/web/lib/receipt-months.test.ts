/**
 * The receipt ledger's month is the MANILA month (A8·A-7), and its picker
 * offers every month that has receipts, not only the ones on screen (A8·A-22).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { manilaMonthBucket, manilaMonthLabel, manilaMonthRange, manilaMonthsSince } from './receipt-months';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a receipt issued at 07:30 Manila on the 1st belongs to that Manila month', () => {
  // 2026-11-30T23:30Z is 07:30 on 1 Dec in Manila.
  assert.equal(manilaMonthBucket('2026-11-30T23:30:00Z'), '2026-12');
  assert.equal(manilaMonthBucket('2026-11-30T15:59:59Z'), '2026-11');
  assert.equal(manilaMonthBucket('2026-11-30T16:00:00Z'), '2026-12');
});

test('the month range runs midnight to midnight, Manila time', () => {
  assert.deepEqual(manilaMonthRange('2026-12'), {
    start: '2026-11-30T16:00:00.000Z',
    end: '2026-12-31T16:00:00.000Z',
  });
  assert.deepEqual(manilaMonthRange('2026-01')?.start, '2025-12-31T16:00:00.000Z');
  assert.equal(manilaMonthRange('2026-13'), null);
  assert.equal(manilaMonthRange('nope'), null);
});

test('the label names the bucket’s own month', () => {
  assert.equal(manilaMonthLabel('2026-12'), 'December 2026');
  assert.equal(manilaMonthLabel('2027-01'), 'January 2027');
});

test('the picker offers every month from the oldest receipt to now, newest first', () => {
  const now = new Date('2027-02-10T00:00:00Z');
  assert.deepEqual(manilaMonthsSince('2026-11-30T23:30:00Z', now), ['2027-02', '2027-01', '2026-12']);
  assert.deepEqual(manilaMonthsSince('2026-10-15T00:00:00Z', now), ['2027-02', '2027-01', '2026-12', '2026-11', '2026-10']);
});

test('the receipts page reads with the Manila helpers and offers months from the oldest receipt', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/admin/receipts/page.tsx'), 'utf8'));
  assert.match(page, /manilaMonthRange\(filterMonth\)/, 'the filter range is the Manila month');
  assert.doesNotMatch(page, /getMonth\(\)|new Date\(Number\(year\)/, 'no server-clock month');
  assert.match(page, /manilaMonthsSince\(/, 'the picker is built from the oldest receipt, not the rows on screen');
  assert.doesNotMatch(page, /for \(const r of receipts \?\? \[\]\)\s*\{\s*allMonths\.add/, 'options never come from the filtered rows');
});
