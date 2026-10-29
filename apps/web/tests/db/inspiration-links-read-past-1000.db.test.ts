/**
 * inspiration-links-read-past-1000.db.test.ts — 📄 the parts' links are read to the END, against the real replayed
 * schema and the real seed (2026-10-30).
 *
 * THE BUG: PR #7058 (`20271296836679_seed_the_starter_inspiration_parts.sql`) put `inspiration_part_services` past
 * 1,000 rows. Every reader selected the whole relation in one request; PostgREST caps a request (Supabase's default
 * `db-max-rows` is 1000) with `error: null`; so Admin › Categories › Reception › Events Place showed only its 2 old
 * parts, and the couple's and supplier's part lists lost every link past row 1,000.
 *
 * HOW THIS TEST SEES IT: the readers are the REAL ones (`readEveryPartRow`, `readInspirationPartTables`,
 * `loadMapData`, `addPartCore`) over `makeAdminClient(db, { maxRows })` — the PGlite adapter capping every select
 * exactly the way `db-max-rows` does, silently. Test 0 proves the cap is in force (an un-ranged select really does
 * come back short with no error) before any green below is trusted.
 *
 * ⚠ What this does NOT exercise: real PostgREST, or RLS — the adapter runs as PGlite's superuser (the service-role
 * stand-in). `getInspirationParts()` itself builds a cookie-bound server client no test can construct, so its
 * three-relation read (`readInspirationPartTables`, the function it calls) is driven here directly, and the RLS
 * grants on the three relations stay covered by `inspiration-parts-seed-equals-the-consts.db.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import { readEveryPartRow, readInspirationPartTables, type PartTablesClient } from '../../lib/inspiration-parts-read';
import { snapshotFromPartRows } from '../../lib/inspiration-parts';

type LoadMap = typeof import('../../app/admin/categories/_components/load-map');
type Writes = typeof import('../../app/admin/categories/_components/taxonomy-writes');

const CAP = 1000;
let replay: ReplayResult;
let db: PGlite;
let LM: LoadMap;
let W: Writes;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  LM = await import('../../app/admin/categories/_components/load-map');
  W = await import('../../app/admin/categories/_components/taxonomy-writes');
});

after(async () => {
  await db?.close();
});

const capped = (maxRows: number = CAP) => makeAdminClient(db, { maxRows });
const asParts = (c: ReturnType<typeof makeAdminClient>) => c as unknown as PartTablesClient;
const key = (r: { slot_key: string; canonical_service: string }) => `${r.slot_key}→${r.canonical_service}`;

async function sqlLinks(): Promise<string[]> {
  const r = await db.query<{ slot_key: string; canonical_service: string }>(
    `SELECT slot_key, canonical_service FROM public.inspiration_part_services ORDER BY slot_key, canonical_service`,
  );
  return r.rows.map(key);
}

test('0 · the replay holds MORE than one page of links, and an un-ranged select of them really is cut short', async () => {
  const all = await sqlLinks();
  assert.ok(all.length > CAP, `the seed holds only ${all.length} links — this test cannot see the cap`);
  // The old reader's exact shape: no range, no count. The cap answers 1000 rows and NO error — the disease.
  const res = (await capped().from('inspiration_part_services').select('slot_key,canonical_service,sort_order')) as {
    data: unknown[] | null;
    error: unknown;
  };
  assert.equal(res.error, null);
  assert.equal(res.data?.length, CAP, 'the adapter cap is not in force, so nothing below proves anything');
});

test('1 · every link row comes back, at the server cap and at a cap BELOW the page size', async () => {
  const want = await sqlLinks();
  for (const maxRows of [CAP, 300]) {
    const got = await readEveryPartRow<{ slot_key: string; canonical_service: string }>(asParts(capped(maxRows)), 'services');
    assert.equal(got.error, null, `cap ${maxRows}: ${got.error}`);
    assert.equal(got.rows.length, want.length, `cap ${maxRows}: ${got.rows.length} of ${want.length} links`);
    assert.deepEqual(got.rows.map(key), want, `cap ${maxRows}: a row was skipped or repeated at a page boundary`);
  }
});

test('2 · the derived categories view and the parts are read to the end too', async () => {
  const cats = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_part_categories_derived`)).rows[0]!.n;
  const parts = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_parts`)).rows[0]!.n;
  // A cap below both sizes, so each relation needs more than one page whatever the seed's size.
  const small = Math.max(1, Math.min(cats, parts) - 7);
  const read = await readInspirationPartTables(asParts(capped(small)));
  assert.equal(read.error, null, String(read.error));
  assert.equal(read.categories.length, cats);
  assert.equal(read.parts.length, parts);
  assert.equal(new Set(read.categories.map((r) => `${r.slot_key}→${r.category_id}`)).size, cats, 'a derived row repeated');
});

test('3 · the couple/supplier snapshot links Sweetheart table to Events Place (a link past row 1,000)', async () => {
  const want = (
    await db.query<{ canonical_service: string }>(
      `SELECT canonical_service FROM public.inspiration_part_services WHERE slot_key = 'sweetheart_table' ORDER BY sort_order, canonical_service`,
    )
  ).rows.map((r) => r.canonical_service);
  assert.ok(want.includes('events_place'), 'the seed no longer links sweetheart_table → events_place; pick another witness');
  const read = await readInspirationPartTables(asParts(capped()));
  assert.equal(read.error, null);
  const snap = snapshotFromPartRows(read.parts, read.categories, read.services);
  const part = snap.parts.find((p) => p.slotKey === 'sweetheart_table');
  assert.ok(part, 'sweetheart_table missing from the snapshot');
  assert.deepEqual([...(part.services ?? [])].sort(), [...want].sort());
});

test('4 · Admin › Categories: every part the tables link to Events Place is in its Parts column', async () => {
  const want = (
    await db.query<{ slot_key: string }>(
      `SELECT ps.slot_key FROM public.inspiration_part_services ps
         JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key
        WHERE ps.canonical_service = 'events_place' AND p.kind = 'part' AND p.status <> 'retired' AND p.home_category_id IS NOT NULL
        ORDER BY ps.slot_key`,
    )
  ).rows.map((r) => r.slot_key);
  assert.ok(want.length > 2, `only ${want.length} parts link events_place — the owner's "2 old parts" would not be visible`);
  const cats = { groups: [], categories: [], services: [], tax: { hiddenCategories: {}, tileCoarseCategory: {} } };
  const map = await LM.loadMapData(capped() as never, cats as never);
  assert.equal(map.partsRead, true, 'the paged read failed');
  const got = map.parts.filter((p) => p.services.includes('events_place')).map((p) => p.key).sort();
  assert.deepEqual(got, want);
  assert.ok(got.includes('sweetheart_table') && got.includes('presidential_table'));
});

test('5 · a read that cannot prove it finished is an ERROR to the admin map, never a short list', async () => {
  // A server that reports no count: the read cannot prove completeness, so the Parts column must say it could not load.
  const base = capped();
  const noCount = {
    ...base,
    from(t: string) {
      const q = base.from(t) as unknown as { select: (c: string, o?: unknown) => unknown };
      return { ...q, select: (c: string) => q.select(c) };
    },
  };
  const cats = { groups: [], categories: [], services: [], tax: { hiddenCategories: {}, tileCoarseCategory: {} } };
  const map = await LM.loadMapData(noCount as never, cats as never);
  assert.equal(map.partsRead, false, 'a read with no count was drawn as the whole list');
});

test('6 · a new part is placed after the LAST part even when the parts run past one page', async () => {
  const actor = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('parts-paging-admin@setnayan.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const max = (await db.query<{ m: number }>(`SELECT max(sort_order)::int AS m FROM public.inspiration_parts`)).rows[0]!.m;
  const home = (await db.query<{ id: string }>(`SELECT id FROM public.service_categories WHERE tier = 2 ORDER BY id LIMIT 1`)).rows[0]!.id;
  // 50 rows a page: the last part is many pages in, so an un-paged read would have seen only the first 50.
  const res = await W.addPartCore(capped(50) as never, actor, { homeCategoryId: home, label: 'Paging Witness Part', services: [] });
  assert.equal(res.ok, true, JSON.stringify(res));
  try {
    const row = (await db.query<{ sort_order: number }>(`SELECT sort_order FROM public.inspiration_parts WHERE slot_key = 'paging_witness_part'`)).rows[0];
    assert.equal(row?.sort_order, max + 1);
  } finally {
    await db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'paging_witness_part'`);
  }
});
