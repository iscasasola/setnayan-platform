/**
 * the-four-levels-write-through.db.test.ts — every write the four-level Categories page makes, run for REAL
 * (🌳 ③b; corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 7.2–7.3 + § 7.8).
 *
 * The cores in `app/admin/categories/_components/taxonomy-writes.ts` are the ONE implementation both doors
 * call (the shipped redirecting forms in `actions.ts`, the map's JSON doors in `four-level-actions.ts`).
 * Here each runs against the replayed schema through `supabase-over-pglite.ts`'s service-role-shaped
 * client — the client production hands them — so a column that is not a column, a CHECK the write breaks,
 * or a trigger that disagrees fails HERE, not on the owner's screen.
 *
 *   add      a group (born hidden) · a category (shows its new-and-empty group; inherits its coarse filing)
 *            · a service (last in its category) · a part (home + the services it was born with)
 *   link     tick / untick a service on a part — the ③a double write follows
 *   move     a part's home (heading only — its services stay) · a service to another category · Undo
 *   order    groups · a category's services (the new sort_order) · a home's parts
 *   files as an explicit coarse filing overrides the inherited one; a made-up value is refused
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import type { AdminDb } from '../../app/admin/categories/_components/taxonomy-writes';

type Writes = typeof import('../../app/admin/categories/_components/taxonomy-writes');
let W: Writes;
let replay: ReplayResult;
let db: PGlite;
let admin: AdminDb;
const ACTOR = '00000000-0000-4000-8000-0000000000ad';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db) as unknown as AdminDb;
  W = await import('../../app/admin/categories/_components/taxonomy-writes');
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await db.query<T>(sql, params)).rows[0];
}
async function col(sql: string, params: unknown[] = []): Promise<string[]> {
  return (await db.query<{ v: string }>(sql, params)).rows.map((r) => r.v);
}

test('the seed replayed — the writes below are checked against a real tree', async () => {
  const n = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.service_categories WHERE tier = 2`);
  assert.ok((n?.n ?? 0) > 50, 'the category seed did not replay — nothing was checked');
  const parts = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_part_services`);
  assert.ok((parts?.n ?? 0) > 100, 'the ③a links did not replay');
});

test('add a group → born HIDDEN from couples, last in the order; its first category shows it', async () => {
  const g = await W.addGroupCore(admin, ACTOR, 'Four Level Test Group');
  assert.ok(g.ok, JSON.stringify(g));
  const row = await one<{ tier: number; kind: string; marketplace_hidden: boolean; sort_order: number; parent_id: string | null }>(
    `SELECT tier, kind, marketplace_hidden, sort_order, parent_id FROM public.service_categories WHERE id = $1`,
    [g.ok ? g.id : ''],
  );
  assert.deepEqual({ tier: row?.tier, kind: row?.kind, hidden: row?.marketplace_hidden, parent: row?.parent_id }, { tier: 1, kind: 'branch', hidden: true, parent: null });
  const max = await one<{ m: number }>(`SELECT max(sort_order)::int AS m FROM public.service_categories WHERE tier = 1`);
  assert.equal(row?.sort_order, max?.m, 'a new group is not last');
  // A duplicate name is refused, not overwritten.
  const dupe = await W.addGroupCore(admin, ACTOR, 'Four Level Test Group');
  assert.equal(dupe.ok, false);

  /* 🧪 SABOTAGE TARGET: the first category shows the new-and-empty group (DECISION_LOG controller call). */
  const c = await W.addCategoryCore(admin, ACTOR, 'four_level_test_group', 'Four Level Test Category');
  assert.ok(c.ok, JSON.stringify(c));
  const after = await one<{ marketplace_hidden: boolean }>(`SELECT marketplace_hidden FROM public.service_categories WHERE id = 'four_level_test_group'`);
  assert.equal(after?.marketplace_hidden, false, 'the group stayed hidden after its first category');
  const cat = await one<{ tier: number; parent_id: string; sort_order: number }>(
    `SELECT tier, parent_id, sort_order FROM public.service_categories WHERE id = 'four_level_test_category'`,
  );
  assert.deepEqual(cat, { tier: 2, parent_id: 'four_level_test_group', sort_order: 0 });
});

