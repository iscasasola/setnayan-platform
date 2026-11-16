/**
 * GUARD — "Chairs & tents" (P3, 2026-10-01; migration
 * 20271257951866_find_a_supplier_reads_the_event_type.sql) is a real, findable
 * leaf: an active tier-2 row under an active tier-1 parent, scoped to the wake,
 * the birthday and the simple get-together, with services under it that INHERIT
 * that scope (NULL) so the owner's later edits in Admin › Event type › Scope
 * categories reach suppliers. Also pins the birthday starter list.
 *
 * Sabotaged once when written (the three services given their own list in the
 * migration) — rule 3 went red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the new leaf resolves to an ACTIVE tier-1 parent', async () => {
  const r = await db.query<{ tier: number; status: string; hidden: boolean; p_tier: number; p_status: string }>(
    `SELECT c.tier, c.status, c.marketplace_hidden AS hidden, p.tier AS p_tier, p.status AS p_status
       FROM public.service_categories c
       JOIN public.service_categories p ON p.id = c.parent_id
      WHERE c.id = 'chairs_tents'`,
  );
  assert.equal(r.rows.length, 1, 'chairs_tents has no parent row — an orphan never renders');
  const row = r.rows[0]!;
  assert.equal(row.tier, 2);
  assert.equal(row.status, 'active');
  assert.equal(row.hidden, false, 'a hidden leaf is unfindable');
  assert.equal(row.p_tier, 1, 'the parent is not a tier-1 folder');
  assert.equal(row.p_status, 'active');
});

test('scoped to wake · birthday · simple_event — and, since T1 part 2, every event its merged categories served', async () => {
  // T1 part 2 (20271350082350) folds Outdoor, Fireworks and Dance Floor into this category ("Rentals & Special
  // Effects"); the merge keeps each one's event reach, so the wedding's generator, fireworks and LED floor are still
  // there for a wedding. The original three stay; the rest is exactly the union of the three merged categories.
  const r = await db.query<{ t: string[] | null }>(
    `SELECT applicable_event_types AS t FROM public.service_categories WHERE id = 'chairs_tents'`,
  );
  const merged = await db.query<{ t: string }>(
    `SELECT DISTINCT unnest(applicable_event_types) AS t FROM public.service_categories WHERE id IN ('outdoor', 'fireworks', 'dance_floor')`,
  );
  const want = [...new Set(['birthday', 'simple_event', 'wake', ...merged.rows.map((x) => x.t)])].sort();
  assert.ok(want.includes('wedding'), 'fixture: the merged categories no longer serve a wedding — re-read this test');
  assert.deepEqual([...(r.rows[0]?.t ?? [])].sort(), want);
});

test('its services exist and INHERIT the tile scope', async () => {
  const r = await db.query<{ canonical_service: string; t: string[] | null }>(
    `SELECT canonical_service, applicable_event_types AS t
       FROM public.canonical_service_taxonomy WHERE tile_id = 'chairs_tents' AND merged_into IS NULL
      ORDER BY canonical_service`,
  );
  // T1 (20271349668764): event_lights_rental folded into Lights & Sounds; the approved additions joined. T1 part 2
  // (20271350082350): Outdoor, Fireworks and Dance Floor's services moved in (three of them ⛔ hidden by part 1).
  assert.deepEqual(
    r.rows.map((x) => x.canonical_service),
    [
      'bug_repellent_station', 'chair_table_rental', 'cold_sparks', 'cooling_fans_misters', 'fireworks_pyro',
      'generator_rental', 'led_dance_floor', 'lounge_set_rental', 'mobile_restroom_rental', 'parasol_hat_rental',
      'ribbon_cutting_set', 'stage_truss', 'tent_canopy_rental', 'wedding_day_weather_forecaster',
    ],
  );
  for (const x of r.rows) {
    assert.equal(x.t, null, `${x.canonical_service} overrides the tile — owner edits would stop reaching it`);
  }
});

test("the owner's birthday starter list all reaches a birthday", async () => {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM public.service_categories
      WHERE id IN ('cake','photo_booth','kids_entertainer','dessert','food_cart',
                   'led_wall','performers','souvenir_giveaways')
        AND 'birthday' = ANY (applicable_event_types)`,
  );
  assert.equal(r.rows.length, 8);
});
