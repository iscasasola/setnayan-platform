/**
 * Papic photo quality — a NEW event starts on Optimal (executed, not asserted).
 *
 * Owner ruling 2026-08-10, verbatim: "photo quality starts at optimal and not
 * full resolution." All three tiers stay selectable; only the starting point
 * moves. Migration 20271127772092 does that with
 * `ALTER TABLE public.events ALTER COLUMN papic_quality_tier SET DEFAULT
 * 'optimal'`.
 *
 * ── WHY THIS TEST EXISTS AND NOT JUST A TEXT MATCH ─────────────────────────
 * A unit test can only prove the SQL file contains the right characters
 * (papic-fidelity.test.ts does exactly that, deriving the value from the
 * constant). It cannot prove Postgres agrees. This one replays the whole
 * migration corpus into an in-process PGlite and then INSERTS — so the thing
 * asserted is the value a real row actually receives.
 *
 * Three promises are on the line, and each is checked by doing it:
 *
 *   1. A new event gets 'optimal' — the ruling.
 *   2. ALL THREE tiers are still storable and the CHECK still refuses anything
 *      else — "all three choices stay". Deleting a tier while selling paid
 *      preservation (which talks about "original quality") was the
 *      contradiction the owner rejected in the returned design.
 *   3. Changing a column DEFAULT cannot touch a row that already exists — the
 *      mechanical reason the five production events stay on Full resolution.
 *      Proven by re-pointing the default a third time and watching the stored
 *      rows not move.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  NEW_EVENT_PAPIC_FIDELITY,
  FIDELITY_READ_FAILSAFE,
  PAPIC_FIDELITY_VALUES,
} from '../../lib/papic-fidelity';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user
});

after(async () => {
  await db?.close();
});

test('a new event, created without naming a tier, starts on the new-event default', async () => {
  const row = await db.query<{ papic_quality_tier: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Fresh Event', 'birthday')
     RETURNING papic_quality_tier`,
  );
  assert.equal(
    row.rows[0]!.papic_quality_tier,
    NEW_EVENT_PAPIC_FIDELITY,
    'a brand-new event must materialize the new-event default from the column DEFAULT',
  );
  // And it must NOT be the read fail-safe: if these two ever coincide again the
  // split has been undone somewhere.
  assert.notEqual(row.rows[0]!.papic_quality_tier, FIDELITY_READ_FAILSAFE);
});

test('the declared DEFAULT on the column is the new-event default', async () => {
  const res = await db.query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'papic_quality_tier'`,
  );
  assert.equal(res.rows.length, 1, 'events.papic_quality_tier must still exist');
  const declared = res.rows[0]!.column_default ?? '';
  // Postgres renders it as `'optimal'::text`.
  assert.ok(
    new RegExp(`^'${NEW_EVENT_PAPIC_FIDELITY}'(::\\w+)?$`).test(declared),
    `expected the column DEFAULT to be '${NEW_EVENT_PAPIC_FIDELITY}', got ${declared || '(none)'}`,
  );
});

test('ALL THREE tiers are still storable — nothing was removed', async () => {
  assert.equal(PAPIC_FIDELITY_VALUES.length, 3);
  for (const tier of PAPIC_FIDELITY_VALUES) {
    const row = await db.query<{ papic_quality_tier: string }>(
      `INSERT INTO public.events (display_name, event_type, papic_quality_tier)
       VALUES ($1, 'birthday', $2)
       RETURNING papic_quality_tier`,
      [`Tier ${tier}`, tier],
    );
    assert.equal(row.rows[0]!.papic_quality_tier, tier, `${tier} must remain selectable`);
  }
});

test('the CHECK still refuses a tier that is not in the vocabulary', async () => {
  // ⚠ THE MATCHER IS NAMED, DELIBERATELY. A first cut accepted any
  // /violates check constraint/ and went GREEN off an unrelated constraint on
  // the same INSERT (events_wedding_fields_consistency) — the tier CHECK was
  // never exercised at all. A rejection test that does not name the constraint
  // it expects is not a test, it is a coin flip that lands on green.
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.events (display_name, event_type, papic_quality_tier)
         VALUES ('Bogus Tier', 'birthday', 'ultra_max')`,
      ),
    /papic_quality_tier/i,
    'an unknown tier must be rejected by the papic_quality_tier CHECK specifically',
  );
});

test('🔒 changing the DEFAULT cannot move a row that already exists', async () => {
  // This is the whole reason "do not migrate the five production events" needs
  // no migration step: the column is NOT NULL, so every stored row carries its
  // own materialized value, and a DEFAULT is only consulted for an INSERT that
  // omits the column. Demonstrated rather than asserted from memory.
  const seeded = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, papic_quality_tier)
     VALUES ('Legacy Full Res Event', 'birthday', $1)
     RETURNING event_id`,
    [FIDELITY_READ_FAILSAFE],
  );
  const eventId = seeded.rows[0]!.event_id;

  await db.query(
    `ALTER TABLE public.events ALTER COLUMN papic_quality_tier SET DEFAULT 'high_efficiency'`,
  );
  try {
    const after = await db.query<{ papic_quality_tier: string }>(
      `SELECT papic_quality_tier FROM public.events WHERE event_id = $1`,
      [eventId],
    );
    assert.equal(
      after.rows[0]!.papic_quality_tier,
      FIDELITY_READ_FAILSAFE,
      'an existing row must keep its own tier when the column DEFAULT changes',
    );
  } finally {
    // Put the schema back so nothing after this sees a doctored default.
    await db.query(
      `ALTER TABLE public.events ALTER COLUMN papic_quality_tier SET DEFAULT '${NEW_EVENT_PAPIC_FIDELITY}'`,
    );
  }
});
