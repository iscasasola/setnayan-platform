/**
 * The venue-wall-clock converter, tested under several runtime timezones —
 * because the defect it exists to kill is INVISIBLE under UTC, which is where
 * CI and every server action run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datetimeLocalToIso } from './schedule';

test('a bare datetime-local value is read at the VENUE, not in UTC', () => {
  // A 2 PM site visit. The old code stored 14:00Z and showed everyone 10 PM.
  assert.equal(datetimeLocalToIso('2026-12-18T14:00'), '2026-12-18T06:00:00.000Z');
  assert.equal(datetimeLocalToIso('2026-12-18T14:00:00'), '2026-12-18T06:00:00.000Z');
});

test('a value that already carries an offset is NOT reinterpreted', () => {
  // It is already a real instant. Converting it again would move it twice.
  assert.equal(datetimeLocalToIso('2026-12-18T14:00:00+08:00'), '2026-12-18T06:00:00.000Z');
  assert.equal(datetimeLocalToIso('2026-12-18T06:00:00.000Z'), '2026-12-18T06:00:00.000Z');
});

test('empty and unreadable values return null, so nothing garbage is stored', () => {
  assert.equal(datetimeLocalToIso(''), null);
  assert.equal(datetimeLocalToIso('   '), null);
  assert.equal(datetimeLocalToIso('not a time'), null);
  assert.equal(datetimeLocalToIso(null), null);
  assert.equal(datetimeLocalToIso(undefined), null);
});

test('the answer does not depend on where the code happens to be running', () => {
  // The whole bug was a helper that gave different answers on the server and in
  // the browser. Same input, same instant, every runtime.
  const expected = '2026-12-18T06:00:00.000Z';
  for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    assert.equal(datetimeLocalToIso('2026-12-18T14:00'), expected, `wrong under TZ=${tz}`);
    process.env.TZ = before;
  }
});
