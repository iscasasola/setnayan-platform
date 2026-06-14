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
  CHECKLIST_TEMPLATE,
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
