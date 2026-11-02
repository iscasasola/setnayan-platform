/**
 * ✅ THE HOST SEES "CONFIRM MY TIMES" (supplier gate audit G6, 2026-11-02). The supplier's Confirm my times / Seen
 * (`supplier_mark_schedule` → `event_supplier_schedule_marks`) told them "The host sees your times are final" while no
 * host screen read the row. Held here, on the shipped pieces:
 *   1 · the rule — Confirmed wins over Seen; nothing pressed says nothing;
 *   2 · the Schedule — the moment's supplier line (`supplierOnItem`, built by `scheduleSuppliersFrom` from the marks
 *       `readScheduleSuppliers` reads) says "· Times confirmed" / "· Seen";
 *   3 · Suppliers › Booked — the Team row's mark (`timesMarkFor`), keyed by the booking's shop; a refused read says so;
 *       the slot reads the marks and hands them over, and the row's fold draws them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { TIMES_MARK_UNREAD, timesMarkOf, type ScheduleMarkFacts } from './supplier-schedule-marks';
import { scheduleSuppliersFrom, type ScheduleSupplierRow } from './schedule-suppliers';
import { timesMarkFor } from './booked-rows';
import { supplierOnItem } from '../app/dashboard/[eventId]/schedule/_components/day-types';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CONFIRMED: ScheduleMarkFacts = { seenAt: '2026-11-01T02:00:00Z', confirmedAt: '2026-11-02T02:00:00Z' };
const SEEN: ScheduleMarkFacts = { seenAt: '2026-11-01T02:00:00Z', confirmedAt: null };

test('1 · Confirmed wins over Seen; nothing pressed says nothing', () => {
  assert.equal(timesMarkOf(CONFIRMED)?.word, 'Times confirmed');
  assert.equal(timesMarkOf(SEEN)?.word, 'Seen');
  assert.equal(timesMarkOf({ seenAt: null, confirmedAt: null }), null);
  assert.equal(timesMarkOf(undefined), null);
});

test('2 · the Schedule’s supplier line says what the supplier pressed', () => {
  const rows: ScheduleSupplierRow[] = [
    { vendor_id: 'ev-1', vendor_name: 'Kusina', status: 'contracted', marketplace_vendor_id: 'shop-1', manual_vendor_id: null },
    { vendor_id: 'ev-2', vendor_name: 'Lights', status: 'contracted', marketplace_vendor_id: 'shop-2', manual_vendor_id: null },
    { vendor_id: 'ev-3', vendor_name: 'Tita', status: 'considering', marketplace_vendor_id: null, manual_vendor_id: 'm-1' },
  ];
  const marks = new Map<string, ScheduleMarkFacts>([['shop-1', CONFIRMED], ['shop-2', SEEN]]);
  const out = new Map(scheduleSuppliersFrom(rows, new Map(), marks).map((s) => [s.vendor_id, supplierOnItem(s)]));
  assert.equal(out.get('ev-1'), 'Kusina · Booked · Times confirmed');
  assert.equal(out.get('ev-2'), 'Lights · Booked · Seen');
  assert.ok(!/Seen|confirmed/.test(out.get('ev-3') ?? ''), 'a supplier who pressed nothing gets no mark');
  // The page's one read hands the marks over.
  const src = read('lib/schedule-suppliers-read.ts');
  assert.match(src, /from\('event_supplier_schedule_marks'\)/);
  assert.match(src, /return scheduleSuppliersFrom\(rows, names, marks\)/);
});

test('3 · Suppliers › Booked: the Team row’s mark, by shop; a refused read is said', () => {
  const marks = new Map<string, ScheduleMarkFacts>([['shop-1', CONFIRMED]]);
  assert.deepEqual(timesMarkFor(marks, 'shop-1'), { kind: 'mark', line: 'Times confirmed · Nov 2', confirmed: true });
  assert.equal(timesMarkFor(marks, 'shop-9'), null);
  assert.equal(timesMarkFor(marks, null), null, 'a supplier not on Setnayan has no shop to press anything');
  assert.deepEqual(timesMarkFor(null, 'shop-1'), { kind: 'unread' });
  assert.equal(timesMarkFor(undefined, 'shop-1'), null);
  assert.ok(TIMES_MARK_UNREAD.length > 20);

  const slot = read('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx');
  assert.match(slot, /readScheduleMarks\(supabase, eventId\)/, 'the Booked slot must read the marks');
  assert.match(slot, /\n\s*marks,\n/, 'and hand them to bookedView');
  const rows = read('lib/booked-rows.ts');
  assert.match(rows, /timesMark: timesMarkFor\(extra\.marks, f\.shopId\)/);
  const row = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');
  assert.match(row, /\{row\.timesMark \? <TimesMarkLine mark=\{row\.timesMark\} \/> : null\}/, 'the Team row draws it');
});
