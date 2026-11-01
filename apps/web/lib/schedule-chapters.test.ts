/**
 * 📖 CHAPTERS — the pure half (lib/schedule-chapters.ts), held to the owner's 1 Nov rulings and to the SHAPE of a real
 * run of show (§3c): ingress and egress cross midnight, a chapter stops at the event day, a moment holds parallel
 * tasks in more than one place, and a clash is the same person or crew in two places at once — found, never refused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  capChapterDay,
  chapterLine,
  chapterWindowFlags,
  chaptersFromBlocks,
  egressAt,
  egressMinutesFrom,
  endIsoFrom,
  findTaskClashes,
  ingressAt,
  ingressMinutesFrom,
  taskPlace,
  taskRowFrom,
  whoKey,
  type MomentLike,
  type TaskRow,
} from './schedule-chapters';

const RECEPTION = '2026-12-18T18:00:00.000Z';

test('ingress may start the night before; blank means none', () => {
  assert.equal(ingressMinutesFrom(RECEPTION, '00:00'), 1080, 'ingress from 12:00 AM the same day');
  assert.equal(ingressMinutesFrom('2026-12-18T06:00:00.000Z', '23:00'), 420, 'ingress from 11 PM the night before a 6 AM call');
  assert.equal(ingressMinutesFrom(RECEPTION, '18:00'), 0);
  assert.equal(ingressMinutesFrom(RECEPTION, ''), null);
  assert.equal(ingressAt({ start_at: '2026-12-18T06:00:00.000Z', ingress_minutes_before: 420 }), '2026-12-17T23:00:00.000Z');
});

test('egress may run past midnight; blank means none', () => {
  assert.equal(egressMinutesFrom(RECEPTION, '01:00'), 420, 'egress until 1 AM the next day');
  assert.equal(egressAt({ start_at: RECEPTION, egress_minutes_after: 420 }), '2026-12-19T01:00:00.000Z');
  assert.equal(egressMinutesFrom(RECEPTION, ''), null);
  assert.equal(egressAt({ start_at: RECEPTION, egress_minutes_after: null }), null);
});

test('an egress before the chapter ends is FLAGGED, not refused', () => {
  const c = { start_at: RECEPTION, end_at: '2026-12-18T23:00:00.000Z', egress_minutes_after: egressMinutesFrom(RECEPTION, '22:00') };
  assert.deepEqual(chapterWindowFlags(c), ['egress_before_end']);
  assert.deepEqual(chapterWindowFlags({ ...c, egress_minutes_after: 420 }), []);
});

test('an end at or before the start is the next day (an after party 11 PM – 2 AM)', () => {
  assert.equal(endIsoFrom('2026-12-18T23:00:00.000Z', '02:00'), '2026-12-19T02:00:00.000Z');
  assert.equal(endIsoFrom(RECEPTION, '23:00'), '2026-12-18T23:00:00.000Z');
  assert.equal(endIsoFrom(RECEPTION, ''), null);
});

test('dates stop at the event day — a later day is set back and says so', () => {
  assert.deepEqual(capChapterDay('2026-12-20', '2026-12-18'), { day: '2026-12-18', capped: true });
  assert.deepEqual(capChapterDay('2026-12-01', '2026-12-18'), { day: '2026-12-01', capped: false });
  assert.deepEqual(capChapterDay('2027-01-01', null), { day: '2027-01-01', capped: false }, 'no exact event day: no cap');
});

test('a chapter with no venue reads "Venue TBA"', () => {
  assert.equal(chapterLine({ start_at: RECEPTION, location: null, spot: null }), '6:00 PM · Venue TBA');
  assert.equal(chapterLine({ start_at: '2026-12-18T06:00:00.000Z', location: 'Hotel Aurora', spot: 'Bridal suite' }), '6:00 AM · Hotel Aurora, Bridal suite');
});

test('every block of an event → its chapters, each with its moment count (one read, split here)', () => {
  const rows = [
    { block_id: 'c2', parent_block_id: null, label: 'Ceremony', start_at: '2026-12-18T15:00:00.000Z' },
    { block_id: 'c1', parent_block_id: null, label: 'Preparation · Bride', start_at: '2026-12-18T06:00:00.000Z', call_lead_minutes: 30 },
    { block_id: 'm1', parent_block_id: 'c1', label: 'Wake up', start_at: '2026-12-18T06:00:00.000Z' },
    { block_id: 'm2', parent_block_id: 'c1', label: 'Hair', start_at: '2026-12-18T06:30:00.000Z' },
  ];
  const cs = chaptersFromBlocks(rows);
  assert.deepEqual(cs.map((c) => [c.block_id, c.moments, c.call_lead_minutes]), [['c1', 2, 30], ['c2', 0, 60]]);
});

/* ── tasks ────────────────────────────────────────────────────────────────────────────────────────────────── */

