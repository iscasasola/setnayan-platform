/**
 * 🕗 FACEBOOK POSTS IN THE OWNER'S THREE SLOTS (owner, 28 Nov 2026, specs DECISION_LOG "FACEBOOK POSTING IS AUTOMATIC,
 * IN THREE DAILY SLOTS" · "THE FACEBOOK DAILY CAP COUNTS THE PLANNED POSTS TOO").
 *
 * 08:00 · 14:00 · 20:00 Manila, plus the 12:00 holiday extra on a planned holiday row only. One post per slot is the
 * whole daily cap, planned posts counted; a live update that finds its 14:00 taken queues for the next free 14:00.
 * Nothing posts outside a slot. Manila is UTC+08:00 with no DST, so day boundaries fall at 16:00 UTC.
 *
 * Sabotage (measured): SLOT_HOUR.afternoon 14 → 13 turns "auto-posts land at 14:00" red; dropping `allowHoliday` from
 * slotAt turns "noon is a slot only for a holiday row" red; `takenSet` ignoring a slot turns the cap tests red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_SLOTS,
  SLOT_HOUR,
  nextAvailableSlot,
  nextFreeSlot,
  phDayKey,
  postNowSlot,
  reslotKind,
  slotAt,
  slotClashLosers,
  slotVerdict,
} from './governor';

const ph = (s: string) => new Date(`${s}+08:00`);
const phTime = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

test('three daily slots at 8 AM, 2 PM and 8 PM; the holiday extra at 12 NN', () => {
  assert.deepEqual(DAILY_SLOTS, ['morning', 'afternoon', 'evening']);
  assert.deepEqual(SLOT_HOUR, { morning: 8, holiday: 12, afternoon: 14, evening: 20 });
});

test('auto-posts land at 14:00, never the old 12–1 PM or 7–9 PM windows', () => {
  assert.equal(phTime(nextFreeSlot('afternoon', [], ph('2026-11-27T08:00:00'))), '2026-11-27 14:00');
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-27T11:15:00'))), '2026-11-27 14:00');
});

test('a slot stays open for its hour, then the next day takes over', () => {
  assert.equal(phTime(nextFreeSlot('afternoon', [], ph('2026-11-27T14:40:00'))), '2026-11-27 14:00');
  assert.equal(phTime(nextFreeSlot('afternoon', [], ph('2026-11-27T15:00:00'))), '2026-11-28 14:00');
});

test('Manila day boundaries: 23:30 Manila is already the next UTC day, 00:30 Manila is still the UTC day before', () => {
  assert.equal(phDayKey(new Date('2026-11-30T15:59:00Z')), '2026-11-30'); // 23:59 Manila
  assert.equal(phDayKey(new Date('2026-11-30T16:00:00Z')), '2026-12-01'); // 00:00 Manila
  assert.equal(phTime(nextFreeSlot('morning', [], new Date('2026-11-30T16:30:00Z'))), '2026-12-01 08:00');
  // Year end: 20:30 Manila on 31 Dec rolls to 1 Jan.
  assert.equal(phTime(nextFreeSlot('evening', [], ph('2027-12-31T21:00:00'))), '2028-01-01 20:00');
});

test('no DST: the same slot is 06:00 UTC in January and July', () => {
  assert.equal(nextFreeSlot('afternoon', [], ph('2027-01-15T09:00:00')).toISOString(), '2027-01-15T06:00:00.000Z');
  assert.equal(nextFreeSlot('afternoon', [], ph('2027-07-15T09:00:00')).toISOString(), '2027-07-15T06:00:00.000Z');
});

test('the cap counts planned posts: a 14:00 a planned post holds sends the live update to the next free 14:00', () => {
  const planned = [ph('2026-12-01T14:00:00'), ph('2026-12-02T14:00:00')];
  assert.equal(phTime(nextFreeSlot('afternoon', planned, ph('2026-12-01T09:00:00'))), '2026-12-03 14:00');
  // ISO strings from the database count the same as Dates.
  assert.equal(
    phTime(nextFreeSlot('afternoon', planned.map((d) => d.toISOString()), ph('2026-12-01T09:00:00'))),
    '2026-12-03 14:00',
  );
});

test('one post per slot: a morning and an evening plan leave 14:00 free; a third post never doubles a slot', () => {
  const day = [ph('2026-12-01T08:00:00'), ph('2026-12-01T20:00:00')];
  assert.equal(phTime(nextFreeSlot('afternoon', day, ph('2026-12-01T07:00:00'))), '2026-12-01 14:00');
  assert.equal(phTime(nextFreeSlot('afternoon', [...day, ph('2026-12-01T14:00:00')], ph('2026-12-01T07:00:00'))), '2026-12-02 14:00');
});

test('noon is a slot only for a holiday row; any other time is not a slot', () => {
  assert.equal(slotAt(ph('2026-12-25T12:00:00')), null);
  assert.equal(slotAt(ph('2026-12-25T12:00:00'), true), 'holiday');
  assert.equal(slotAt(ph('2026-12-25T08:00:00')), 'morning');
  assert.equal(slotAt(ph('2026-12-25T19:00:00')), null);
  assert.equal(slotAt(ph('2026-12-25T14:00:01')), null);
});

test('the dispatcher publishes only inside a slot hour', () => {
  const at = ph('2026-12-01T20:00:00').toISOString();
  const row = { scheduled_for: at, slot: 'evening', source_type: 'library' };
  assert.equal(slotVerdict(row, ph('2026-12-01T19:59:00')), 'wait');
  assert.equal(slotVerdict(row, ph('2026-12-01T20:00:00')), 'publish');
  assert.equal(slotVerdict(row, ph('2026-12-01T20:59:00')), 'publish');
  // A planned post whose hour closed unposted is never posted late — and never lost: it is re-slotted.
  assert.equal(slotVerdict(row, ph('2026-12-01T21:00:00')), 'reslot');
  // A missed auto-post finds a new slot instead.
  assert.equal(slotVerdict({ ...row, slot: 'afternoon', source_type: 'vendor_feature', scheduled_for: ph('2026-12-01T14:00:00').toISOString() }, ph('2026-12-01T16:00:00')), 'reslot');
  // An old 12:30 / 19:00 window row is re-slotted, never published at its old time.
  assert.equal(slotVerdict({ scheduled_for: ph('2026-12-01T19:00:00').toISOString(), slot: null }, ph('2026-12-01T19:05:00')), 'reslot');
  assert.equal(slotVerdict({ scheduled_for: null, slot: null }, ph('2026-12-01T19:05:00')), 'wait');
});

test('the holiday extra publishes at 12:00 on its day and expires after', () => {
  const row = { scheduled_for: ph('2026-12-25T12:00:00').toISOString(), slot: 'holiday', source_type: 'library' };
  assert.equal(slotVerdict(row, ph('2026-12-25T12:10:00')), 'publish');
  assert.equal(slotVerdict(row, ph('2026-12-25T13:00:00')), 'expire');
  // A 12:00 row that does not say holiday is not a slot.
  assert.equal(slotVerdict({ ...row, slot: 'afternoon' }, ph('2026-12-25T12:10:00')), 'reslot');
});

test('a contested slot goes to the planned post; a sent post always keeps its slot', () => {
  const at = ph('2026-12-01T14:00:00').toISOString();
  const [auto, plan, live] = [
    { post_id: 'auto', source_type: 'vendor_feature', status: 'scheduled', scheduled_for: at, created_at: '2026-11-20T00:00:00Z' },
    { post_id: 'plan', source_type: 'library', status: 'scheduled', scheduled_for: at, created_at: '2026-11-29T00:00:00Z' },
    { post_id: 'live', source_type: 'live_update', status: 'scheduled', scheduled_for: at, created_at: '2026-11-21T00:00:00Z' },
  ] as const;
  assert.deepEqual(slotClashLosers([auto, plan, live]).sort(), ['auto', 'live']);
  assert.deepEqual(slotClashLosers([{ ...auto, status: 'published' }, plan]), ['plan']);
  assert.deepEqual(slotClashLosers([auto]), []);
});

test('"Post now" takes the slot open right now, else the next free 2 PM', () => {
  assert.equal(phTime(postNowSlot([], ph('2026-12-01T08:20:00')).at), '2026-12-01 08:00');
  assert.equal(postNowSlot([], ph('2026-12-01T08:20:00')).slot, 'morning');
  assert.equal(phTime(postNowSlot([ph('2026-12-01T08:00:00')], ph('2026-12-01T08:20:00')).at), '2026-12-01 14:00');
  assert.equal(phTime(postNowSlot([], ph('2026-12-01T10:00:00')).at), '2026-12-01 14:00');
  assert.equal(phTime(postNowSlot([], ph('2026-12-01T21:30:00')).at), '2026-12-02 14:00');
});

test('a missed planned post moves to the next free slot of its OWN kind; auto-posts take 2 PM', () => {
  assert.equal(reslotKind({ source_type: 'library', slot: 'morning' }), 'morning');
  assert.equal(reslotKind({ source_type: 'library', slot: 'evening' }), 'evening');
  assert.equal(reslotKind({ source_type: 'library', slot: 'holiday' }), 'afternoon');
  assert.equal(reslotKind({ source_type: 'vendor_feature', slot: 'morning' }), 'afternoon');
  assert.equal(reslotKind({ source_type: 'library', slot: null }), 'afternoon');
  // A missed 1 Dec morning, with the plan holding every morning through 31 Dec 2027, lands on 1 Jan 2028.
  const plannedMornings: Date[] = [];
  for (let d = new Date('2026-12-02T00:00:00Z'); d.getTime() <= new Date('2027-12-31T00:00:00Z').getTime(); d = new Date(d.getTime() + 864e5)) {
    plannedMornings.push(nextFreeSlot('morning', [], new Date(d.getTime() - 3600e3)));
  }
  assert.equal(phTime(nextFreeSlot('morning', plannedMornings, ph('2026-12-01T09:30:00'))), '2028-01-01 08:00');
});
