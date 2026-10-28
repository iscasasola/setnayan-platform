/**
 * GUARD — the saved mark is honest, and the saved copy's window and scope are what lib/offline-copies.ts says (EV3).
 * The worker's half is `app/sw-offline-copies.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STALE_AFTER_MS,
  coordinatorOfflinePaths,
  isOfflineCopyPath,
  offlineCopiesUntil,
  offlineSavingOpen,
  parseOfflineRegistry,
  savedAtFor,
  savedMark,
  supplierOfflinePaths,
  type SavedPhase,
} from './offline-copies';

const E = '0e0e0e0e-0000-4000-8000-000000000001';
const DAY = '2026-11-14';
const NOON = Date.parse('2026-11-14T12:00:00+08:00');
const HOUR = 3_600_000;
const PHASES: SavedPhase[] = ['checking', 'unsupported', 'none', 'saving', 'saved', 'failed'];

test('only a save that landed reads as saved — every other phase says it is not', () => {
  for (const phase of PHASES) {
    for (const savedAt of [null, NOON - HOUR]) {
      for (const online of [true, false]) {
        const m = savedMark({ phase, savedAt, now: NOON, online, eventDay: true });
        const claimsSaved = /Saved for offline/.test(m.text) || m.tone === 'ok';
        assert.equal(claimsSaved, phase === 'saved' && savedAt !== null && online, `${phase}/${savedAt}/${online}: "${m.text}"`);
      }
    }
  }
});

test('a failed save names the older copy and never calls it fresh', () => {
  const m = savedMark({ phase: 'failed', savedAt: NOON - 2 * HOUR, now: NOON, online: true, eventDay: true });
  assert.equal(m.tone, 'bad');
  assert.match(m.text, /^Couldn’t update · the copy from .+ is still on this phone$/);
  assert.equal(savedMark({ phase: 'failed', savedAt: null, now: NOON, online: true, eventDay: true }).text, 'Couldn’t save for offline · try Update now');
});

test('on the event day a copy older than the amber line says "update before you leave"', () => {
  const fresh = savedMark({ phase: 'saved', savedAt: NOON - STALE_AFTER_MS, now: NOON, online: true, eventDay: true });
  assert.equal(fresh.tone, 'ok', 'exactly at the line is not yet old');
  const old = savedMark({ phase: 'saved', savedAt: NOON - 9 * HOUR, now: NOON, online: true, eventDay: true });
  assert.equal(old.tone, 'amber');
  assert.equal(old.text, 'Saved 9 hours ago · update before you leave for the venue');
  const notToday = savedMark({ phase: 'saved', savedAt: NOON - 9 * HOUR, now: NOON, online: true, eventDay: false });
  assert.equal(notToday.tone, 'ok', 'an old copy before the day is not an alarm');
  assert.equal(STALE_AFTER_MS, 3 * HOUR, 'the amber line moved — re-measure and re-write its docblock, then this');
});

test('no signal says so, and which copy is on screen', () => {
  const m = savedMark({ phase: 'saved', savedAt: Date.parse('2026-11-14T14:10:00+08:00'), now: NOON, online: false, eventDay: true });
  assert.equal(m.text, 'No signal · showing the copy from 2:10 PM');
  assert.equal(savedMark({ phase: 'none', savedAt: null, now: NOON, online: false, eventDay: true }).text, 'No signal · nothing saved on this phone yet');
});

test('a browser that keeps nothing points to the app or the Home Screen', () => {
  assert.match(savedMark({ phase: 'unsupported', savedAt: null, now: NOON, online: true, eventDay: true }).text, /use the Setnayan app or Add to Home Screen/);
});

test('the window: from three days before to the end of the day after, Philippine time; a dateless event keeps nothing', () => {
  const until = offlineCopiesUntil(DAY);
  assert.equal(until, Date.parse('2026-11-16T00:00:00+08:00'));
  assert.equal(offlineCopiesUntil('2026-11-14', '2026-11-16'), Date.parse('2026-11-18T00:00:00+08:00'), 'a several-day event ends after its last day');
  assert.equal(offlineSavingOpen(DAY, Date.parse('2026-11-11T00:00:00+08:00')), true);
  assert.equal(offlineSavingOpen(DAY, Date.parse('2026-11-10T23:59:00+08:00')), false);
  assert.equal(offlineSavingOpen(DAY, Date.parse('2026-11-15T23:59:00+08:00')), true);
  assert.equal(offlineSavingOpen(DAY, Date.parse('2026-11-16T00:00:00+08:00')), false);
  assert.equal(offlineSavingOpen(null, NOON), false);
  assert.equal(offlineCopiesUntil('not a date'), null);
});

test('the pages each viewer keeps are their own event’s, and only the four shapes', () => {
  assert.deepEqual(coordinatorOfflinePaths(E, { checkin: true }), [`/dashboard/${E}`, `/dashboard/${E}/guests/checkin`]);
  assert.deepEqual(coordinatorOfflinePaths(E, { checkin: false }), [`/dashboard/${E}`]);
  assert.deepEqual(supplierOfflinePaths(E, { checkin: false }), ['/vendor-dashboard/on-the-day', `/vendor-dashboard/on-the-day/live/${E}`]);
  assert.equal(supplierOfflinePaths(E, { checkin: true }).at(-1), `/dashboard/${E}/guests/checkin`);
  for (const p of [...coordinatorOfflinePaths(E, { checkin: true }), ...supplierOfflinePaths(E, { checkin: true })]) {
    assert.ok(isOfflineCopyPath(p), p);
  }
  assert.deepEqual(coordinatorOfflinePaths('../x', { checkin: true }), [], 'an unsafe event id made an address');
});

test('the copy belongs to one viewer: another account’s registry never reads as saved', () => {
  const reg = parseOfflineRegistry({ v: 1, viewer: 'ana', events: { [E]: { until: NOON + HOUR, pages: { a: NOON - HOUR, b: NOON - 2 * HOUR } } } });
  assert.equal(savedAtFor(reg, 'ana', E, ['a', 'b'], NOON), NOON - 2 * HOUR, 'the mark speaks for the OLDEST page');
  assert.equal(savedAtFor(reg, 'ben', E, ['a'], NOON), null);
  assert.equal(savedAtFor(reg, 'ana', E, ['a', 'c'], NOON), null, 'a missing page reads as saved');
  assert.equal(savedAtFor(reg, 'ana', E, ['a'], NOON + 2 * HOUR), null, 'an expired copy reads as saved');
  assert.equal(parseOfflineRegistry({ v: 2, viewer: 'ana', events: {} }), null);
  assert.equal(parseOfflineRegistry('nonsense'), null);
});

test('the saved copy on screen says so — never "Saved for offline", with signal or without', () => {
  const at = Date.parse('2026-11-14T14:10:00+08:00');
  const off = savedMark({ phase: 'saved', savedAt: at, now: NOON, online: false, eventDay: true, onCopy: at });
  assert.equal(off.text, 'No signal · showing the copy from 2:10 PM');
  const back = savedMark({ phase: 'saved', savedAt: at, now: NOON, online: true, eventDay: true, onCopy: at });
  assert.equal(back.tone, 'amber');
  assert.match(back.text, /^Showing the copy from 2:10 PM · load the latest/);
});
