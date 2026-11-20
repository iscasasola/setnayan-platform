/**
 * GUARD — THE PAPIC STATE LINE ON MEMORIES IS THE GATE'S OWN ANSWER (owner 2026-11-20, "memories approved"; the
 * controller's call the same day: "computed from the gate (`guestCaptureGate` / head state), never a fixed date").
 *
 *   1 · each line is what `guestCaptureGate` answers for that position — "open <day>" names the instant the gate opens;
 *   2 · a draft that differs from live says so ("after you Apply") — the line never looks applied when it isn't;
 *   3 · an unread fact is "Couldn’t check just now", never a position;
 *   4 · `byHead` covers every word the picker can say, so a pick shows this file's line, not the picker's.
 *
 * Sabotage (2026-11-20): `gateLine` returning a fixed "open Fri 18 Dec" → 1 red; dropping the `· off after you Apply`
 * tail → 2 red; `byHead` built for two positions only → 4 red. Restored → green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERAS_UNREAD, camerasDayWords, papicGuestCamerasLine, papicGuestCamerasLines, papicHeadHints } from './papic-guest-cameras-line';
import { PAPIC_HEAD_OPTIONS, papicHeadLine } from './papic-shoot-now';

const D = { eventDate: '2026-12-18', windowStart: '2026-09-23T00:00:00+08:00', windowEnd: '2026-12-19T11:59:00+08:00' };
const BEFORE = Date.parse('2026-11-20T10:00:00+08:00');
const ON_THE_DAY = Date.parse('2026-12-18T15:00:00+08:00');
const LONG_AFTER = Date.parse('2027-01-10T10:00:00+08:00');

test('1 · the line is the gate’s answer — the event day, open now, closed', () => {
  const eventDay = { live: true, draftOn: true, early: false };
  assert.equal(papicGuestCamerasLine(eventDay, D, BEFORE), 'Guests’ cameras open Fri 18 Dec');
  assert.equal(papicGuestCamerasLine(eventDay, D, ON_THE_DAY), 'Guests’ cameras are open now');
  assert.equal(papicGuestCamerasLine(eventDay, D, LONG_AFTER), 'Guests’ cameras have closed');
  // On — everyone, now: inside the window it is open; before the window starts it names the window's first day.
  const now = { live: true, draftOn: true, early: true };
  assert.equal(papicGuestCamerasLine(now, D, BEFORE), 'Guests’ cameras are open now');
  assert.equal(papicGuestCamerasLine(now, { ...D, windowStart: '2026-12-01T00:00:00+08:00' }, BEFORE), 'Guests’ cameras open Tue 1 Dec');
  // Another year carries its year.
  assert.equal(papicGuestCamerasLine(eventDay, { ...D, eventDate: '2027-02-14' }, BEFORE), 'Guests’ cameras open Sun 14 Feb 2027');
  // No date: the gate fails open, and the line says what the gate says.
  assert.equal(papicGuestCamerasLine(eventDay, { ...D, eventDate: null }, BEFORE), 'Guests’ cameras are open now');
  assert.equal(papicGuestCamerasLine({ live: false, draftOn: false, early: false }, D, BEFORE), 'Guests’ cameras are off');
});

test('2 · a draft that differs from live says so — never looks applied', () => {
  assert.equal(papicGuestCamerasLine({ live: false, draftOn: true, early: false }, D, BEFORE), 'Guests’ cameras are off · on after you Apply');
  assert.equal(papicGuestCamerasLine({ live: true, draftOn: false, early: false }, D, BEFORE), 'Guests’ cameras open Fri 18 Dec · off after you Apply');
});

test('3 · an unread fact is said as unread', () => {
  assert.equal(papicGuestCamerasLine({ live: null, draftOn: true, early: false }, D, BEFORE), CAMERAS_UNREAD);
  assert.equal(papicGuestCamerasLine({ live: true, draftOn: true, early: null }, D, BEFORE), CAMERAS_UNREAD);
  assert.deepEqual(papicGuestCamerasLines({ live: true, draftOn: null, early: false }, D, BEFORE).byHead, {}, 'no map over unread facts');
});

test('4 · every word the picker can say has this file’s line', () => {
  for (const live of [true, false]) {
    for (const early of [true, false]) {
      const { byHead } = papicGuestCamerasLines({ live, draftOn: true, early }, D, BEFORE);
      for (const o of PAPIC_HEAD_OPTIONS) {
        const said = papicHeadLine({ live, draftOn: o.key !== 'off', early: o.key === 'off' ? early : o.key === 'now' });
        assert.ok(byHead[said], `live=${live} early=${early}: the picker's "${said}" (${o.key}) has no line`);
        assert.match(byHead[said]!, /^Guests’ cameras /);
      }
    }
  }
  const { byHead } = papicGuestCamerasLines({ live: true, draftOn: true, early: false }, D, BEFORE);
  assert.equal(byHead['On the event day'], 'Guests’ cameras open Fri 18 Dec');
  assert.equal(byHead['Guests can shoot now'], 'Guests’ cameras are open now');
  assert.equal(byHead.Off, undefined, 'live is on, so Off is "Off after you Apply"');
  assert.equal(byHead['Off after you Apply'], 'Guests’ cameras open Fri 18 Dec · off after you Apply');
});

test('the day words — Manila, short, no fixed date', () => {
  assert.equal(camerasDayWords('2026-12-18', BEFORE), 'Fri 18 Dec');
  assert.equal(camerasDayWords('2026-12-17T16:30:00Z', BEFORE), 'Fri 18 Dec', 'a UTC instant late on the 17th is the 18th in Manila');
  assert.equal(camerasDayWords(null, BEFORE), null);
  assert.equal(camerasDayWords('not a date', BEFORE), null);
});

// 📷 The picker's sub-lines (the approved drawing's "switch, opened"), from the same gate — never a fixed date.
test('papicHeadHints: each choice says what it does to guests’ cameras, from the gate', () => {
  const d = { eventDate: '2026-12-18', windowStart: '2026-09-23T00:00:00+08:00', windowEnd: '2026-12-19T11:59:00+08:00' };
  const before = Date.parse('2026-11-20T10:00:00+08:00');
  assert.deepEqual(papicHeadHints(d, before), {
    off: 'guests’ cameras stay closed',
    eventday: 'cameras open Fri 18 Dec',
    now: 'cameras open on the Event Hub now',
  });
  const after = Date.parse('2026-12-21T10:00:00+08:00');
  assert.equal(papicHeadHints(d, after).eventday, 'cameras have closed');
  assert.equal(papicHeadHints(d, after).now, 'cameras have closed');
  assert.deepEqual(papicHeadHints(null, before), {});
});
