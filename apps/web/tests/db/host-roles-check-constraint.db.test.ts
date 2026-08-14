/**
 * tests/db/host-roles-check-constraint.db.test.ts — the dropdown and the
 * database cannot disagree about which host roles are legal.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `event_moderators.role_subtype` is plain `text` guarded by a CHECK
 * constraint. The role picker is driven by `lib/host-roles.ts`. Those are two
 * independent lists that must say the same thing, and NOTHING connected them
 * until this file: adding a role to the TypeScript vocabulary and forgetting
 * the constraint produces an invite the database REJECTS, which the host reads
 * as a generic "please try again" and an engineer reads as nothing at all,
 * because no exception is thrown anywhere in the app.
 *
 * That is the documented house failure — a phantom column, a phantom enum
 * value, a phantom RPC argument, an un-widened `location_city` CHECK: rejected,
 * not thrown, and the only symptom is an absence. This test is the connection.
 *
 * It fails in BOTH directions on purpose. A value legal in the database but
 * absent from TypeScript is just as wrong: it means rows can exist that the UI
 * cannot label, and `ROLE_SUBTYPE_LABEL[row.role_subtype]` renders `undefined`
 * on the hosts page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb } from './replay-migrations';
import { ROLE_SUBTYPES } from '../../lib/host-roles';

/** Pull the legal string literals out of the CHECK constraint's own definition. */
function literalsFrom(def: string): string[] {
  // The definition renders as: CHECK ((role_subtype = ANY (ARRAY['a'::text, …])))
  const out = new Set<string>();
  for (const m of def.matchAll(/'([a-z0-9_]+)'::text/g)) {
    const v = m[1];
    if (v) out.add(v);
  }
  return [...out].sort();
}

test('the role CHECK constraint and the TypeScript vocabulary agree exactly', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());

  // A broken replay introspects to nothing, and "no constraint found" would
  // otherwise read as a pass on an empty comparison.
  assert.ok(applied > 500, `expected a full replay, only ${applied} migrations applied`);

  const res = await db.query<{ def: string }>(`
    select pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'event_moderators'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role_subtype%'
  `);

  assert.equal(
    res.rows.length,
    1,
    `expected exactly one role_subtype CHECK, found ${res.rows.length}`,
  );

  const def = res.rows[0]?.def ?? '';
  const inDb = literalsFrom(def);
  const inCode = [...(ROLE_SUBTYPES as readonly string[])].sort();

  // Prove the extractor actually extracted something before comparing — an
  // empty list on both sides would compare equal and assert nothing.
  assert.ok(
    inDb.length >= 13,
    `parsed only ${inDb.length} literals out of the constraint; the regex has drifted from the rendered form:\n${def}`,
  );

  const missingInDb = inCode.filter((r) => !inDb.includes(r));
  const missingInCode = inDb.filter((r) => !inCode.includes(r));

  assert.deepEqual(
    missingInDb,
    [],
    `these roles are offered by lib/host-roles.ts but REJECTED by the database: ${missingInDb.join(', ')}`,
  );
  assert.deepEqual(
    missingInCode,
    [],
    `these roles are legal in the database but unknown to lib/host-roles.ts (rows would render an undefined label): ${missingInCode.join(', ')}`,
  );
});

test('every role an event type offers is a legal database value', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());
  assert.ok(applied > 500, `expected a full replay, only ${applied} migrations applied`);

  const { HOST_ROLES_BY_EVENT_TYPE } = await import('../../lib/host-roles');

  // The map is the thing a host actually chooses from, so it — not just the
  // flat vocabulary — is what has to be insertable.
  const offered = new Set<string>();
  for (const roles of Object.values(HOST_ROLES_BY_EVENT_TYPE)) {
    for (const r of roles) offered.add(r);
  }
  assert.ok(offered.size > 0, 'the per-event-type map offered nothing at all');

  const res = await db.query<{ def: string }>(`
    select pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'event_moderators'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role_subtype%'
  `);
  const legal = new Set(literalsFrom(res.rows[0]?.def ?? ''));

  const illegal = [...offered].filter((r) => !legal.has(r));
  assert.deepEqual(
    illegal,
    [],
    `the picker offers roles the database refuses: ${illegal.join(', ')}`,
  );
});

test('every active event type in the vocabulary has a role set', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());
  assert.ok(applied > 500, `expected a full replay, only ${applied} migrations applied`);

  const { HOST_ROLES_BY_EVENT_TYPE, hostRolesForEventType } = await import(
    '../../lib/host-roles'
  );

  const res = await db.query<{ event_type: string }>(
    `select event_type from event_type_vocab order by event_type`,
  );
  const types = res.rows.map((r) => r.event_type);

  // The seed is part of the migrations, so an empty result means the replay
  // did not reach the vocabulary and this test would otherwise pass vacuously.
  assert.ok(types.length >= 15, `expected the seeded vocabulary, got ${types.length} rows`);

  const unmapped = types.filter((t2) => !HOST_ROLES_BY_EVENT_TYPE[t2]);

  // This is a WARNING-shaped assertion, not a lock: `hostRolesForEventType`
  // fails open, so an unmapped type still works — it just offers the whole
  // list, including wedding words. Failing here is the nudge to write the set
  // while the new type is fresh, which is exactly what nobody remembered to do
  // for the 15 types that already existed.
  assert.deepEqual(
    unmapped,
    [],
    `these event types have no role set and will fall back to the full wedding-shaped list: ${unmapped.join(', ')}`,
  );

  // And the fail-open promise itself, so the nudge above can never become an outage.
  const unknown = hostRolesForEventType('a_type_that_does_not_exist');
  assert.ok(unknown.length > 0, 'an unknown event type must fail OPEN, not offer nothing');
});
