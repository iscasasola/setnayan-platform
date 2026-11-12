/**
 * 🗓 SCHEDULES HAND-IN-HAND part (b) — the four owner rules (2026-11-12), held on the pure half and on the wiring.
 *
 *   1 · a chapter move leaves a supplier's arrive / done where they are; the card says "… later than you planned";
 *   2 · a supplier's "done" warns before Save, never blocks; Lock my times still refuses, as shipped;
 *   3 · the card pins on the supplier's side until Seen — never on the hosts';
 *   4 · a hall's booked row reads only the chapter held in that hall.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  TIMES_SUFFIX,
  bookedRowHours,
  doneWarnings,
  scheduleChangeHeadline,
  scheduleChangeLine,
  scheduleChangePinned,
  shiftWords,
  supplierTimeOf,
  timesThatStay,
} from './schedule-hand-in-hand';
import { scheduleChangeFromLine, streamLineKind } from './chat-card-lines';
import { timesRequests } from './supplier-schedule';
import { buildPinFacts, type PinFactInputs } from './chat-pin-facts';
import { dayRowsOf } from './vendor-dates';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const ROSA = 'ev-rosa';
const CH = 'ch-ceremony';
const moments = [
  { block_id: 'm-vows', parent_block_id: CH, label: 'Vows', start_at: '2026-12-18T14:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-arr', parent_block_id: CH, label: 'Rosa Lens Studio arrives', start_at: '2026-12-18T12:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-done', parent_block_id: CH, label: 'Rosa Lens Studio is done', start_at: '2026-12-18T22:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-bride', parent_block_id: CH, label: 'Bride arrives', start_at: '2026-12-18T13:45:00.000Z', responsible_vendor_ids: [] },
  { block_id: 'm-other', parent_block_id: 'ch-reception', label: 'Kusina is done', start_at: '2026-12-18T23:00:00.000Z', responsible_vendor_ids: ['ev-k'] },
];

test('the words My times writes are the words read back — one spelling', () => {
  const asked = timesRequests({ shop: 'Rosa Lens Studio', chapter: { block_id: CH, start_at: '2026-12-18T14:00:00.000Z' }, arrive: '12:30', done: '22:30' });
  assert.deepEqual(asked.map((a) => a.label), [`Rosa Lens Studio${TIMES_SUFFIX.arrive}`, `Rosa Lens Studio${TIMES_SUFFIX.done}`]);
  for (const a of asked) assert.ok(supplierTimeOf({ label: a.label, responsible_vendor_ids: [ROSA] }));
});

test('1 · a chapter move keeps only the supplier’s own arrive / done — never the couple’s "Bride arrives"', () => {
  assert.deepEqual(timesThatStay(CH, moments), ['m-arr', 'm-done']);
  assert.equal(supplierTimeOf({ label: 'Bride arrives', responsible_vendor_ids: [] }), null);
});

test('1 · the line and the card say what moved against what they planned', () => {
  const line = scheduleChangeLine({ label: 'Ceremony', fromIso: '2026-12-18T14:00:00+00:00', toIso: '2026-12-18T14:30:00.000Z' });
  assert.equal(line, 'Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later');
  const said = scheduleChangeFromLine(line);
  assert.deepEqual(said, { chapter: 'Ceremony', from: '2:00 PM', to: '2:30 PM', shift: '30 min later' });
  assert.equal(scheduleChangeHeadline(said!.chapter, said!.shift, 'you'), 'Ceremony is now 30 min later than you planned');
  assert.equal(streamLineKind(line), 'schedule');
  assert.equal(shiftWords(-75), '1 hr 15 min earlier');
  assert.equal(shiftWords(0), null);
  assert.equal(scheduleChangeLine({ label: 'Ceremony', fromIso: '2026-12-18T14:00:00Z', toIso: '2026-12-18T14:00:00Z' }), null, 'no move, no line');
  const twoDots = scheduleChangeLine({ label: 'Church · Part 2', fromIso: '2026-12-18T14:00:00Z', toIso: '2026-12-19T15:00:00Z' })!;
  assert.equal(scheduleChangeFromLine(twoDots)?.chapter, 'Church · Part 2');
  assert.equal(scheduleChangeFromLine(twoDots)?.shift, '1 day 1 hr later');
});

test('1 · the host action passes the kept times to the one door and posts the card', () => {
  const src = read('app/dashboard/[eventId]/schedule/actions.ts');
  assert.match(src, /timesThatStay\(blockId, part\.before\)/);
  assert.match(src, /p_keep_block_ids: keep/);
  assert.match(src, /postChapterMovedLines\(part, blockId, movedFrom, movedTo\)/);
  // 🔒 Lock my times still refuses: the lock check runs on every moment that MOVES.
  assert.match(src, /refuseLockedPart\(\s*supabase,\s*part,/);
});

test('2 · "done" warns before Save and never blocks; only a new crossing warns', () => {
  const later = doneWarnings({ start_at: '2026-12-18T18:00:00Z', end_at: '2026-12-18T23:00:00Z' }, CH, moments);
  assert.deepEqual(later.map((w) => w.line), ['Rosa Lens Studio is done at 10:30 PM — ask them?']);
  assert.deepEqual(doneWarnings({ start_at: '2026-12-18T14:00:00Z', end_at: '2026-12-18T22:00:00Z' }, CH, moments), []);
  const sheet = read('app/dashboard/[eventId]/schedule/_components/chapter-sheets.tsx');
  assert.match(sheet, /label="Save anyway"/, 'a warning that cannot be passed is a block');
  assert.match(sheet, /already\.has\(w\.blockId\)/, 'a crossing already true before the edit warns again');
});

test('3 · the card pins on the supplier’s side until Seen, never on the hosts’', () => {
  assert.equal(scheduleChangePinned('2026-11-12T10:00:00Z', null), true, 'never seen');
  assert.equal(scheduleChangePinned('2026-11-12T10:00:00Z', '2026-11-12T09:00:00Z'), true, 'seen before the change');
  assert.equal(scheduleChangePinned('2026-11-12T10:00:00Z', '2026-11-12T11:00:00Z'), false, 'seen after it');
  const base: PinFactInputs = {
    side: 'vendor',
    themName: 'Ana & Miguel',
    supplierName: 'Rosa Lens Studio',
    nowMs: Date.parse('2026-11-12T12:00:00Z'),
    mayReadMoney: true,
    money: null,
    callTime: null,
    accessAsks: null,
    feeBills: null,
    coordinatorAgree: null,
    quote: null,
    decisions: null,
    todayPh: '2026-11-12',
    scheduleChange: { messageId: 'msg-1', at: '2026-11-12T10:00:00Z', body: 'Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later', seenAt: null },
  };
  const vendor = buildPinFacts(base).filter((f) => f.kind === 'schedule_change');
  assert.equal(vendor.length, 1);
  assert.equal(vendor[0]!.title, 'Ceremony is now 30 min later than you planned');
  assert.equal(vendor[0]!.answerer, 'you');
  assert.equal(buildPinFacts({ ...base, side: 'couple' }).filter((f) => f.kind === 'schedule_change').length, 0, 'the hosts applied it — no answer is asked of them');
  assert.equal(
    buildPinFacts({ ...base, scheduleChange: { ...base.scheduleChange!, seenAt: '2026-11-12T11:00:00Z' } }).filter((f) => f.kind === 'schedule_change').length,
    0,
    'Seen unpins it',
  );
});

test('4 · a booked row says the day’s hours and the shop’s own times; a hall reads only its own chapter', () => {
  const chapters = [
    { block_id: CH, label: 'Ceremony', start_at: '2026-12-18T14:00:00Z', end_at: '2026-12-18T15:30:00Z', time_tba: false, responsible_vendor_ids: [ROSA], hours_vendor_id: null },
    { block_id: 'ch-reception', label: 'Reception', start_at: '2026-12-18T18:00:00Z', end_at: '2026-12-18T23:00:00Z', time_tba: false, responsible_vendor_ids: ['ev-hall-b'], hours_vendor_id: 'ev-hall-b' },
  ];
  const ms = moments.map((m) => ({ label: m.label, start_at: m.start_at, responsible_vendor_ids: m.responsible_vendor_ids, parent_block_id: m.parent_block_id }));
  assert.deepEqual(bookedRowHours({ bookedDate: '2026-12-18', bookingId: ROSA, isHall: false, chapters, moments: ms }), {
    hours: '2:00 PM – 11:00 PM',
    mine: 'you arrive 12:30 PM · done 10:30 PM',
  });
  assert.deepEqual(bookedRowHours({ bookedDate: '2026-12-18', bookingId: 'ev-hall-b', isHall: true, chapters, moments: ms }), {
    hours: 'Reception · 6:00 PM – 11:00 PM',
    mine: null,
  });
  assert.equal(bookedRowHours({ bookedDate: '2026-12-18', bookingId: 'ev-hall-c', isHall: true, chapters, moments: ms }).hours, null, 'a hall with no chapter of its own never shows the whole event');
  const rows = dayRowsOf('2026-12-18', {
    today: '2026-11-12',
    poolIds: new Set(['p1']),
    poolLabel: () => 'Video team',
    namePools: false,
    bookings: [{ poolId: 'p1', bookedDate: '2026-12-18', eventName: 'Ana & Miguel', hours: '2:00 PM – 11:00 PM', mine: 'you arrive 12:30 PM · done 10:30 PM' }],
    blocks: [],
    holds: [],
    asking: 0,
    waiting: 0,
  });
  assert.equal(rows[0]?.line, '2:00 PM – 11:00 PM · you arrive 12:30 PM · done 10:30 PM');
});
