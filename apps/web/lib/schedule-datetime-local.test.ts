/**
 * The venue-wall-clock converter, tested under several runtime timezones —
 * because the defect it exists to kill is INVISIBLE under UTC, which is where
 * CI and every server action run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  datetimeLocalToIso,
  formatBlockTime,
  formatBlockTimeRange,
  venueNowMs,
} from './schedule';

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

// ── "Now" at the venue ──────────────────────────────────────────────────────

test('venueNowMs is comparable with a stored schedule time', () => {
  // 2 PM in Manila is 06:00Z. A ceremony stored as `14:00Z` (the venue's wall
  // clock) must read as HAPPENING NOW, not as eight hours away.
  const realInstant = new Date('2026-12-18T06:00:00.000Z');
  const ceremony = new Date('2026-12-18T14:00:00.000Z').getTime();
  assert.equal(venueNowMs('Asia/Manila', realInstant), ceremony);
});

test('the old comparison was out by exactly the venue offset', () => {
  // Pins the size of the mistake, so a future change that reintroduces it is
  // unambiguous rather than "a bit off".
  const realInstant = new Date('2026-12-18T06:00:00.000Z');
  const gapMinutes = (venueNowMs('Asia/Manila', realInstant) - realInstant.getTime()) / 60000;
  assert.equal(gapMinutes, 480);
});

test('venueNowMs still answers when the zone is unreadable', () => {
  // Falling back to the real instant is the pre-existing behaviour. A day-of
  // banner that throws is worse than one that is briefly wrong.
  const at = new Date('2026-12-18T06:00:00.000Z');
  assert.equal(typeof venueNowMs('Not/AZone', at), 'number');
});

// ── The shared schedule formatters render the time AS WRITTEN ────────────────
// These two feed 27 call sites. They omitted `timeZone`, which means "the
// READER's zone" — so everyone standing at the wedding with a Manila phone was
// shown 10:00 PM for a 2 PM ceremony. It read correctly only to a reader in
// UTC, which is nobody except CI. That is how 27 screens carried this silently.

test('formatBlockTime shows the couple the hour they typed, in any timezone', () => {
  const ceremony = '2026-12-12T14:00:00.000Z'; // 2 PM at the venue
  for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    const out = formatBlockTime(ceremony);
    assert.match(out, /2:00/, `showed the wrong hour under TZ=${tz}: ${out}`);
    assert.match(out, /Dec 12/, `showed the wrong day under TZ=${tz}: ${out}`);
    process.env.TZ = before;
  }
});

test('formatBlockTimeRange keeps a late reception on the same day', () => {
  // 6 PM → 11:30 PM at the venue. Read in a zone east of the venue, the old
  // local-getter same-day test rolled the end into "tomorrow" and switched the
  // range to the long form.
  for (const tz of ['UTC', 'Asia/Manila', 'Pacific/Kiritimati']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    const out = formatBlockTimeRange('2026-12-12T18:00:00.000Z', '2026-12-12T23:30:00.000Z');
    assert.match(out, /6:00/, `wrong start under TZ=${tz}: ${out}`);
    assert.match(out, /11:30/, `wrong end under TZ=${tz}: ${out}`);
    assert.ok(!out.includes('→'), `split across days under TZ=${tz}: ${out}`);
    process.env.TZ = before;
  }
});

test('the formatters return nothing rather than "Invalid Date"', () => {
  assert.equal(formatBlockTime('not a time'), '');
  assert.equal(formatBlockTimeRange('not a time', null), '');
});
