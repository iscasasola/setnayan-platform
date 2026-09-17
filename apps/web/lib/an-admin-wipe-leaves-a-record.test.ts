/**
 * An admin hard-delete of a celebration must leave a permanent record.
 *
 * Measured 2026-09-17, which is why this exists: `admin_audit_log` carried 23
 * distinct action values in production and NONE of them was an event deletion,
 * while `events` carried nine BEFORE DELETE triggers all busy preserving other
 * people's rows. The console could erase a wedding — guests, seating, budget,
 * schedule, and the photographs in R2 — and leave nothing behind saying so.
 *
 * Two halves, and they fail for different reasons:
 *   1. the SHAPE of the record, executed against the pure builder;
 *   2. that `deleteEvent` actually WRITES one — a source check, because the
 *      action imports 'server-only' transitively through the Supabase admin
 *      client and cannot be imported here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildEventDeleteAuditRow,
  EVENT_HARD_DELETE_ACTION,
  type EventDeleteSnapshot,
} from './admin-event-delete-audit';

const FULL_SNAPSHOT: EventDeleteSnapshot = {
  public_id: 'S89E-HQRC8PMDNY',
  display_name: 'Cale & Ice',
  event_date: '2026-12-12',
  event_type: 'wedding',
  slug: 'cale-and-ice',
  archived: false,
  created_at: '2026-06-20T00:00:00Z',
  guest_count: 32,
  vendor_count: 42,
};

test('the record names the celebration, the actor, and what was in it', () => {
  const row = buildEventDeleteAuditRow({
    eventId: 'evt-uuid-1',
    adminUserId: 'admin-uuid-1',
    snapshot: FULL_SNAPSHOT,
    media: { collected: 25, swept: 25, failed: 0 },
  });

  assert.equal(row.action, EVENT_HARD_DELETE_ACTION);
  assert.equal(row.target_table, 'events');
  assert.equal(row.target_id, 'evt-uuid-1');
  assert.equal(row.actor_user_id, 'admin-uuid-1');

  // The whole point: afterwards nothing else can name what was destroyed.
  assert.equal(row.before_json?.public_id, 'S89E-HQRC8PMDNY');
  assert.equal(row.before_json?.display_name, 'Cale & Ice');
  assert.equal(row.before_json?.guest_count, 32);
  assert.equal(row.before_json?.vendor_count, 42);
  assert.equal(row.metadata.media_fully_swept, true);
});

test('🔴 a missing actor or unreadable snapshot still produces a record', () => {
  // A deletion that happened and was not written down is the defect this file
  // exists to close. There is no input that may suppress the row.
  const row = buildEventDeleteAuditRow({
    eventId: 'evt-uuid-2',
    adminUserId: null,
    snapshot: null,
    media: null,
  });

  assert.equal(row.action, EVENT_HARD_DELETE_ACTION);
  assert.equal(row.target_id, 'evt-uuid-2');
  assert.equal(row.actor_user_id, null);
  assert.equal(row.metadata.snapshot_read, false);
  assert.equal(row.metadata.actor_resolved, false);
});

test('🔴 "could not read" is never recorded as zero', () => {
  // absence is not emptiness — the trap this codebase has paid for repeatedly.
  const unreadable = buildEventDeleteAuditRow({
    eventId: 'evt-uuid-3',
    adminUserId: 'admin-uuid-1',
    snapshot: { ...FULL_SNAPSHOT, guest_count: null, vendor_count: null },
    media: null,
  });
  assert.equal(unreadable.before_json?.guest_count, null);
  assert.notEqual(unreadable.before_json?.guest_count, 0);
  assert.equal(unreadable.metadata.media_collected, null);
  assert.equal(unreadable.metadata.media_fully_swept, null);

  // ...and a genuine zero still reads as a zero, not as a null.
  const empty = buildEventDeleteAuditRow({
    eventId: 'evt-uuid-4',
    adminUserId: 'admin-uuid-1',
    snapshot: { ...FULL_SNAPSHOT, guest_count: 0, vendor_count: 0 },
    media: { collected: 0, swept: 0, failed: 0 },
  });
  assert.equal(empty.before_json?.guest_count, 0);
  assert.equal(empty.metadata.media_collected, 0);
  assert.equal(empty.metadata.media_fully_swept, true);
});

test('a partial media sweep is recorded as partial, not as success', () => {
  const row = buildEventDeleteAuditRow({
    eventId: 'evt-uuid-5',
    adminUserId: 'admin-uuid-1',
    snapshot: FULL_SNAPSHOT,
    media: { collected: 25, swept: 20, failed: 5 },
  });
  assert.equal(row.metadata.media_failed, 5);
  assert.equal(row.metadata.media_fully_swept, false);
});

test('🔴 deleteEvent writes the record, and takes the snapshot BEFORE the delete', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/admin/events/actions.ts'),
    'utf8',
  );

  // Anchor on the function body, not the file: a sibling action mentioning any
  // of these would otherwise pass this check for the wrong reason.
  const start = src.indexOf('export async function deleteEvent');
  assert.ok(start >= 0, 'deleteEvent not found in app/admin/events/actions.ts');
  const next = src.indexOf('\nexport ', start + 1);
  const body = src.slice(start, next === -1 ? src.length : next);

  assert.ok(
    body.includes('buildEventDeleteAuditRow'),
    'deleteEvent must build an audit row — an admin wipe may not go unrecorded',
  );
  assert.ok(
    body.includes("from('admin_audit_log')"),
    'deleteEvent must insert into admin_audit_log',
  );
  assert.ok(
    body.includes('adminUserId'),
    'deleteEvent must carry the acting admin into the record; requireAdmin() already returns it',
  );

  // Order is the property, not the presence: a snapshot taken after the row is
  // gone reads back nothing, and would log an empty record that looks fine.
  const snapshotAt = body.indexOf('snapshotEventForAudit(');
  const deleteAt = body.indexOf(".from('events').delete()");
  assert.ok(snapshotAt >= 0, 'deleteEvent must snapshot the event');
  assert.ok(deleteAt >= 0, 'deleteEvent must still delete the event');
  assert.ok(
    snapshotAt < deleteAt,
    'the snapshot must be taken BEFORE the delete — afterwards there is nothing left to name',
  );

  // And the audit write must come after, so a refused delete cannot record a
  // wipe that never happened.
  const auditAt = body.indexOf("from('admin_audit_log')");
  assert.ok(
    auditAt > deleteAt,
    'the audit row must be written AFTER the delete succeeds',
  );
});
