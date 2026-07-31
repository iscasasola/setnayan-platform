/**
 * checklist-short-runway.test.ts — a hangout is not a wedding.
 *
 * TWO DEFECTS PINNED HERE:
 *
 * 1. `date` and `hangout` had no checklist of their own, so they fell to
 *    `GENERIC_EVENT_CHECKLIST_DEF` (= the CELEBRATION template), whose offsets
 *    run 90 → 7 days. A dinner date next Friday therefore opened with NINE
 *    tasks already in the past — under the heading "4–2 months before".
 *
 * 2. The phase ladder was hardcoded wedding-shaped for every type: it topped out
 *    at "18–12 months before" and ended at "Wedding day & after".
 *
 * 3. …and the fix itself introduced a third, caught before commit: the group
 *    builder keyed buckets with one ladder and then FILTERED the other. For a
 *    short-runway type the buckets are s1/s2/s3 while the filter walked p1…p9,
 *    matching nothing — every item would have vanished from the page with no
 *    error at all. That is the case `groups are never silently dropped` exists
 *    for, and it is the most important test in this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKLIST_PHASES,
  CHECKLIST_PHASES_SHORT,
  checklistPhaseLabel,
  checklistPhasesFor,
  groupChecklistByPhase,
  phaseForOffset,
  type ChecklistItemRow,
} from './checklist';
import { checklistDefForEventType } from './checklist-event-type-defs';

const row = (key: string, offset: number): ChecklistItemRow =>
  ({
    item_id: key,
    public_id: key,
    task_key: key,
    title: key,
    category: 'logistics',
    status: 'todo',
    due_offset_days: offset,
    sort_order: 0,
  }) as unknown as ChecklistItemRow;

test('date and hangout now have their OWN short template, not the 90-day party runway', () => {
  for (const t of ['date', 'hangout']) {
    const def = checklistDefForEventType(t);
    assert.ok(def, `${t} must have its own def`);
    const offsets = def!.template.map((i) => i.dueOffsetDays ?? 0);
    assert.ok(
      Math.max(...offsets) <= 7,
      `${t} longest lead time is ${Math.max(...offsets)}d — must be a week or less`,
    );
    assert.ok(def!.template.length <= 5, `${t} should be short, got ${def!.template.length}`);
  }
});

test('short-runway types get the short ladder; everyone else keeps the long one', () => {
  assert.equal(checklistPhasesFor('date'), CHECKLIST_PHASES_SHORT);
  assert.equal(checklistPhasesFor('hangout'), CHECKLIST_PHASES_SHORT);
  for (const t of ['wedding', 'debut', 'corporate', 'anniversary', null, undefined]) {
    assert.equal(checklistPhasesFor(t), CHECKLIST_PHASES, `${t} should keep the long ladder`);
  }
});

test('a 3-day task on a hangout is captioned in days, not months', () => {
  const p = phaseForOffset(3, 'hangout');
  assert.ok(p);
  assert.equal(p!.label, 'A few days before');
  // …and the same offset on a wedding still reads the wedding way
  assert.equal(phaseForOffset(3, 'wedding')!.label, 'The final 2 weeks');
});

test('"Wedding day & after" never captions a non-wedding event', () => {
  const last = CHECKLIST_PHASES.find((p) => p.id === 'p9')!;
  assert.match(last.label, /Wedding/, 'the long ladder still says Wedding for weddings');
  assert.equal(checklistPhaseLabel(last, 'wedding').label, last.label);
  for (const t of ['debut', 'birthday', 'corporate', 'reunion', 'anniversary']) {
    assert.equal(
      checklistPhaseLabel(last, t).label,
      'The day & after',
      `${t} must not be told about a wedding day`,
    );
  }
});

test('groups are never silently dropped — the builder filters the ladder it bucketed with', () => {
  const rows = [row('a', 7), row('b', 3), row('c', 0)];
  const short = groupChecklistByPhase(rows, '2026-08-07', new Date('2026-07-31'), 'hangout');
  const seen = short.flatMap((g) => g.items).length;
  assert.equal(seen, 3, 'every item must appear somewhere');
  assert.ok(
    short.some((g) => g.phase !== null),
    'items must land in REAL phases, not all fall through to the undated bucket',
  );
  // the long ladder still works untouched
  const long = groupChecklistByPhase(rows, '2026-08-07', new Date('2026-07-31'), 'wedding');
  assert.equal(long.flatMap((g) => g.items).length, 3);
});

test('an unknown event type degrades to the long ladder rather than losing items', () => {
  const rows = [row('a', 30)];
  const g = groupChecklistByPhase(rows, '2026-08-30', new Date('2026-07-31'), 'some_future_type');
  assert.equal(g.flatMap((x) => x.items).length, 1);
});
