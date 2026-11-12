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
  newDoneWarnings,
  quarterHourChoices,
  shopNamesOf,
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
const CAR = 'ev-car';
const CH = 'ch-ceremony';
const SHOPS = shopNamesOf([
  { id: ROSA, name: 'Rosa Lens Studio' },
  { id: CAR, name: 'Juan’s Wedding Cars' },
  { id: 'ev-k', name: 'Kusina' },
]);
const moments = [
  { block_id: 'm-vows', parent_block_id: CH, label: 'Vows', start_at: '2026-12-18T14:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-arr', parent_block_id: CH, label: 'Rosa Lens Studio arrives', start_at: '2026-12-18T12:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-done', parent_block_id: CH, label: 'Rosa Lens Studio is done', start_at: '2026-12-18T22:30:00.000Z', responsible_vendor_ids: [ROSA] },
  { block_id: 'm-bride', parent_block_id: CH, label: 'Bride arrives', start_at: '2026-12-18T13:45:00.000Z', responsible_vendor_ids: [] },
  { block_id: 'm-car', parent_block_id: CH, label: 'Bridal car arrives', start_at: '2026-12-18T13:30:00.000Z', responsible_vendor_ids: [CAR] },
  { block_id: 'm-other', parent_block_id: 'ch-reception', label: 'Kusina is done', start_at: '2026-12-18T23:00:00.000Z', responsible_vendor_ids: ['ev-k'] },
];

test('the words My times writes are the words read back — one spelling', () => {
  const asked = timesRequests({ shop: 'Rosa Lens Studio', chapter: { block_id: CH, start_at: '2026-12-18T14:00:00.000Z' }, arrive: '12:30', done: '22:30' });
  assert.deepEqual(asked.map((a) => a.label), [`Rosa Lens Studio${TIMES_SUFFIX.arrive}`, `Rosa Lens Studio${TIMES_SUFFIX.done}`]);
  for (const a of asked) assert.ok(supplierTimeOf({ label: a.label, responsible_vendor_ids: [ROSA] }, SHOPS));
});

test('1 · a chapter move keeps only the supplier’s own arrive / done — never the couple’s "Bride arrives"', () => {
  assert.deepEqual(timesThatStay(CH, moments, SHOPS), ['m-arr', 'm-done']);
  assert.equal(supplierTimeOf({ label: 'Bride arrives', responsible_vendor_ids: [] }, SHOPS), null);
});

