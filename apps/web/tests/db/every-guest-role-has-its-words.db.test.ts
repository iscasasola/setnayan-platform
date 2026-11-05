/**
 * tests/db/every-guest-role-has-its-words.db.test.ts — the `guest_role` enum the migrations BUILD and the roles the
 * app knows are one list.
 *
 * Owner 2026-10-19 (DECISION_LOG "A MAN OF HONOR"): "keep the mapping consistent and don't let me trace it". The unit
 * guard `lib/every-role-is-mapped-everywhere.test.ts` reads the enum from the migration files' text; this one asks the
 * replayed database itself (`enum_range`), so a migration that does not apply — or a value added without its words in
 * `ROLE_LABELS` (the one exhaustive `Record<GuestRole, …>`) — fails here, in either direction.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createReplayedDb } from './replay-migrations';
import { ROLE_LABELS } from '../../lib/guests';

test('public.guest_role and ROLE_LABELS hold exactly the same roles — man_of_honor included', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());
  assert.ok(applied > 500, `expected a full replay, only ${applied} migrations applied`);
  const res = await db.query<{ role: string }>(`SELECT unnest(enum_range(NULL::public.guest_role))::text AS role`);
  const inDb = res.rows.map((r) => r.role).sort();
  assert.ok(inDb.includes('man_of_honor'), 'the man_of_honor migration did not add the enum value');
  assert.deepEqual(inDb, Object.keys(ROLE_LABELS).sort(), 'the database enum and ROLE_LABELS disagree');
});
