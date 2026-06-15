/**
 * Unit suite for the checklist urgency filter. Load-bearing invariants:
 * done items never resurface, the top-N are the soonest-due open items
 * (so the list tracks the countdown), and date math is timezone-stable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rankUrgentChecklistItems,
  daysUntilEvent,
  dueDateForItem,
  buildChecklistSeed,
  phaseForOffset,
  groupChecklistByPhase,
  isChurchCeremony,
  CHECKLIST_TEMPLATE,
  CHECKLIST_PHASES,
  type ChecklistItemRow,
} from './checklist';

function item(p: Partial<ChecklistItemRow>): ChecklistItemRow {
  return {
    item_id: p.item_id ?? 'i',
    public_id: 'S89J-x',
    event_id: 'e',
    template_key: p.template_key ?? null,
    title: p.title ?? 'Task',
    category: p.category ?? 'foundations',
    due_offset_days: p.due_offset_days ?? null,
    status: p.status ?? 'pending',
    sort_order: p.sort_order ?? 0,
    completed_at: null,
    created_at: '2026-01-01',
    ...p,
  };
}

const EVENT_DATE = '2026-08-12';
const NOW = new Date('2026-06-13T09:00:00'); // ~60 days out

test('daysUntilEvent: whole-day diff, null when no date', () => {
  assert.equal(daysUntilEvent('2026-06-20', new Date('2026-06-13T23:00:00')), 7);
  assert.equal(daysUntilEvent(null), null);
});

test('dueDateForItem: event_date minus offset', () => {
  // 30 days before 2026-08-12 → 2026-07-13
  assert.equal(dueDateForItem('2026-08-12', 30), '2026-07-13');
  assert.equal(dueDateForItem(null, 30), null);
  assert.equal(dueDateForItem('2026-08-12', null), null);
});

test('rankUrgentChecklistItems: soonest-due upcoming items first, ties by sort_order', () => {
  // All offsets < 60 (days-to-event) so every item is still upcoming. Smaller
  // offset = due closer to the event = LATER due date, so larger daysUntilDue.
  const rows = [
    item({ item_id: 'd14', title: 'Final headcount', due_offset_days: 14, sort_order: 90 }),
    item({ item_id: 'd30b', title: 'Seating', due_offset_days: 30, sort_order: 70 }),
    item({ item_id: 'd30a', title: 'RSVP follow-up', due_offset_days: 30, sort_order: 60 }),
  ];
  const top = rankUrgentChecklistItems(rows, EVENT_DATE, { now: NOW, limit: 3 });
  // offset-30 items are due in ~30d (soonest); offset-14 due in ~46d (last).
  // The two offset-30 ties break by sort_order (60 before 70).
  assert.deepEqual(top.map((t) => t.item_id), ['d30a', 'd30b', 'd14']);
});

test('rankUrgentChecklistItems: overdue items rank first (most urgent)', () => {
  const rows = [
    // offset 330 on a 60-days-out event is long overdue → maximally urgent.
    item({ item_id: 'overdue', title: 'Book venue', due_offset_days: 330, sort_order: 10 }),
    item({ item_id: 'upcoming', title: 'Seating', due_offset_days: 30, sort_order: 70 }),
  ];
  const top = rankUrgentChecklistItems(rows, EVENT_DATE, { now: NOW, limit: 2 });
  assert.equal(top[0]!.item_id, 'overdue');
  assert.ok((top[0]!.daysUntilDue ?? 0) < 0);
});

test('rankUrgentChecklistItems: done items never resurface', () => {
  const rows = [
    item({ item_id: 'done1', due_offset_days: 14, status: 'done' }),
    item({ item_id: 'open1', due_offset_days: 30, status: 'pending' }),
  ];
  const top = rankUrgentChecklistItems(rows, EVENT_DATE, { now: NOW });
  assert.deepEqual(top.map((t) => t.item_id), ['open1']);
});

test('rankUrgentChecklistItems: undated items sort after dated ones', () => {
  const rows = [
    item({ item_id: 'undated', due_offset_days: null, sort_order: 5 }),
    item({ item_id: 'dated', due_offset_days: 30, sort_order: 99 }),
  ];
  const top = rankUrgentChecklistItems(rows, EVENT_DATE, { now: NOW, limit: 5 });
  assert.deepEqual(top.map((t) => t.item_id), ['dated', 'undated']);
});

test('buildChecklistSeed: one row per template item, ascending sort_order', () => {
  const seed = buildChecklistSeed('event-123');
  assert.equal(seed.length, CHECKLIST_TEMPLATE.length);
  assert.equal(seed[0]!.event_id, 'event-123');
  assert.ok(seed.every((r) => r.status === 'pending'));
  for (let i = 1; i < seed.length; i++) {
    assert.ok(seed[i]!.sort_order > seed[i - 1]!.sort_order);
  }
});

test('isChurchCeremony: catholic / unset = church path, civil = not', () => {
  assert.equal(isChurchCeremony('catholic'), true);
  assert.equal(isChurchCeremony(null), true); // not chosen yet → keep guidance
  assert.equal(isChurchCeremony(undefined), true);
  assert.equal(isChurchCeremony('civil'), false);
});

test('buildChecklistSeed: ceremony tailoring drops church steps for a civil wedding', () => {
  const all = buildChecklistSeed('e'); // no ceremony → everything
  const catholic = buildChecklistSeed('e', 'catholic');
  const civil = buildChecklistSeed('e', 'civil');

  assert.equal(catholic.length, CHECKLIST_TEMPLATE.length);
  assert.equal(all.length, CHECKLIST_TEMPLATE.length);
  assert.ok(civil.length < catholic.length, 'civil drops church-only tasks');

  const civilKeys = new Set(civil.map((r) => r.template_key));
  assert.ok(!civilKeys.has('pre_cana'), 'no Pre-Cana for a civil wedding');
  assert.ok(!civilKeys.has('canonical_interview'), 'no canonical interview for civil');
  assert.ok(civilKeys.has('marriage_license'), 'universal license still included');
  assert.ok(civilKeys.has('guest_list'), 'universal tasks unaffected');

  // sort_order stays stable: a kept task has the same value with or without filtering.
  const licAll = all.find((r) => r.template_key === 'marriage_license')!;
  const licCivil = civil.find((r) => r.template_key === 'marriage_license')!;
  assert.equal(licAll.sort_order, licCivil.sort_order);
});

test('phaseForOffset: each offset lands in the right countdown phase', () => {
  assert.equal(phaseForOffset(540)?.id, 'p1'); // 18–12 mo
  assert.equal(phaseForOffset(365)?.id, 'p2'); // 12–9 mo
  assert.equal(phaseForOffset(270)?.id, 'p3'); // 9–6 mo
  assert.equal(phaseForOffset(180)?.id, 'p4'); // 6–4 mo
  assert.equal(phaseForOffset(120)?.id, 'p5'); // 4–2 mo
  assert.equal(phaseForOffset(60)?.id, 'p6'); //  2–1 mo
  assert.equal(phaseForOffset(30)?.id, 'p7'); //  1 mo–2 wk
  assert.equal(phaseForOffset(14)?.id, 'p8'); //  final 2 wk
  assert.equal(phaseForOffset(0)?.id, 'p9'); //   day of
  assert.equal(phaseForOffset(-30)?.id, 'p9'); // after
  assert.equal(phaseForOffset(null), null); //    undated
});

test('phaseForOffset: every template item maps to exactly one phase', () => {
  for (const t of CHECKLIST_TEMPLATE) {
    const phase = phaseForOffset(t.dueOffsetDays);
    assert.ok(phase, `no phase for ${t.key} (offset ${t.dueOffsetDays})`);
  }
});

test('groupChecklistByPhase: phase order kept, done items sink within a phase', () => {
  const rows = [
    item({ item_id: 'late', due_offset_days: 14, sort_order: 200 }), // p8
    item({ item_id: 'early', due_offset_days: 365, sort_order: 20 }), // p2
    item({ item_id: 'p2done', due_offset_days: 360, sort_order: 30, status: 'done' }), // p2, done
    item({ item_id: 'p2open', due_offset_days: 350, sort_order: 40 }), // p2, open
  ];
  const groups = groupChecklistByPhase(rows, EVENT_DATE, NOW);
  // p2 group comes before p8 group.
  assert.deepEqual(
    groups.map((g) => g.phase?.id),
    ['p2', 'p8'],
  );
  // Within p2: open items (earliest window first) then the done one sinks last.
  const p2 = groups.find((g) => g.phase?.id === 'p2')!;
  assert.deepEqual(p2.items.map((i) => i.item_id), ['early', 'p2open', 'p2done']);
});

test('CHECKLIST_PHASES: contiguous, non-overlapping coverage', () => {
  // Each phase's minDays should be exactly one below the next phase's maxDays.
  for (let i = 1; i < CHECKLIST_PHASES.length; i++) {
    assert.equal(CHECKLIST_PHASES[i]!.maxDays, CHECKLIST_PHASES[i - 1]!.minDays - 1);
  }
});
