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
  checklistDefForEventType,
  type EventTypeChecklistDef,
} from './checklist-event-type-defs';
import { CHECKLIST_CATEGORY_LABELS, type ChecklistCategory } from './checklist';

const VALID_CATEGORIES = new Set(Object.keys(CHECKLIST_CATEGORY_LABELS) as ChecklistCategory[]);
const ENABLED_TYPES = [
  'debut', 'birthday', 'christening', 'corporate',
  'tournament', 'gender_reveal', 'travel', 'celebration',
];

test('checklistDefForEventType: wedding / null / unset fall back to the wedding template (null)', () => {
  assert.equal(checklistDefForEventType('wedding'), null);
  assert.equal(checklistDefForEventType(null), null);
  assert.equal(checklistDefForEventType(undefined), null);
  // An unknown type also falls back rather than crashing.
  assert.equal(checklistDefForEventType('funeral'), null);
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