test('add a category to an existing group → last among its siblings, filed like them (the ③0-c trigger)', async () => {
  const before = await one<{ coarse: string | null }>(
    `SELECT mode() WITHIN GROUP (ORDER BY coarse_category) AS coarse FROM public.service_categories WHERE parent_id = 'look' AND coarse_category IS NOT NULL`,
  );
  const c = await W.addCategoryCore(admin, ACTOR, 'look', 'Four Level Look Category');
  assert.ok(c.ok, JSON.stringify(c));
  const row = await one<{ coarse_category: string | null; sort_order: number }>(
    `SELECT coarse_category, sort_order FROM public.service_categories WHERE id = 'four_level_look_category'`,
  );
  const max = await one<{ m: number }>(`SELECT max(sort_order)::int AS m FROM public.service_categories WHERE parent_id = 'look'`);
  assert.equal(row?.sort_order, max?.m);
  assert.equal(row?.coarse_category, before?.coarse, 'a new category is not filed like its group');
  // A group that is not hidden stays as it was.
  const look = await one<{ marketplace_hidden: boolean }>(`SELECT marketplace_hidden FROM public.service_categories WHERE id = 'look'`);
  assert.equal(look?.marketplace_hidden, false);
  // A category under a category is refused.
  assert.equal((await W.addCategoryCore(admin, ACTOR, 'grooms_attire', 'Nested Nope')).ok, false);
});

test('"Files shops as ▾" — an explicit filing overrides the inherited one; clearing writes NULL; a made-up value is refused', async () => {
  const set = await W.setCoarseCategoryCore(admin, ACTOR, 'four_level_look_category', 'photographer');
  assert.ok(set.ok, JSON.stringify(set));
  assert.equal((await one<{ c: string }>(`SELECT coarse_category::text AS c FROM public.service_categories WHERE id = 'four_level_look_category'`))?.c, 'photographer');
  const bad = await W.setCoarseCategoryCore(admin, ACTOR, 'four_level_look_category', 'not_a_filing');
  assert.equal(bad.ok, false);
  const clear = await W.setCoarseCategoryCore(admin, ACTOR, 'four_level_look_category', '');
  assert.ok(clear.ok);
  assert.equal((await one<{ c: string | null }>(`SELECT coarse_category::text AS c FROM public.service_categories WHERE id = 'four_level_look_category'`))?.c, null);
  // A group is not a category.
  assert.equal((await W.setCoarseCategoryCore(admin, ACTOR, 'look', 'photographer')).ok, false);
});

test('add a service → two tables, LAST in its category (the new sort_order); a duplicate key is refused', async () => {
  const s = await W.addServiceCore(admin, ACTOR, { tileId: 'grooms_attire', label: 'Four Level Groom Cape' });
  assert.ok(s.ok, JSON.stringify(s));
  const tax = await one<{ tile_id: string; folder_id: string; sort_order: number }>(
    `SELECT tile_id, folder_id, sort_order FROM public.canonical_service_taxonomy WHERE canonical_service = 'four_level_groom_cape'`,
  );
  const schema = await one<{ display_name_en: string }>(`SELECT display_name_en FROM public.canonical_service_schemas WHERE canonical_service = 'four_level_groom_cape'`);
  assert.equal(schema?.display_name_en, 'Four Level Groom Cape');
  const max = await one<{ m: number }>(`SELECT max(sort_order)::int AS m FROM public.canonical_service_taxonomy WHERE tile_id = 'grooms_attire'`);
  assert.equal(tax?.tile_id, 'grooms_attire');
  assert.equal(tax?.sort_order, max?.m, 'a new service is not last in its category');
  assert.equal((await W.addServiceCore(admin, ACTOR, { tileId: 'grooms_attire', label: 'Four Level Groom Cape' })).ok, false);
  // 🔑 A new service reaches NO part until someone links it (DECISION_LOG controller call (3)).
  assert.deepEqual(await col(`SELECT slot_key AS v FROM public.inspiration_part_services WHERE canonical_service = 'four_level_groom_cape'`), []);
});

test('Order ▾ on services — a permutation only, written dense; anything else is refused', async () => {
  const keys = await col(`SELECT canonical_service AS v FROM public.canonical_service_taxonomy WHERE tile_id = 'grooms_attire' AND merged_into IS NULL ORDER BY sort_order, canonical_service`);
  assert.ok(keys.length >= 3);
  const reversed = [...keys].reverse();
  const r = await W.reorderServicesCore(admin, ACTOR, 'grooms_attire', reversed);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(await col(`SELECT canonical_service AS v FROM public.canonical_service_taxonomy WHERE tile_id = 'grooms_attire' AND merged_into IS NULL ORDER BY sort_order`), reversed);
  assert.equal((await W.reorderServicesCore(admin, ACTOR, 'grooms_attire', reversed.slice(1))).ok, false, 'a dropped service was accepted');
  assert.equal((await W.reorderServicesCore(admin, ACTOR, 'grooms_attire', [...reversed, 'photographer'])).ok, false, 'a foreign service was accepted');
});

