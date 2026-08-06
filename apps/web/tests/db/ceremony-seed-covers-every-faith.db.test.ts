/**
 * No couple is handed another faith's liturgy.
 *
 * ── WHAT WENT WRONG ────────────────────────────────────────────────────────
 * `events.ceremony_type` allows 18 values. `SeedCeremonyType` in lib/schedule.ts
 * listed 16 — its own comment claimed to "mirror the events.ceremony_type CHECK
 * constraint", and it did not. `jewish` and `born_again` were added to the
 * database by migration 20260808000000 and never reached the seed.
 *
 * The dispatcher then fell through TWICE to Catholic:
 *
 *     CEREMONY_PARTS[ceremonyType ?? 'catholic'] ?? CEREMONY_PARTS.catholic
 *
 * So a Born Again or Jewish couple pressed "set up my schedule" and their
 * ceremony filled with a Catholic Mass — Communion, the veil, the cord, the
 * coins — which they then deleted by hand, from their own wedding.
 *
 * Nothing errored. Every test passed. The seed did exactly what it was told.
 *
 * ── WHY THIS TEST IS DERIVED FROM THE SCHEMA ───────────────────────────────
 * The vocabulary is read from the replayed CHECK constraint, never re-typed
 * here. A hand-written list would be a third copy of the same 18 values and
 * would drift the same way the second one did — this repo has already paid for
 * that with a status vocabulary spelled 15 times under 6 names.
 *
 * Add a ceremony type to the constraint and this test fails until the seed
 * knows it. That is the whole point.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { buildScheduleSeed, type SeedCeremonyType } from '../../lib/schedule';

let replay: ReplayResult;
let allowed: string[] = [];

/** Beats that belong to a specific rite and must never appear in another's. */
const CATHOLIC_ONLY = [
  'Communion',
  'Veil ceremony',
  'Cord ceremony',
  'Arrhae (coin ceremony)',
  'Liturgy of the Word',
];

before(async () => {
  replay = await createReplayedDb();
  // The vocabulary, straight from the constraint the database enforces.
  const res = await replay.db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'events'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%ceremony_type%'
        AND pg_get_constraintdef(c.oid) LIKE '%catholic%'`,
  );
  const def = res.rows.map((r) => r.def).join(' ');
  allowed = [...def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!);
  allowed = [...new Set(allowed)];
});

after(async () => {
  await replay?.db?.close?.();
});

function ceremonyLabels(t: SeedCeremonyType | null): string[] {
  return buildScheduleSeed(t, '2026-12-12', null)
    .buildChildren({ ceremony: 'c', reception: 'r' })
    .filter((c) => c.parent_key === 'ceremony')
    .map((c) => c.label);
}

test('the vocabulary was actually read from the schema', () => {
  assert.ok(
    allowed.length >= 15,
    `only ${allowed.length} ceremony types parsed from the CHECK constraint — the ` +
      'parse is wrong, and a test that inspects nothing passes for the wrong reason.',
  );
  // The two that started this. If either ever leaves the constraint, say so loudly.
  assert.ok(allowed.includes('jewish'), 'jewish must be in the constraint');
  assert.ok(allowed.includes('born_again'), 'born_again must be in the constraint');
});

test('every ceremony type the database allows has its own seed', () => {
  const missing: string[] = [];
  for (const t of allowed) {
    const labels = ceremonyLabels(t as SeedCeremonyType);
    assert.ok(labels.length > 0, `${t} produced no ceremony beats at all`);
    // A type with no entry falls back to the neutral spine. Detect that by
    // comparing against the spine a deliberately-unknown type produces.
    const neutral = ceremonyLabels('__not_a_real_type__' as SeedCeremonyType);
    if (JSON.stringify(labels) === JSON.stringify(neutral)) missing.push(t);
  }
  assert.deepEqual(
    missing,
    [],
    'These ceremony types are allowed by the database but have no seed of their ' +
      'own, so they silently receive the neutral spine:\n  ' +
      missing.join('\n  ') +
      '\n\nAdd them to CEREMONY_PARTS in lib/schedule.ts.',
  );
});

test('no non-Catholic rite contains Catholic-only beats', () => {
  // The actual harm, asserted directly. `aglipayan` shares the Filipino
  // veil/cord/arrhae tradition by design and is excluded deliberately.
  const CATHOLIC_FAMILY = new Set(['catholic', 'aglipayan']);
  const offenders: string[] = [];
  for (const t of allowed) {
    if (CATHOLIC_FAMILY.has(t)) continue;
    const labels = ceremonyLabels(t as SeedCeremonyType);
    for (const beat of CATHOLIC_ONLY) {
      if (labels.includes(beat)) offenders.push(`${t} → "${beat}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "A couple is being handed another faith's rite:\n  " + offenders.join('\n  '),
  );
});

test('an unrecognised rite gets a neutral spine, never a Catholic Mass', () => {
  // The next type added to the constraint before this file catches up — which is
  // exactly how jewish and born_again became Catholic.
  const labels = ceremonyLabels('__not_a_real_type__' as SeedCeremonyType);
  for (const beat of CATHOLIC_ONLY) {
    assert.ok(
      !labels.includes(beat),
      `an unknown ceremony type must not receive "${beat}"`,
    );
  }
  assert.ok(labels.includes('Vows + ring exchange'), 'but it still gets a usable spine');
});

test('a non-wedding event is not given a wedding Mass either', () => {
  // ceremony_type is NULL for every non-wedding (the CHECK enforces it). That
  // null used to resolve to 'catholic' by default.
  const labels = ceremonyLabels(null);
  for (const beat of CATHOLIC_ONLY) {
    assert.ok(!labels.includes(beat), `a null ceremony must not receive "${beat}"`);
  }
});
