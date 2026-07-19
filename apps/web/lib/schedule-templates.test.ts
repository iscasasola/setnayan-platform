/**
 * Unit suite for the Coordinator P2 schedule templates — the wedding
 * run-of-show starter skeletons and their materialization into INSERT rows.
 * Pins: per-type offering, anchored times + preserved durations, gap-10
 * sort order, and a pre-migration-safe payload shape (no P2 columns).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEDULE_TEMPLATES,
  getScheduleTemplate,
  templatesForEventType,
  buildTemplateInsertRows,
} from './schedule-templates';
import { SCHEDULE_BLOCK_TYPES } from './schedule';

const EVENT_DATE = '2026-12-12';

test('starter set: three wedding templates with unique ids', () => {
  assert.equal(SCHEDULE_TEMPLATES.length, 3);
  const idSet = new Set(SCHEDULE_TEMPLATES.map((t) => t.id));
  assert.equal(idSet.size, SCHEDULE_TEMPLATES.length);
  for (const t of SCHEDULE_TEMPLATES) {
    assert.ok(t.rows.length >= 5, `${t.id} should be a real skeleton`);
    assert.deepEqual(t.eventTypes, ['wedding']);
  }
});

test('every template row uses a valid schedule_block_type enum value', () => {
  const valid = new Set<string>(SCHEDULE_BLOCK_TYPES);
  for (const t of SCHEDULE_TEMPLATES) {
    for (const row of t.rows) {
      assert.ok(valid.has(row.block_type), `${t.id}: ${row.block_type}`);
    }
  }
});

test('templatesForEventType: weddings get the set, others get none', () => {
  assert.equal(templatesForEventType('wedding').length, 3);
  assert.deepEqual(templatesForEventType('birthday'), []);
  assert.deepEqual(templatesForEventType(null), []);
});

test('getScheduleTemplate: hit and miss', () => {
  assert.equal(getScheduleTemplate('wedding_classic_full_day')?.label, 'Classic wedding day');
  assert.equal(getScheduleTemplate('nope'), null);
});

test('buildTemplateInsertRows: anchored to the event date, durations preserved', () => {
  const template = getScheduleTemplate('wedding_classic_full_day')!;
  const rows = buildTemplateInsertRows(template, EVENT_DATE);
  assert.equal(rows.length, template.rows.length);
  for (let i = 0; i < rows.length; i++) {
    const spec = template.rows[i]!;
    const row = rows[i]!;
    const start = new Date(row.start_at);
    assert.ok(!Number.isNaN(start.getTime()));
    if (spec.durationMinutes === null) {
      assert.equal(row.end_at, null);
    } else {
      const dur = (new Date(row.end_at!).getTime() - start.getTime()) / 60_000;
      assert.equal(dur, spec.durationMinutes);
    }
  }
  // Rows come out in template order with gap-10 sort_order, all top-level.
  assert.deepEqual(
    rows.map((r) => r.sort_order),
    template.rows.map((_, i) => (i + 1) * 10),
  );
  assert.ok(rows.every((r) => r.parent_block_id === null));
  // Chronologically non-decreasing — a skeleton must read top-to-bottom.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(
      new Date(rows[i]!.start_at).getTime() >= new Date(rows[i - 1]!.start_at).getTime(),
      `row ${i} starts before row ${i - 1}`,
    );
  }
});

test('buildTemplateInsertRows: null event date still yields valid future times', () => {
  const template = getScheduleTemplate('wedding_civil_intimate')!;
  const rows = buildTemplateInsertRows(template, null);
  for (const row of rows) {
    assert.ok(!Number.isNaN(new Date(row.start_at).getTime()));
  }
});

test('insert payload is pre-migration safe: no P2 columns in the shape', () => {
  const template = getScheduleTemplate('wedding_reception_only')!;
  const rows = buildTemplateInsertRows(template, EVENT_DATE);
  for (const row of rows) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ['block_type', 'end_at', 'is_public', 'label', 'parent_block_id', 'sort_order', 'start_at'],
    );
  }
});