test('add a part → home = the category, linked to the services it was born with; the key is made from the name', async () => {
  const svcs = await col(`SELECT canonical_service AS v FROM public.canonical_service_taxonomy WHERE tile_id = 'grooms_attire' AND merged_into IS NULL AND NOT marketplace_hidden ORDER BY canonical_service LIMIT 2`);
  const p = await W.addPartCore(admin, ACTOR, { homeCategoryId: 'grooms_attire', label: 'Four-Level Cufflinks', services: svcs });
  assert.ok(p.ok, JSON.stringify(p));
  assert.equal(p.ok && p.id, 'four_level_cufflinks');
  const row = await one<{ home_category_id: string; kind: string }>(`SELECT home_category_id, kind FROM public.inspiration_parts WHERE slot_key = 'four_level_cufflinks'`);
  assert.deepEqual(row, { home_category_id: 'grooms_attire', kind: 'part' });
  assert.deepEqual(await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'four_level_cufflinks' ORDER BY canonical_service`), [...svcs].sort());
  // The ③a derivation (what the reader reads) follows the new part at once.
  assert.deepEqual(await col(`SELECT category_id AS v FROM public.inspiration_part_categories_derived WHERE slot_key = 'four_level_cufflinks'`), ['grooms_attire']);
  // A second part of the same name gets its own key; an unknown service is refused.
  const again = await W.addPartCore(admin, ACTOR, { homeCategoryId: 'grooms_attire', label: 'Four-Level Cufflinks', services: [] });
  assert.ok(again.ok && again.id === 'four_level_cufflinks_2', JSON.stringify(again));
  assert.equal((await W.addPartCore(admin, ACTOR, { homeCategoryId: 'grooms_attire', label: 'Ghost Part', services: ['no_such_service'] })).ok, false);
});

test('the picker — tick links THIS service (a row, never a copy), untick unlinks; the ③a double write follows', async () => {
  /* 🧪 SABOTAGE TARGET: a tick writes exactly one inspiration_part_services row. */
  const before = await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'four_level_cufflinks'`);
  const on = await W.linkPartServicesCore(admin, ACTOR, 'four_level_cufflinks', ['photographer'], true);
  assert.ok(on.ok, JSON.stringify(on));
  const linked = await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'four_level_cufflinks'`);
  assert.deepEqual([...linked].sort(), [...before, 'photographer'].sort());
  const parts = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_parts WHERE label_en = 'Four-Level Cufflinks'`);
  assert.equal(parts?.n, 2, 'a tick copied the part');
  // The stored copy is the derivation (③a's trigger), now including the photographer's own category.
  const stored = await col(`SELECT category_id AS v FROM public.inspiration_part_categories WHERE slot_key = 'four_level_cufflinks' ORDER BY category_id`);
  const derived = await col(`SELECT category_id AS v FROM public.inspiration_part_categories_derived WHERE slot_key = 'four_level_cufflinks' ORDER BY category_id`);
  assert.deepEqual(stored, derived);
  // Ticking again is a no-op, not a duplicate.
  assert.ok((await W.linkPartServicesCore(admin, ACTOR, 'four_level_cufflinks', ['photographer'], true)).ok);
  const off = await W.linkPartServicesCore(admin, ACTOR, 'four_level_cufflinks', ['photographer'], false);
  assert.ok(off.ok);
  assert.deepEqual((await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'four_level_cufflinks'`)).sort(), [...before].sort());
  // The palette (kind = system) takes no services.
  assert.equal((await W.linkPartServicesCore(admin, ACTOR, 'palette', ['photographer'], true)).ok, false);
  // The drawer's Services ▾ writes only the difference.
  const set = await W.setPartServicesCore(admin, ACTOR, 'four_level_cufflinks', ['photographer']);
  assert.ok(set.ok);
  assert.deepEqual(await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'four_level_cufflinks'`), ['photographer']);
});

