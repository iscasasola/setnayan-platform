/**
 * THE HOMEPAGE DOCK NEVER GOES BACK TO THE PILLAR NAMES (test:db — every
 * migration replayed into PGlite, so this asserts the SHIPPED end state, not a
 * fixture somebody typed).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The Suri→Sai rename (PR #5035) changed the code and left the DATA. Slot 4 sat
 * live and published as `Suri · Setnayan AI` for a full day afterwards, so the
 * one place customers actually look kept showing the old name while every grep
 * of the codebase came back clean. A rename that only touches code is not a
 * rename, and nothing in the suite could tell.
 *
 * Migration `20271186793328` carries out the owner's 2026-08-31/09-01 decision
 * to retire the five Filipino pillar names for plain functional ones. This test
 * is what stops a future seed, backfill or hand-edit quietly reintroducing one.
 *
 * ⚠ IT ASSERTS THE LABEL, NOT THE KEY. `pillar_key` deliberately still reads
 * 'ala-ala' / 'suri' / 'tiangge': nothing anywhere branches on its value (it is
 * SELECTed in lib/background-videos.ts and carried into the admin manager, and
 * that is all), so renaming identifiers would risk a stale reference for a
 * change no customer can see. The third test pins that on purpose, so a later
 * "tidy-up" that renames the keys has to argue with a test rather than slip
 * through.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Every retired name, including the pre-2027 long forms the dock once used. */
const RETIRED = /Ala ?Ala|Likhaan|Likha|Planuhan|\bPlano\b|Surian|Suri|Tiangge/i;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close?.();
});

test('no dock label carries a retired pillar name', async () => {
  const r = await db.query<{ slot: number; label: string }>(
    `SELECT slot, label FROM public.homepage_background_videos ORDER BY slot`,
  );
  assert.ok(r.rows.length > 0, 'the dock rows are missing entirely — the seed did not run');

  const stale = r.rows.filter((row) => RETIRED.test(row.label));
  assert.deepEqual(
    stale,
    [],
    `a retired pillar name is live on the homepage dock: ${stale
      .map((s) => `slot ${s.slot} = "${s.label}"`)
      .join(', ')}`,
  );
});

test('each slot carries its agreed plain name', async () => {
  const r = await db.query<{ slot: number; label: string }>(
    `SELECT slot, label FROM public.homepage_background_videos ORDER BY slot`,
  );
  const bySlot = new Map(r.rows.map((row) => [row.slot, row.label]));

  // Owner-picked 2026-09-01: the plain form, not "Name · Descriptor" — and
  // "Planner" for slot 3, the planning surface, NOT the 3D venue walk.
  assert.equal(bySlot.get(1), 'Memories');
  assert.equal(bySlot.get(2), 'Studio');
  assert.equal(bySlot.get(3), 'Planner');
  assert.equal(bySlot.get(4), 'Sai');
  assert.equal(bySlot.get(5), 'Marketplace');
});

test('pillar_key is left alone — identifiers may keep their history', async () => {
  // Not an oversight. See the header: no code branches on this value, so
  // renaming it buys nothing a customer sees and risks a stale reference.
  const r = await db.query<{ pillar_key: string | null }>(
    `SELECT pillar_key FROM public.homepage_background_videos WHERE slot = 4`,
  );
  assert.equal(
    r.rows[0]?.pillar_key,
    'suri',
    'the KEY should still be suri — only the label is customer-facing',
  );
});
