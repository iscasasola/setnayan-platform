/**
 * ⭐ SQL ↔ TS PARITY — `CeremonyType` / `CEREMONY_TYPES` must equal the
 * `events_ceremony_type_check` DB CHECK, exactly.
 *
 * WHY this test exists (2026-07-27). `events.ceremony_type` is the same rule
 * written down in six places, and it had drifted in two of them at once:
 *
 *   - the DB CHECK (`events_ceremony_type_check`)            → 18
 *   - the picker (`app/_components/ceremony-type-radio-group.tsx`) → 18
 *   - `lib/faith-registry.ts` `ALLOWED_CEREMONY_VALUES`      → 18
 *   - `wedding_type_launch_status` (born_again = active)     → live
 *   - `lib/auspicious-date.ts` `CeremonyType`                → 16  ← drifted
 *   - four hand-rolled runtime guards                        → 16 / 8 / 8 / 8
 *
 * `lib/ceremony-validation.test.ts` already pins `faith-registry` to the CHECK.
 * This pins the OTHER TS keyspace — the auspicious-date union that every
 * date-selection read and write now shares — to the same CHECK, so the two
 * together leave no gap between them.
 *
 * It reads the constraint from a FULL replay of every migration in order
 * (PGlite), not from one migration file: five separate migrations have widened
 * this CHECK (20260521000000, 20260521080000, 20260804000000, 20260808000000,
 * 20261120000000), so only the replayed end-state is the real answer. A
 * migration that widens the CHECK without widening the TS union — or a TS
 * union widened past what the column will actually store — fails here.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { CEREMONY_TYPES, isCeremonyType } from '../../lib/auspicious-date';

let replay: ReplayResult;

/** The literals inside a `= ANY (ARRAY[...])` CHECK definition. */
function literalsOf(constraintDef: string): string[] {
  return [...constraintDef.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!);
}

async function constraintDef(name: string): Promise<string> {
  const res = await replay.db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND c.conname = $1`,
    [name],
  );
  assert.equal(res.rows.length, 1, `expected exactly one ${name} constraint`);
  return res.rows[0]!.def;
}

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay.db.close();
});

test('⭐ CEREMONY_TYPES equals the events_ceremony_type_check allowed set, exactly', async () => {
  const allowed = literalsOf(await constraintDef('events_ceremony_type_check'));

  assert.ok(allowed.length > 0, 'parsed no literals out of the CHECK definition');
  assert.deepEqual(
    [...allowed].sort(),
    [...CEREMONY_TYPES].sort(),
    'lib/auspicious-date.ts CeremonyType has drifted from the events_ceremony_type_check DB CHECK',
  );
});

test('the guard accepts every value the column will actually store', async () => {
  const allowed = literalsOf(await constraintDef('events_ceremony_type_check'));
  for (const key of allowed) {
    assert.ok(
      isCeremonyType(key),
      `the DB will store "${key}" but isCeremonyType rejects it — it would read back as null`,
    );
  }
});

test('the guard accepts nothing the column would REFUSE to store', async () => {
  const allowed = new Set(literalsOf(await constraintDef('events_ceremony_type_check')));
  for (const key of CEREMONY_TYPES) {
    assert.ok(
      allowed.has(key),
      `isCeremonyType accepts "${key}" but the DB CHECK would reject the write`,
    );
  }
});

test('a real write proves the parity — every CEREMONY_TYPES value survives the CHECK', async () => {
  // The end-to-end version of the two set assertions above: actually push each
  // value through the column. A CHECK the TS list disagrees with fails here as
  // a constraint violation, not as a set mismatch.
  for (const key of CEREMONY_TYPES) {
    // Two adjacent CHECKs shape a legal wedding row:
    //   events_wedding_fields_consistency        → ceremony_type AND venue_setting
    //   events_sub_type_required_when_muslim_or_cultural → sub-type for those two
    await replay.db.query(
      `INSERT INTO public.events
         (event_type, display_name, ceremony_type, venue_setting, ceremony_sub_type)
       VALUES ('wedding', $1, $2, 'garden', $3)`,
      [`parity::${key}`, key, key === 'muslim' || key === 'cultural' ? 'other' : null],
    );
  }

  // Scoped to the rows this test inserted — the replay seeds other events.
  const { rows } = await replay.db.query<{ v: string }>(
    `SELECT ceremony_type AS v FROM public.events
      WHERE display_name LIKE 'parity::%' ORDER BY ceremony_type`,
  );
  assert.deepEqual(
    rows.map((r) => r.v),
    [...CEREMONY_TYPES].sort(),
    'not every CEREMONY_TYPES value round-tripped through events.ceremony_type',
  );
});

test('the secondary-ceremony CHECK is the primary set minus mixed — unchanged shape', async () => {
  // Guards the adjacent constraint so a future widening cannot land on one and
  // not the other (they have always moved together, across all 5 migrations).
  const primary = new Set(literalsOf(await constraintDef('events_ceremony_type_check')));
  const secondary = literalsOf(await constraintDef('events_secondary_ceremony_check'));

  assert.deepEqual(
    [...secondary].sort(),
    [...primary].filter((v) => v !== 'mixed').sort(),
    'events_secondary_ceremony_check is no longer the primary set minus mixed',
  );
});
