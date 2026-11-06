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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/*
 * ⚖ TAXONOMY V2 (owner-approved 2026-11-06, DECISION_LOG "TAXONOMY V2 APPROVED") renamed this row "Rentals &
 * outdoor", folded Outdoor's rentals into it, and HAND-SET every picker service's event scope — weddings included
 * (chair_table_rental lists `wedding`). So the two P3 premises below changed by the owner's decision, and each is
 * re-pointed at the approved file rather than dropped:
 *   · the row's scope is EXACTLY what its services reach: step 10b of the migration drops a claim no service fills.
 *     Of the three P3 put there, wake and birthday stay (its services reach both); simple_event goes — it is v2's one
 *     `no_marketplace_event_types` entry, and no v2 service is scoped to it;
 *   · its picker services are v2's list, each carrying v2's own scope (no longer NULL / inherited).
 */
const V2 = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'data', 'taxonomy-v2-2026-11-06.json'), 'utf8'),
) as { groups: { categories: { tile: string; services: { key: string; event_types: string[] }[] }[] }[] };
const V2_SERVICES = V2.groups.flatMap((g) => g.categories).find((c) => c.tile === 'chairs_tents')!.services;

test('scoped to wake · birthday — and, since v2, to exactly the events its services reach', async () => {
  const r = await db.query<{ t: string[] | null }>(
    `SELECT applicable_event_types AS t FROM public.service_categories WHERE id = 'chairs_tents'`,
  );
  const scope = new Set(r.rows[0]?.t ?? []);
  for (const e of ['birthday', 'wake']) assert.ok(scope.has(e), `the row lost ${e}`);
  assert.ok(!scope.has('simple_event'), 'v2: a Get-together has no marketplace, yet the row still claims it');
  const reach = new Set(V2_SERVICES.flatMap((s) => s.event_types));
  assert.deepEqual([...scope].sort(), [...reach].sort(), 'the row claims an event its services do not reach, or misses one they do');
});

test('its picker services are v2\'s, each with v2\'s own scope', async () => {
  const r = await db.query<{ canonical_service: string; t: string[] | null }>(
    `SELECT canonical_service, applicable_event_types AS t
       FROM public.canonical_service_taxonomy
      WHERE tile_id = 'chairs_tents' AND merged_into IS NULL AND NOT COALESCE(marketplace_hidden, FALSE)
      ORDER BY canonical_service`,
  );
  assert.deepEqual(r.rows.map((x) => x.canonical_service), V2_SERVICES.map((s) => s.key).sort());
  for (const x of r.rows) {
    const want = V2_SERVICES.find((s) => s.key === x.canonical_service)!.event_types;
    assert.deepEqual([...(x.t ?? [])].sort(), [...want].sort(), `${x.canonical_service} is not v2's scope`);
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