const MOMENT: MomentLike = { block_id: 'm', start_at: '2026-12-18T08:00:00.000Z', end_at: '2026-12-18T08:30:00.000Z', location: null, spot: 'Bridal suite' };
const CHAPTER = { location: 'Hotel Aurora', spot: 'Bridal suite' };
const t = (id: string, who: Partial<TaskRow>, place: string | null, extra: Partial<TaskRow> = {}): TaskRow => ({
  task_id: id,
  block_id: 'm',
  vendor_id: null,
  crew: null,
  guest_id: null,
  group_id: null,
  role: null,
  who_label: null,
  what: 'something',
  call_at: null,
  place,
  sort_order: 0,
  ...who,
  ...extra,
});

test('a task with no place follows its moment’s room; its own place wins; a travel moment is from → to', () => {
  assert.equal(taskPlace(t('a', { role: 'Bride' }, null), MOMENT, CHAPTER), 'Hotel Aurora, Bridal suite');
  assert.equal(taskPlace(t('b', { role: 'Bride' }, '2F holding room'), MOMENT, CHAPTER), '2F holding room');
  assert.equal(
    taskPlace(t('c', { role: 'Groom' }, null), { ...MOMENT, travel_from: 'Hotel Aurora', travel_to: 'St. Mary’s Parish' }, CHAPTER),
    'Hotel Aurora → St. Mary’s Parish',
  );
});

test('one moment, three parallel tasks in two places — no clash', () => {
  const tasks = [
    t('1', { role: 'Bride' }, null),
    t('2', { vendor_id: 'hmua', crew: 'Team B' }, '2F holding room'),
    t('3', { vendor_id: 'coord', crew: 'Coord A' }, null),
  ];
  const places = new Set(tasks.map((x) => taskPlace(x, MOMENT, CHAPTER)));
  assert.equal(places.size, 2);
  assert.deepEqual(findTaskClashes(tasks.map((task) => ({ task, moment: MOMENT, chapter: CHAPTER }))), []);
});

test('the same crew in two places at once IS a clash; two crews of one supplier are not', () => {
  const sameCrew = [t('1', { vendor_id: 'coord', crew: 'Coord A' }, null), t('2', { vendor_id: 'coord', crew: ' coord a ' }, 'Lobby')];
  const clashes = findTaskClashes(sameCrew.map((task) => ({ task, moment: MOMENT, chapter: CHAPTER })));
  assert.equal(clashes.length, 1);
  assert.deepEqual(clashes[0]!.places, ['Hotel Aurora, Bridal suite', 'Lobby']);

  const twoCrews = [t('1', { vendor_id: 'photo', crew: 'Team A' }, 'Bridal suite'), t('2', { vendor_id: 'photo', crew: 'Team B' }, 'Groom’s room')];
  assert.deepEqual(findTaskClashes(twoCrews.map((task) => ({ task, moment: MOMENT, chapter: CHAPTER }))), []);
});

test('no overlap in time, no clash; a task’s own call time widens when it is busy', () => {
  const later: MomentLike = { ...MOMENT, block_id: 'n', start_at: '2026-12-18T09:00:00.000Z', end_at: '2026-12-18T09:30:00.000Z' };
  const a = { task: t('1', { role: 'Bride' }, 'Suite'), moment: MOMENT };
  const b = { task: t('2', { role: 'Bride' }, 'Lobby'), moment: later };
  assert.deepEqual(findTaskClashes([a, b]), []);
  const early = { task: t('2', { role: 'Bride' }, 'Lobby', { call_at: '2026-12-18T08:15:00.000Z' }), moment: later };
  assert.equal(findTaskClashes([a, early]).length, 1, 'called at 8:15 for a 9:00 moment: busy from 8:15');
});

test('a task has exactly one who, and says what is wrong in words', () => {
  assert.equal(taskRowFrom('m', { who: { kind: 'role', role: 'Bride' }, what: '  ' }).ok, false);
  const ok = taskRowFrom('m', { who: { kind: 'supplier', vendorId: 'v', crew: ' Team A ' }, what: 'Shoot details' });
  assert.ok(ok.ok);
  if (ok.ok) {
    const whos = ['vendor_id', 'guest_id', 'group_id', 'role', 'who_label'].filter((k) => ok.row[k] !== null);
    assert.deepEqual(whos, ['vendor_id']);
    assert.equal(ok.row.crew, 'Team A');
  }
  assert.notEqual(whoKey({ kind: 'supplier', vendorId: 'v', crew: 'Team A' }), whoKey({ kind: 'supplier', vendorId: 'v', crew: 'Team B' }));
});
