/**
 * 🕑 A MOMENT'S TIME AS THE COORDINATOR WROTE IT — "About 3:15 PM", "2:15/2:30 PM" (owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (2); migration 20271303051692, held in the database
 * by tests/db/a-moment-time-can-be-about-or-either.db.test.ts).
 *
 * The words come from ONE place (`timeAsWritten`, through `momentClockWords`), so the host's run of show, the guest's
 * "Your schedule" and the supplier's Schedule view can never disagree; the moment sheet offers the shape in the ONE
 * When ▾ dropdown (no pill row).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { orAt, orMinutesBetween, timeAsWritten } from '../../../../lib/time-shape';
import { momentClockWords } from '../../../../lib/moment-order';
import { clockWords, momentFactsFromBlocks, type Chapter, type TaskRow } from '../../../../lib/schedule-chapters';
import { yourSchedule, type YourMoment } from '../../../../lib/guest-your-schedule';
import { buildSupplierDay, type SupplierBlockRow } from '../../../../lib/supplier-schedule';

const DAY = '2099-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;
const CH = 'c0000000-0000-4000-8000-000000000002';

test('the words: exactly, about, one of two — sharing AM/PM once, keeping both across noon', () => {
  assert.equal(timeAsWritten({ start_at: at('15:15') }, clockWords), '3:15 PM');
  assert.equal(timeAsWritten({ start_at: at('15:15'), time_shape: 'about' }, clockWords), 'About 3:15 PM');
  assert.equal(timeAsWritten({ start_at: at('14:15'), time_shape: 'or', time_or_minutes: 15 }, clockWords), '2:15/2:30 PM');
  assert.equal(timeAsWritten({ start_at: at('15:15'), time_shape: 'or', time_or_minutes: 5 }, clockWords), '3:15/3:20 PM');
  assert.equal(timeAsWritten({ start_at: at('11:45'), time_shape: 'or', time_or_minutes: 15 }, clockWords), '11:45 AM/12:00 PM');
  // A broken 'or' (no second time) says the first, true clock — never "undefined".
  assert.equal(timeAsWritten({ start_at: at('14:15'), time_shape: 'or', time_or_minutes: null }, clockWords), '2:15 PM');
  // The second time is minutes after the first; out of range is refused.
  assert.equal(orMinutesBetween(at('14:15'), at('14:30')), 15);
  assert.equal(orMinutesBetween(at('14:30'), at('14:15')), null);
  assert.equal(orMinutesBetween(at('10:00'), at('14:01')), null);
  assert.equal(orAt(at('14:15'), 15), at('14:30'));
});

test('a TBA row is never "about" — "Time TBA" and "Right after" win', () => {
  assert.equal(momentClockWords({ parent_block_id: CH, time_tba: true, start_at: at('14:15'), time_shape: 'about' }, null, clockWords), 'Right after');
  assert.equal(momentClockWords({ parent_block_id: CH, start_at: at('14:15'), time_shape: 'about' }, { time_tba: true }, clockWords), 'Time TBA');
});

test('the host\'s moment facts carry the shape from the chapter read', () => {
  const [f] = momentFactsFromBlocks([{ block_id: 'm', parent_block_id: CH, time_shape: 'or', time_or_minutes: 15 }]);
  assert.equal(f!.time_shape, 'or');
  assert.equal(f!.time_or_minutes, 15);
  const [g] = momentFactsFromBlocks([{ block_id: 'n', parent_block_id: CH, time_shape: 'sometime', time_or_minutes: 999 }]);
  assert.equal(g!.time_shape, 'at', 'an unknown word read as a shape');
  assert.equal(g!.time_or_minutes, null);
});

const chapter: Chapter = {
  block_id: CH, label: 'Ceremony', start_at: at('14:00'), end_at: at('17:00'), location: 'San Agustin', spot: null, notes: null,
  ingress_minutes_before: null, egress_minutes_after: null, call_lead_minutes: 60, on_invitation: true, photo_who: 'chapter',
  photo_when: 'right_away', is_public: true, moments: 2, time_tba: false,
};
const car = { block_id: 'm-car', parent_block_id: CH, label: 'Bridal car leaves', start_at: at('14:15'), end_at: at('14:45'), time_shape: 'or', time_or_minutes: 15 };
const line = { block_id: 'm-line', parent_block_id: CH, label: 'Entourage lines up', start_at: at('15:15'), end_at: at('15:30'), time_shape: 'about', time_or_minutes: null };

test('"Your schedule" says them as written', () => {
  const moments: YourMoment[] = [car, line].map((m) => ({ ...m, location: null, is_public: true, audience: null, staged: false }));
  const out = yourSchedule({
    chapters: [chapter],
    moments,
    tasks: [] as TaskRow[],
    viewer: { guestId: 'g', roles: [], groupIds: [] },
    released: true,
    pro: true,
    guestsArriveBy: null,
  });
  assert.equal(out.kind, 'ok');
  assert.deepEqual(out.kind === 'ok' ? out.chapters[0]!.lines.map((l) => l.time) : [], ['2:15/2:30 PM', 'About 3:15 PM']);
});

test('the supplier\'s Schedule view says them as written', () => {
  const rows: SupplierBlockRow[] = [
    { block_id: CH, parent_block_id: null, label: 'Ceremony', start_at: chapter.start_at, end_at: chapter.end_at, location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['v'], created_at: null, updated_at: null },
    ...[car, line].map((m) => ({ ...m, location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['v'], created_at: null, updated_at: null })),
  ];
  const day = buildSupplierDay({ blocks: rows, myBookingIds: ['v'], tasks: [], requests: [] });
  assert.deepEqual(day.chapters[0]!.moments.map((m) => m.clock), ['2:15/2:30 PM', 'About 3:15 PM']);
});

test('the moment sheet: the shape is in the ONE When ▾ dropdown, and the second time is its own Time row', () => {
  const sheets = readFileSync(join(__dirname, '_components/moment-sheets.tsx'), 'utf8');
  assert.match(sheets, /\{ key: 'about', label: 'About a time' \}/);
  assert.match(sheets, /\{ key: 'or', label: 'One of two times' \}/);
  assert.match(sheets, /name="Or at"/);
  // Both readers post it through the schedule's own doors.
  const actions = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
  assert.match(actions, /function timeShapeFrom\(/);
  assert.equal((actions.match(/timeShapeFrom\(formData\)/g) ?? []).length, 2, 'create AND update must read the shape');
});
