/**
 * GUARD — the saved mark is honest, and the saved copy's window and scope are what lib/offline-copies.ts says (EV3).
 * The worker's half is `app/sw-offline-copies.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OFFLINE_COPY_UNREAD,
  STALE_AFTER_MS,
  coordinatorOfflinePaths,
  coordinatorSchedulePath,
  copyVersionIn,
  copyVersionOf,
  offlineEventDay,
  staleFor,
  supplierSchedulePath,
  offlineCopiesUntil,
  offlineSavingOpen,
  parseOfflineRegistry,
  savedAtFor,
  savedMark,
  supplierOfflinePaths,
  type SavedPhase,
} from './offline-copies';
import { guestMePath, isOfflineCopyPath, offlineCopyEventId } from './offline-copy-addresses';
import { labYourSchedule } from '@/app/dev/me-lab/lab-your-schedule';

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

// ── 📅 YOUR SCHEDULE — each person's own day, saved for no signal ─────────────────────────────────────────────────

test('every person’s "Your schedule" has a saved address — the guest’s Me, the supplier’s Schedule tab, the hosts’ Schedule', () => {
  assert.equal(coordinatorSchedulePath(E), `/dashboard/${E}/schedule`);
  assert.equal(supplierSchedulePath(E), `/vendor-dashboard/clients/${E}?tab=schedule`);
  assert.equal(guestMePath('Ana-Ben'), '/ana-ben?tab=me');
  for (const [p, owner] of [
    [`/dashboard/${E}/schedule`, E],
    [`/vendor-dashboard/clients/${E}?tab=schedule`, E],
    ['/ana-ben?tab=me', 'ana-ben'],
  ] as const) {
    assert.ok(isOfflineCopyPath(p), `${p} is not a saved address`);
    assert.equal(offlineCopyEventId(p), owner, `${p} is kept under ${offlineCopyEventId(p)}`);
  }
  // Only those exact addresses: another tab, another query, a reserved first segment, an unsafe id — never.
  for (const p of [
    `/vendor-dashboard/clients/${E}?tab=files`,
    `/vendor-dashboard/clients/${E}`,
    `/vendor-dashboard/clients/${E}?tab=schedule&x=1`,
    `/dashboard/${E}/schedule?maker=1`,
    '/ana-ben',
    '/ana-ben?tab=home',
    '/dashboard?tab=me',
    '/login?tab=me',
    '/schedule?tab=me',
    '/ab?tab=me',
  ]) {
    assert.equal(isOfflineCopyPath(p), false, `${p} would be kept`);
  }
  assert.equal(guestMePath('dashboard'), null, 'a reserved word made a guest address');
  assert.equal(coordinatorSchedulePath('../x'), null);
  assert.equal(supplierSchedulePath('a?b'), null);
});

test('the copy’s version is a fingerprint of the day drawn — a Release changes it; the same day never does', () => {
  const before = labYourSchedule({ schedule: 'bridesmaid' });
  const after = labYourSchedule({ schedule: 'bridesmaid', released: '1' });
  assert.ok(before?.kind === 'ok' && after?.kind === 'ok');
  const v1 = copyVersionOf(before.schedule);
  const again = labYourSchedule({ schedule: 'bridesmaid' });
  assert.ok(again?.kind === 'ok');
  assert.equal(copyVersionOf(again.schedule), v1, 'the same day gave two versions');
  assert.notEqual(copyVersionOf(after.schedule), v1, 'pressing Release did not change the version');
  // A moved time, a deleted moment: changed.
  const day = { chapters: [{ id: 'c1', lines: [{ id: 'l1', time: '1:30 PM' }, { id: 'l2', time: '2:00 PM' }] }] };
  const moved = { chapters: [{ id: 'c1', lines: [{ id: 'l1', time: '1:45 PM' }, { id: 'l2', time: '2:00 PM' }] }] };
  const deleted = { chapters: [{ id: 'c1', lines: [{ id: 'l1', time: '1:30 PM' }] }] };
  assert.notEqual(copyVersionOf(moved), copyVersionOf(day));
  assert.notEqual(copyVersionOf(deleted), copyVersionOf(day));
  assert.match(copyVersionOf(day), /^[A-Za-z0-9._-]{1,64}$/);
  assert.notEqual(copyVersionOf(day), OFFLINE_COPY_UNREAD);
  // The worker reads it back out of the page the way it is drawn.
  assert.equal(copyVersionIn(`<div data-schedule-saved="" data-sn-copy-version="${v1}"></div>`), v1);
  assert.equal(copyVersionIn('<div>no version</div>'), null);
});

test('a copy from before the Release is stale — and is never drawn as "Saved for offline"', () => {
  const v1 = 'v1abc.10';
  const v2 = 'v2def.12';
  const P = `/vendor-dashboard/clients/${E}?tab=schedule`;
  const reg = parseOfflineRegistry({ v: 1, viewer: 'ana-00000001', events: { [E]: { until: NOON + HOUR, pages: { [P]: NOON - 10 * 60_000 }, versions: { [P]: v1 } } } });
  assert.equal(staleFor(reg, 'ana-00000001', E, [P], v1), false, 'the same version read as stale');
  assert.equal(staleFor(reg, 'ana-00000001', E, [P], v2), true, 'a copy from before the change read as current');
  assert.equal(staleFor(reg, 'ben-00000002', E, [P], v2), false, 'another person’s copy was weighed at all');
  assert.equal(staleFor(reg, 'ana-00000001', E, [P], OFFLINE_COPY_UNREAD), false, 'a page that could not read its day judged the copy');
  const unversioned = parseOfflineRegistry({ v: 1, viewer: 'ana-00000001', events: { [E]: { until: NOON + HOUR, pages: { [P]: NOON } } } });
  assert.equal(staleFor(unversioned, 'ana-00000001', E, [P], v2), true, 'a copy that carries no version read as current');
  // The mark: ten minutes old (fresh by the clock) but stale — never ok, never "Saved for offline".
  const savedAt = NOON - 10 * 60_000;
  for (const eventDay of [true, false]) {
    const m = savedMark({ phase: 'saved', savedAt, now: NOON, online: true, eventDay, stale: true });
    assert.notEqual(m.tone, 'ok', `a stale copy was drawn ${m.tone}: "${m.text}"`);
    assert.doesNotMatch(m.text, /Saved for offline/);
    assert.match(m.text, /^Couldn’t update · the copy from /);
  }
  // Offline it is the copy on screen: amber, and says which copy.
  const off = savedMark({ phase: 'saved', savedAt, now: NOON, online: false, eventDay: true, stale: true });
  assert.equal(off.tone, 'amber');
  assert.match(off.text, /^No signal · showing the copy from /);
});

test('offline, a saved schedule opens with the amber mark naming its copy; with nothing saved it says so in red', () => {
  const at = Date.parse('2026-11-14T07:05:00+08:00');
  const m = savedMark({ phase: 'saved', savedAt: at, now: NOON, online: false, eventDay: true, onCopy: at });
  assert.deepEqual(m, { tone: 'amber', text: 'No signal · showing the copy from 7:05 AM' });
  assert.equal(savedMark({ phase: 'none', savedAt: null, now: NOON, online: false, eventDay: true }).tone, 'bad');
});

test('the event day, Philippine time, for the amber line — one day or every day of a long event', () => {
  assert.equal(offlineEventDay(DAY, NOON), true);
  assert.equal(offlineEventDay(DAY, Date.parse('2026-11-13T23:59:00+08:00')), false);
  assert.equal(offlineEventDay(DAY, Date.parse('2026-11-15T00:00:00+08:00')), false);
  assert.equal(offlineEventDay(DAY, Date.parse('2026-11-15T09:00:00+08:00'), '2026-11-16'), true);
  assert.equal(offlineEventDay(null, NOON), false);
});