test('move a part home → the heading moves, its services do not; Undo puts it back', async () => {
  const servicesBefore = await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'groom' ORDER BY canonical_service`);
  const m = await W.movePartHomeCore(admin, ACTOR, 'groom', 'brides_attire');
  assert.ok(m.ok, JSON.stringify(m));
  assert.equal(m.ok && m.previous, 'grooms_attire');
  assert.equal((await one<{ h: string }>(`SELECT home_category_id AS h FROM public.inspiration_parts WHERE slot_key = 'groom'`))?.h, 'brides_attire');
  assert.deepEqual(await col(`SELECT canonical_service AS v FROM public.inspiration_part_services WHERE slot_key = 'groom' ORDER BY canonical_service`), servicesBefore, 'moving the home changed who may add photos');
  const undo = await W.movePartHomeCore(admin, ACTOR, 'groom', m.ok ? m.previous! : '');
  assert.ok(undo.ok);
  assert.equal((await one<{ h: string }>(`SELECT home_category_id AS h FROM public.inspiration_parts WHERE slot_key = 'groom'`))?.h, 'grooms_attire');
  assert.equal((await W.movePartHomeCore(admin, ACTOR, 'groom', 'look')).ok, false, 'a group was accepted as a home');
});

test('move a service (drag onto a category) → tile AND the denormalized folder; Undo moves it back', async () => {
  const m = await W.moveServiceCore(admin, ACTOR, 'four_level_groom_cape', 'brides_attire');
  assert.ok(m.ok, JSON.stringify(m));
  const row = await one<{ tile_id: string; folder_id: string }>(`SELECT tile_id, folder_id FROM public.canonical_service_taxonomy WHERE canonical_service = 'four_level_groom_cape'`);
  const parent = await one<{ p: string }>(`SELECT parent_id AS p FROM public.service_categories WHERE id = 'brides_attire'`);
  assert.deepEqual(row, { tile_id: 'brides_attire', folder_id: parent?.p });
  const undo = await W.moveServiceCore(admin, ACTOR, 'four_level_groom_cape', m.ok ? m.previous! : '');
  assert.ok(undo.ok);
  assert.equal((await one<{ t: string }>(`SELECT tile_id AS t FROM public.canonical_service_taxonomy WHERE canonical_service = 'four_level_groom_cape'`))?.t, 'grooms_attire');
});

test('Order ▾ on parts — the home’s parts trade their own positions; no other part moves', async () => {
  const others = await col(`SELECT slot_key || ':' || sort_order AS v FROM public.inspiration_parts WHERE home_category_id IS DISTINCT FROM 'grooms_attire' ORDER BY slot_key`);
  const keys = await col(`SELECT slot_key AS v FROM public.inspiration_parts WHERE home_category_id = 'grooms_attire' ORDER BY sort_order, slot_key`);
  assert.ok(keys.length >= 2);
  const reversed = [...keys].reverse();
  const r = await W.reorderPartsCore(admin, ACTOR, 'grooms_attire', reversed);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(await col(`SELECT slot_key AS v FROM public.inspiration_parts WHERE home_category_id = 'grooms_attire' ORDER BY sort_order, slot_key`), reversed);
  assert.deepEqual(await col(`SELECT slot_key || ':' || sort_order AS v FROM public.inspiration_parts WHERE home_category_id IS DISTINCT FROM 'grooms_attire' ORDER BY slot_key`), others, 'a part in another category moved');
});

test('Order ▾ on groups — a permutation of the tier-1 rows only', async () => {
  const ids = await col(`SELECT id AS v FROM public.service_categories WHERE tier = 1 ORDER BY sort_order, id`);
  const moved = [ids[ids.length - 1]!, ...ids.slice(0, -1)];
  const r = await W.reorderGroupsCore(admin, ACTOR, moved);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(await col(`SELECT id AS v FROM public.service_categories WHERE tier = 1 ORDER BY sort_order`), moved);
  assert.equal((await W.reorderGroupsCore(admin, ACTOR, [...moved, 'grooms_attire'])).ok, false);
});

test('every write left an audit row', async () => {
  const actions = await col(`SELECT DISTINCT action AS v FROM public.admin_audit_log WHERE actor_user_id = $1 ORDER BY action`, [ACTOR]);
  for (const a of ['taxonomy.create_group', 'taxonomy.create', 'taxonomy.create_leaf', 'taxonomy.create_part', 'taxonomy.link_part_services', 'taxonomy.move_part_home', 'taxonomy.remap_canonical', 'taxonomy.reorder_services', 'taxonomy.reorder_parts', 'taxonomy.reorder_groups', 'taxonomy.set_coarse_category']) {
    assert.ok(actions.includes(a), `no audit row for ${a} (have: ${actions.join(', ')})`);
  }
});
