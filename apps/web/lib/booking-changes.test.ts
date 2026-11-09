/**
 * booking-changes — the pure half of "every change keeps its history".
 * The field list must match the table's CHECK word for word, so it is read
 * from the migration rather than restated.
 *
 * Run (from apps/web): tsx --test lib/booking-changes.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOOKING_CHANGE_FIELDS, changesFor, toBookingChange, type BookingChange } from './booking-changes';

const MIGRATION = join(
  import.meta.dirname, '..', '..', '..', 'supabase', 'migrations',
  '20271329937802_every_change_keeps_its_history_and_the_chat_is_the_record.sql',
);

function row(over: Partial<BookingChange>): BookingChange {
  return {
    changeId: 1,
    eventId: 'e1',
    vendorProfileId: null,
    field: 'event_date',
    subjectId: null,
    fromValue: 'a',
    toValue: 'b',
    changedBy: null,
    changedAt: '2026-11-01T00:00:00Z',
    ...over,
  };
}

test('BOOKING_CHANGE_FIELDS is exactly the CHECK list in the migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const m = sql.match(/CONSTRAINT booking_changes_field_check\s+CHECK\s*\(\s*field\s+IN\s*\(([^)]*)\)/i);
  assert.ok(m, 'booking_changes_field_check not found in the migration');
  const inSql = [...m![1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(inSql, [...BOOKING_CHANGE_FIELDS].sort());
});

test('changesFor: one field, newest first, ties broken by the later id', () => {
  const rows = [
    row({ changeId: 1, changedAt: '2026-11-01T00:00:00Z' }),
    row({ changeId: 3, changedAt: '2026-11-03T00:00:00Z' }),
    row({ changeId: 2, changedAt: '2026-11-03T00:00:00Z' }),
    row({ changeId: 4, field: 'guest_estimate', changedAt: '2026-11-04T00:00:00Z' }),
  ];
  assert.deepEqual(changesFor(rows, 'event_date').map((r) => r.changeId), [3, 2, 1]);
  assert.deepEqual(changesFor(rows, 'guest_estimate').map((r) => r.changeId), [4]);
  assert.deepEqual(changesFor(rows, 'meeting_time'), []);
  assert.deepEqual(rows.map((r) => r.changeId), [1, 3, 2, 4], 'the input is not mutated');
});

test('changesFor: a subject narrows to one block / meeting; undefined means every subject', () => {
  const rows = [
    row({ changeId: 1, field: 'schedule_time', subjectId: 'b1' }),
    row({ changeId: 2, field: 'schedule_time', subjectId: 'b2' }),
  ];
  assert.deepEqual(changesFor(rows, 'schedule_time', 'b1').map((r) => r.changeId), [1]);
  assert.deepEqual(changesFor(rows, 'schedule_time').map((r) => r.changeId).sort(), [1, 2]);
  assert.deepEqual(changesFor(rows, 'schedule_time', null), []);
});

test('toBookingChange: maps a row, and refuses one it cannot trust', () => {
  const ok = toBookingChange({
    change_id: '7', event_id: 'e1', vendor_profile_id: null, field: 'schedule_time', subject_id: 'b1',
    from_value: null, to_value: '2026-12-12T06:00:00Z', changed_by: 'u1', changed_at: '2026-11-09T01:00:00Z',
  });
  assert.deepEqual(ok, {
    changeId: 7, eventId: 'e1', vendorProfileId: null, field: 'schedule_time', subjectId: 'b1',
    fromValue: null, toValue: '2026-12-12T06:00:00Z', changedBy: 'u1', changedAt: '2026-11-09T01:00:00Z',
  });
  assert.equal(toBookingChange({ change_id: 1, event_id: 'e1', field: 'price', changed_at: 'x' }), null);
  assert.equal(toBookingChange({ change_id: 'n/a', event_id: 'e1', field: 'event_date', changed_at: 'x' }), null);
  assert.equal(toBookingChange({ change_id: 1, field: 'event_date', changed_at: 'x' }), null);
});
