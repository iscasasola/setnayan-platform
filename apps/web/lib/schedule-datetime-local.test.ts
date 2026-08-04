/**
 * The round trip that stops a wedding walking eight hours at a time.
 *
 * These run with the process TZ forced to several zones, because the original
 * defect was invisible under UTC — which is exactly where CI runs. A test that
 * only ever sees UTC would have passed on the broken code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from './schedule-datetime-local';

const TYPED = [
  '2026-12-12T15:30',
  '2026-12-12T00:00',
  '2026-12-12T23:59',
  '2026-08-01T08:00',
  '2027-01-01T12:00',
];

test('round trip · what the couple typed is what comes back, in every timezone', () => {
  // THE property. If this breaks, pressing Save without changing anything moves
  // the block — and no repair can tell a shifted row from a deliberate one.
  const original = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      for (const typed of TYPED) {
        const stored = fromDatetimeLocalValue(typed);
        assert.ok(stored, `${typed} did not store`);
        assert.equal(
          toDatetimeLocalValue(stored),
          typed,
          `in ${tz}, "${typed}" came back as "${toDatetimeLocalValue(stored)}" — ` +
            `saving without editing would move the block`,
        );
      }
    }
  } finally {
    process.env.TZ = original;
  }
});

test('round trip · the stored value is the WALL CLOCK verbatim, not a conversion', () => {
  // A 2 PM ceremony is stored as 14:00Z. Prod holds exactly this shape:
  // Ceremony 14:00+00, Hair & make-up 08:00+00, Send-off 21:45+00.
  assert.equal(fromDatetimeLocalValue('2026-12-12T14:00'), '2026-12-12T14:00:00.000Z');
  assert.equal(toDatetimeLocalValue('2026-12-12T14:00:00.000Z'), '2026-12-12T14:00');
});

test('round trip · neither direction depends on the runtime timezone', () => {
  // The original defect was precisely this dependence: the server was UTC, the
  // browser was not, and the same helper gave two answers.
  const original = process.env.TZ;
  try {
    process.env.TZ = 'UTC';
    const utcOut = fromDatetimeLocalValue('2026-12-12T15:30');
    const utcBack = toDatetimeLocalValue('2026-12-12T15:30:00.000Z');
    process.env.TZ = 'Asia/Manila';
    assert.equal(fromDatetimeLocalValue('2026-12-12T15:30'), utcOut);
    assert.equal(toDatetimeLocalValue('2026-12-12T15:30:00.000Z'), utcBack);
  } finally {
    process.env.TZ = original;
  }
});

test('round trip · a real stored row prefills as the time a person meant', () => {
  // Read as an instant these are absurd — a 10 PM ceremony, a 5:45 AM send-off.
  // Read as wall clocks they are exactly right, which is how we know the
  // storage intent.
  assert.equal(toDatetimeLocalValue('2026-12-18T14:00:00+00:00'), '2026-12-18T14:00');
  assert.equal(toDatetimeLocalValue('2026-08-01T08:00:00+00:00'), '2026-08-01T08:00');
  assert.equal(toDatetimeLocalValue('2026-08-01T21:45:00+00:00'), '2026-08-01T21:45');
});

test('round trip · empty and malformed input clear, never store garbage', () => {
  for (const bad of ['', '   ', 'not a date', null, undefined]) {
    assert.equal(fromDatetimeLocalValue(bad as string), null);
  }
  for (const bad of ['', 'nope', null, undefined]) {
    assert.equal(toDatetimeLocalValue(bad as string), '');
  }
});
