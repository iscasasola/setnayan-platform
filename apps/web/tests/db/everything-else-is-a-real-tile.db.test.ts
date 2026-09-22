/**
 * "EVERYTHING ELSE" IS A REAL TILE, IN THE RIGHT FOLDER, AND HIDDEN.
 *
 * `20271240202428_self_added_suppliers_have_a_home.sql` seeds the home for a
 * self-added supplier whose trade the app could not name (`category = 'misc'`,
 * which used to be filed under "Cars & transport › Escort").
 *
 * Three properties carry the behaviour, and each fails differently:
 *
 *   • `parent_id = 'logistics_safety'` — which FOLDER the supplier renders in.
 *     Wrong parent puts a hotel back under Cars & transport.
 *   • `marketplace_hidden = TRUE` — the tile holds no canonical service, so it
 *     must not be offered for browsing. Flipping it to FALSE puts an empty
 *     "Everything else" tile in the catalogue: a fake door.
 *   • `applicable_event_types IS NULL` — universal. Any celebration can acquire
 *     a supplier we cannot classify, and `passesEventTypeFilter` reads NULL as
 *     "serves all events". Scoping it to a list would drop the fallback for
 *     every type missing from that list.
 *
 * ⚠ THE HIDDEN FLAG IS ONLY SAFE BECAUSE THE BENCH QUALIFIES ITS FILTER with
 * `vendors.length === 0`. That half is proven by EXECUTING the builder in
 * `lib/a-self-added-supplier-has-a-home.test.ts` — this file only pins the row.
 * Neither test is sufficient alone: the row could be right while the filter
 * hides it anyway, or the filter could be right while the row is mis-parented.
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

type Row = {
  parent_id: string | null;
  tier: number;
  label_en: string;
  slug: string;
  status: string;
  marketplace_hidden: boolean;
  applicable_event_types: string[] | null;
};

test('the tile exists as a tier-2 leaf under Logistics & safety', async () => {
  const r = await db.query<Row>(
    `SELECT parent_id, tier, label_en, slug, status, marketplace_hidden, applicable_event_types
       FROM public.service_categories WHERE id = 'everything_else'`,
  );
  assert.equal(r.rows.length, 1, 'the migration must seed exactly one such row');
  const row = r.rows[0]!;
  assert.equal(row.parent_id, 'logistics_safety', 'wrong parent re-files a hotel under Cars & transport');
  assert.equal(row.tier, 2);
  assert.equal(row.label_en, 'Everything else');
  assert.equal(row.slug, 'everything-else');
  assert.equal(row.status, 'active');
});

test('it is hidden from browsing, and universal across event types', async () => {
  const r = await db.query<Row>(
    `SELECT marketplace_hidden, applicable_event_types
       FROM public.service_categories WHERE id = 'everything_else'`,
  );
  const row = r.rows[0]!;
  assert.equal(
    row.marketplace_hidden,
    true,
    'FALSE would put an empty "Everything else" in the catalogue — a fake door, '
      + 'since the tile deliberately holds no canonical service',
  );
  assert.equal(
    row.applicable_event_types,
    null,
    'NULL means universal; a list would drop the fallback for every type not in it',
  );
});

test('its parent folder really exists — a tile under a missing folder renders nowhere', async () => {
  const r = await db.query<{ tier: number; label_en: string }>(
    `SELECT tier, label_en FROM public.service_categories WHERE id = 'logistics_safety'`,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.tier, 1, 'the parent must be a tier-1 folder');
  assert.equal(r.rows[0]!.label_en, 'Logistics & safety');
});

test('no canonical service was seeded under it, deliberately', async () => {
  // The tile is a home for what the couple types in, not a catalogue of things
  // to buy. A service appearing here later would make the hidden flag wrong
  // rather than merely unnecessary, so it is worth noticing.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.canonical_service_taxonomy WHERE tile_id = 'everything_else'`,
  );
  assert.equal(
    r.rows[0]!.n,
    0,
    'if a real service belongs here, revisit marketplace_hidden — the tile would '
      + 'then be something a couple could genuinely browse',
  );
});