test('1 · ruling 5574 #7 — a host moment with a supplier tagged on it MOVES unless it starts with that shop’s name', () => {
  // "Bridal car arrives" carries the car hire's booking, and the My-times words — but it is the couple's moment.
  assert.equal(supplierTimeOf({ label: 'Bridal car arrives', responsible_vendor_ids: [CAR] }, SHOPS), null);
  assert.ok(!timesThatStay(CH, moments, SHOPS).includes('m-car'), 'the bridal car moves with its chapter');
  assert.equal(supplierTimeOf({ label: 'Juan’s Wedding Cars arrives', responsible_vendor_ids: [CAR] }, SHOPS), 'arrive');
  // Another shop's name does not count: the label must start with a shop TAGGED on that moment.
  assert.equal(supplierTimeOf({ label: 'Rosa Lens Studio arrives', responsible_vendor_ids: [CAR] }, SHOPS), null);
  // A booking whose name was not read keeps nothing — the moment moves, as shipped, rather than guessing.
  assert.equal(supplierTimeOf({ label: 'Rosa Lens Studio arrives', responsible_vendor_ids: [ROSA] }, new Map()), null);
  // The server door reads the names before it decides, and refuses rather than guesses when they are refused.
  const src = read('app/dashboard/[eventId]/schedule/actions.ts');
  assert.match(src, /readShopNames\(supabase, eventId, part\.before\)/);
  assert.match(src, /if \(withMoments && !shops\) throw/);
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
  assert.match(src, /timesThatStay\(blockId, part\.before, shops\)/);
  assert.match(src, /p_keep_block_ids: keep/);
  assert.match(src, /postChapterMovedLines\(part, blockId, movedFrom, movedTo\)/);
  // 🔒 Lock my times still refuses: the lock check runs on every moment that MOVES.
  assert.match(src, /refuseLockedPart\(\s*supabase,\s*part,/);
});

test('2 · "done" warns before Save and never blocks; only a new crossing warns', () => {
  const later = doneWarnings({ start_at: '2026-12-18T18:00:00Z', end_at: '2026-12-18T23:00:00Z' }, CH, moments, SHOPS);
  assert.deepEqual(later.map((w) => w.line), ['Rosa Lens Studio is done at 10:30 PM — ask them?']);
  assert.deepEqual(doneWarnings({ start_at: '2026-12-18T14:00:00Z', end_at: '2026-12-18T22:00:00Z' }, CH, moments, SHOPS), []);
  // Only a NEW crossing warns: one already true before the edit was already said.
  const was = { start_at: '2026-12-18T18:00:00Z', end_at: '2026-12-18T23:00:00Z' };
  assert.deepEqual(newDoneWarnings(was, { start_at: '2026-12-18T18:30:00Z', end_at: '2026-12-18T23:30:00Z' }, CH, moments, SHOPS), []);
  assert.equal(newDoneWarnings({ start_at: '2026-12-18T14:00:00Z', end_at: '2026-12-18T22:00:00Z' }, was, CH, moments, SHOPS).length, 1);
  const sheet = read('app/dashboard/[eventId]/schedule/_components/chapter-sheets.tsx');
  assert.match(sheet, /label="Save anyway"/, 'a warning that cannot be passed is a block');
  assert.match(sheet, /label=\{`Keep \$\{keepWords\}`\}/, 'the prototype’s Keep <time> answers it without saving');
  assert.match(sheet, /newDoneWarnings\(/, 'the sheet runs the one gate');
  // Closing the sheet with the warning up SETTLES it — no save left hanging.
  assert.match(sheet, /onClose=\{close\}/);
  assert.match(sheet, /const close = \(\) => \{\s*settleUnsaved\(/);
});

test('2 · the board’s drag runs the SAME gate — it never saves straight past a supplier’s "done"', () => {
  const host = read('app/dashboard/[eventId]/schedule/_components/chapters-host.tsx');
  const drag = host.slice(host.indexOf('moveChapter: (id, minutes) =>'), host.indexOf('moveChapter: (id, minutes) =>') + 3000);
  assert.match(drag, /newDoneWarnings\(/, 'the drag computes the warning');
  assert.match(drag, /if \(lines\.length === 0\) return save\(\);\s*setDragWarn\(/, 'a crossing waits for an answer');
  assert.ok(drag.indexOf('newDoneWarnings(') < drag.indexOf('return save();'), 'the gate runs before the save');
  assert.match(host, /<DoneWarningBox/, 'the same box as Chapter details');
});

test('5 · Starts ▾ / Ends ▾ open quarter-hour choices that say what they do', () => {
  const opts = quarterHourChoices({ current: '18:00', end: '22:00', none: 'Time TBA' });
  assert.equal(opts[0]!.label, 'Time TBA');
  assert.ok(opts.every((o, i) => i === 0 || /^\d{2}:(00|15|30|45)$/.test(o.key)));
  assert.equal(opts.find((o) => o.key === '18:00')?.hint, 'as planned');
  assert.equal(opts.find((o) => o.key === '18:30')?.hint, '30 min later · ends 10:30 PM');
  const off = quarterHourChoices({ current: '18:10' });
  assert.ok(off.some((o) => o.key === '18:10'), 'a time off the grid is still listed, so the pill never reads blank');
  const sheet = read('app/dashboard/[eventId]/schedule/_components/chapter-sheets.tsx');
  assert.match(sheet, /<ChosenRow\s+name="Starts"/);
  assert.match(sheet, /<ChosenRow\s+name="Ends"/);
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
    scheduleChange: { messageId: 'msg-1', at: '2026-11-12T10:00:00Z', body: 'Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later', seenAt: null, unseen: 3 },
  };
  const vendor = buildPinFacts(base).filter((f) => f.kind === 'schedule_change');
  assert.equal(vendor.length, 1);
  assert.equal(vendor[0]!.title, 'Ceremony is now 30 min later than you planned');
  assert.equal(vendor[0]!.answerer, 'you');
  assert.equal(vendor[0]!.olderCount, 2, '+ 2 older changes under the newest');
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
  assert.deepEqual(bookedRowHours({ bookedDate: '2026-12-18', bookingId: ROSA, isHall: false, chapters, moments: ms, shops: SHOPS }), {
    hours: '2:00 PM – 11:00 PM',
    mine: 'you arrive 12:30 PM · done 10:30 PM',
  });
  assert.deepEqual(bookedRowHours({ bookedDate: '2026-12-18', bookingId: 'ev-hall-b', isHall: true, chapters, moments: ms, shops: SHOPS }), {
    hours: 'Reception · 6:00 PM – 11:00 PM',
    mine: null,
  });
  assert.equal(bookedRowHours({ bookedDate: '2026-12-18', bookingId: 'ev-hall-c', isHall: true, chapters, moments: ms, shops: SHOPS }).hours, null, 'a hall with no chapter of its own never shows the whole event');
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
  // Two lines (approved prototype): the hours, then the shop's own times — never one line that wraps at 390 px.
  assert.equal(rows[0]?.line, '2:00 PM – 11:00 PM');
  assert.equal(rows[0]?.line2, 'you arrive 12:30 PM · done 10:30 PM');
  // A refused hours read keeps "Booked here" and SAYS so.
  const unread = dayRowsOf('2026-12-18', {
    today: '2026-11-12',
    poolIds: new Set(['p1']),
    poolLabel: () => 'Video team',
    namePools: false,
    bookings: [{ poolId: 'p1', bookedDate: '2026-12-18', eventName: 'Ana & Miguel', hours: null, mine: null, hoursUnread: true }],
    blocks: [],
    holds: [],
    asking: 0,
    waiting: 0,
  });
  assert.equal(unread[0]?.line, 'Booked here');
  assert.equal(unread[0]?.unread, true);
  assert.match(read('app/vendor-dashboard/customers/_components/customers-calendar.tsx'), /Couldn&rsquo;t read the hours/);
});

test('6 · ruling 5606 #4 — a non-hall booked day whose chapters are all TBA reads "Time TBA"', () => {
  const tba = [
    { block_id: 'c1', label: 'Ceremony', start_at: '2026-12-18T00:00:00Z', end_at: null, time_tba: true, responsible_vendor_ids: [ROSA], hours_vendor_id: null },
    { block_id: 'c2', label: 'Reception', start_at: '2026-12-18T00:00:00Z', end_at: null, time_tba: true, responsible_vendor_ids: [], hours_vendor_id: null },
  ];
  assert.equal(bookedRowHours({ bookedDate: '2026-12-18', bookingId: ROSA, isHall: false, chapters: tba, moments: [], shops: SHOPS }).hours, 'Time TBA');
  assert.equal(bookedRowHours({ bookedDate: '2026-12-19', bookingId: ROSA, isHall: false, chapters: tba, moments: [], shops: SHOPS }).hours, null, 'no chapter that day — no hours');
});

test('3 · the hosts’ copy says "<Shop> hasn’t seen it yet"; the pin counts older changes', () => {
  const card = read('app/_components/chat/cards/schedule-change-card.tsx');
  assert.match(card, /\{supplierName\} hasn’t seen it yet/);
  const pins = read('app/_components/chat/chat-pins.tsx');
  assert.match(pins, /older change\{f\.olderCount === 1 \? '' : 's'\} · Seen answers them all/);
});
