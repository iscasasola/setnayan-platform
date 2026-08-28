/**
 * Unit suite for the per-event-type checklist definitions. Invariants:
 * wedding/unset falls back (null), every non-wedding type resolves, task keys
 * are globally unique (they become `template_key`s), categories are valid, and
 * date-model metadata is coherent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_TYPE_CHECKLIST_DEFS,
  GENERIC_EVENT_CHECKLIST_DEF,
  checklistDefForEventType,
  type EventTypeChecklistDef,
} from './checklist-event-type-defs';
import { CHECKLIST_CATEGORY_LABELS, type ChecklistCategory } from './checklist';

const VALID_CATEGORIES = new Set(Object.keys(CHECKLIST_CATEGORY_LABELS) as ChecklistCategory[]);
// Every type that has a def of its OWN. date + hangout joined 2026-07-31 —
// before that they inherited CELEBRATION's 90-day runway, which put every task
// in the past on day one for an event planned in days.
// Types NOT here (anniversary · graduation · reunion · gala_night ·
// simple_event) still ride GENERIC_EVENT_CHECKLIST_DEF by design.
const ENABLED_TYPES = [
  'debut', 'birthday', 'christening', 'corporate',
  'tournament', 'gender_reveal', 'travel', 'celebration',
  'date', 'hangout',
  // funeral joined 2026-08-24 (W4-WORDS): without its own short-runway def it
  // would seed the CELEBRATION template — "Set the purpose & theme", "Book a
  // host" — at a wake, in the week a family least needs a celebration list.
  'wake',
];

test('checklistDefForEventType: wedding / null / unset fall back to the wedding template (null)', () => {
  assert.equal(checklistDefForEventType('wedding'), null);
  assert.equal(checklistDefForEventType(null), null);
  assert.equal(checklistDefForEventType(undefined), null);
  // An unknown type also falls back rather than crashing. ('funeral' was this
  // test's example of an unknown type until it became a real one — and is now
  // not a type at all: the type is 'wake', and a funeral is the ceremony inside
  // it. Owner 2026-08-27.)
  assert.equal(checklistDefForEventType('pet_adoption'), null);
});

test('checklistDefForEventType: every enabled non-wedding type resolves to its def', () => {
  for (const t of ENABLED_TYPES) {
    const def = checklistDefForEventType(t);
    assert.ok(def, `${t} should resolve`);
    assert.equal(def!.eventType, t);
  }
  assert.equal(Object.keys(EVENT_TYPE_CHECKLIST_DEFS).length, ENABLED_TYPES.length);
});

test('every template: non-empty, valid categories, coherent metadata', () => {
  for (const def of Object.values(EVENT_TYPE_CHECKLIST_DEFS) as EventTypeChecklistDef[]) {
    assert.ok(def.template.length > 0, `${def.eventType} has tasks`);
    assert.ok(['input', 'output'].includes(def.dateModel), `${def.eventType} dateModel valid`);
    assert.ok(def.tier2Core.length > 0, `${def.eventType} has a tier-2 core`);
    for (const item of def.template) {
      assert.ok(item.key.length > 0, `${def.eventType} task has a key`);
      assert.ok(item.title.length > 0, `${def.eventType} task has a title`);
      assert.ok(VALID_CATEGORIES.has(item.category), `${def.eventType}/${item.key} category valid`);
      assert.equal(typeof item.dueOffsetDays, 'number');
    }
  }
});

test('task keys are globally unique across ALL types (they become template_keys)', () => {
  const seen = new Map<string, string>();
  for (const def of Object.values(EVENT_TYPE_CHECKLIST_DEFS) as EventTypeChecklistDef[]) {
    for (const item of def.template) {
      assert.ok(!seen.has(item.key), `duplicate key ${item.key} (${def.eventType} vs ${seen.get(item.key)})`);
      seen.set(item.key, def.eventType);
    }
  }
});

test('christening is date_model=output (parish-scheduled); most types are input', () => {
  assert.equal(EVENT_TYPE_CHECKLIST_DEFS.christening!.dateModel, 'output');
  assert.equal(EVENT_TYPE_CHECKLIST_DEFS.birthday!.dateModel, 'input');
  assert.equal(EVENT_TYPE_CHECKLIST_DEFS.debut!.dateModel, 'input');
});

test('GENERIC_EVENT_CHECKLIST_DEF: a valid generic fallback for typeless non-wedding types', () => {
  // The fallback the seeder uses instead of a blank checklist. Reuses celebration.
  assert.ok(GENERIC_EVENT_CHECKLIST_DEF.template.length > 0);
  assert.equal(GENERIC_EVENT_CHECKLIST_DEF, EVENT_TYPE_CHECKLIST_DEFS.celebration);
  for (const item of GENERIC_EVENT_CHECKLIST_DEF.template) {
    assert.ok(VALID_CATEGORIES.has(item.category), `generic/${item.key} category valid`);
  }
  // These enabled types have NO dedicated def → the caller falls back to the
  // generic def rather than seeding a blank checklist. (checklistDefForEventType
  // itself still returns null here; the fallback lives at the call site.)
  for (const t of ['anniversary', 'graduation', 'reunion', 'gala_night', 'simple_event']) {
    assert.equal(checklistDefForEventType(t), null, `${t} has no dedicated def`);
  }
});
