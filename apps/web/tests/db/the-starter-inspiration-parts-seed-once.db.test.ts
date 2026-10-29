/**
 * the-starter-inspiration-parts-seed-once.db.test.ts — 🌱 THE STARTER INSPIRATION LOOKS (owner 2026-10-29, verbatim:
 * "proposed inspiration starter yes."; migration 20271296836679_seed_the_starter_inspiration_parts.sql).
 *
 * Replays every migration EXCEPT the seed, gives the database the five services (and the one category) the owner added
 * from /admin/categories in production only, then applies the seed file TWICE — the way a re-run would — and proves:
 *
 *   1 · ⭐ THE 272 NEW PARTS EXIST WITH THEIR 2,384 LINKS, each part with the label, home and service order of the
 *       approved parts.csv (read back off the migration's own generated block, not re-typed here), and the categories
 *       the double-write trigger would have written (`inspiration_part_categories` = the derived view).
 *   2 · ⭐ AN EXISTING PART AND ITS LINKS ARE UNCHANGED — all 29, row for row, across both applies.
 *   3 · ⭐ A SECOND APPLY INSERTS NOTHING — not a part, not a link, not a category row; and an admin's label edit on a
 *       seed part stays.
 *   4 · ⭐ A LINK DELETED AFTER THE FIRST APPLY IS NOT RE-CREATED BY THE SECOND (the one-time guard: links go only to
 *       parts THIS run inserted).
 *   5 · A key an admin already took is left alone and gains no link; a missing service is skipped, not fatal.
 *
 * 🛡 Sabotaged once each (2026-10-29, builder; the migration restored after each, `git status --short` clean):
 *   · S1 links joined to EVERY seed part, not `_starter_inserted` → 2, 3 and 4 red (the deleted link came back; the
 *     admin's own part gained the seed's links);
 *   · S2 the parts' `ON CONFLICT DO NOTHING` → `DO UPDATE SET label_en = EXCLUDED.label_en` → 2, 3 and 4 red;
 *   · S3 home taken from the LAST listed service (`ORDER BY l.slot_key, l.ord DESC`) → 1 red;
 *   · S4 the set-based double write removed → "the double write" red;
 *   · S5 an `UPDATE … SET hidden = TRUE WHERE slot_key = 'cake'` slipped into the seed → 2 red alone.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, createReplayedDb, versionOf } from './replay-migrations';

const SEED_FILE = '20271296836679_seed_the_starter_inspiration_parts.sql';
const SEED_SQL = readFileSync(join(MIGRATIONS_DIR, SEED_FILE), 'utf8');

/** The approved review set, as the migration's generated block carries it. */
function seedBlock(): { parts: Array<{ key: string; label: string }>; links: Map<string, string[]> } {
  const a = SEED_SQL.indexOf('INSERT INTO _starter_parts');
  const b = SEED_SQL.indexOf('INSERT INTO _starter_links');
  const c = SEED_SQL.indexOf('-- END GENERATED SEED');
  assert.ok(a > 0 && b > a && c > b, 'the generated block is not where the test expects it');
  const tuple = /\(\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+)\)/g;
  const un = (s: string) => s.replace(/''/g, "'");
  const parts = [...SEED_SQL.slice(a, b).matchAll(tuple)].map((m) => ({ key: un(m[1]!), label: un(m[2]!), ord: Number(m[3]) }));
  const links = new Map<string, string[]>();
  for (const m of [...SEED_SQL.slice(b, c).matchAll(tuple)].sort((x, y) => Number(x[3]) - Number(y[3]))) {
    const list = links.get(m[1]!) ?? [];
    list.push(m[2]!);
    links.set(m[1]!, list);
  }
  return { parts: parts.sort((x, y) => x.ord - y.ord), links };
}

/** Added from /admin/categories on 29 Oct — in production only (read-only check before writing), not in a migration. */
const PROD_ONLY_SERVICES: ReadonlyArray<[string, string]> = [
  ['custom_made_shoes', 'shoes_footwear'],
  ['shoe_rental', 'shoes_footwear'],
  ['shoe_repair', 'shoes_footwear'],
  ['massage_therapist', 'massage_chair'],
  ['foot_reflexology', 'massage_chair'],
];

let db: PGlite;

type PartRow = { slot_key: string; label_en: string; kind: string; home_category_id: string | null; sort_order: number; hidden: boolean; status: string };
type LinkRow = { slot_key: string; canonical_service: string; sort_order: number };
type CatRow = { slot_key: string; category_id: string; sort_order: number };

async function allParts(): Promise<PartRow[]> {
  return (
    await db.query<PartRow>(
      `SELECT slot_key, label_en, kind, home_category_id, sort_order, hidden, status FROM public.inspiration_parts ORDER BY slot_key`,
    )
  ).rows;
}
async function allLinks(): Promise<LinkRow[]> {
  return (
    await db.query<LinkRow>(
      `SELECT slot_key, canonical_service, sort_order FROM public.inspiration_part_services ORDER BY slot_key, canonical_service`,
    )
  ).rows;
}
async function allCats(): Promise<CatRow[]> {
  return (
    await db.query<CatRow>(
      `SELECT slot_key, category_id, sort_order FROM public.inspiration_part_categories ORDER BY slot_key, category_id`,
    )
  ).rows;
}

const seed = seedBlock();
const seedKeys = new Set(seed.parts.map((p) => p.key));
let before0: { parts: PartRow[]; links: LinkRow[]; cats: CatRow[] };
let after1: { parts: PartRow[]; links: LinkRow[]; cats: CatRow[] };
let after2: { parts: PartRow[]; links: LinkRow[]; cats: CatRow[] };
let deletedLink: LinkRow;
const ADMIN_TAKEN = 'sweetheart_table';

before(async () => {
  const seedVersion = versionOf(SEED_FILE);
  const others = new Set(
    readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map(versionOf)
      .filter((v) => v !== seedVersion),
  );
  db = (await createReplayedDb({ only: others })).db;

  /* Production's shape for the owner's 29 Oct additions. */
  await db.query(
    `INSERT INTO public.service_categories (id, tier, label_en, slug, parent_id)
     VALUES ('shoes_footwear', 2, 'Shoes & Footwear', 'shoes-footwear', 'look') ON CONFLICT (id) DO NOTHING`,
  );
  for (const [k, tile] of PROD_ONLY_SERVICES) {
    await db.query(
      `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, phase, tile_id)
       SELECT $1, folder_id, phase, $2 FROM public.canonical_service_taxonomy ORDER BY canonical_service LIMIT 1
       ON CONFLICT (canonical_service) DO NOTHING`,
      [k, tile],
    );
  }

  /* An admin made a part by one of the seed's names before the seed landed — it must be left alone. */
  await db.query(
    `INSERT INTO public.inspiration_parts (slot_key, label_en, kind, home_category_id, sort_order)
     VALUES ($1, 'Our sweetheart table', 'part', 'reception', 1)`,
    [ADMIN_TAKEN],
  );
  await db.query(`INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order) VALUES ($1, 'events_place', 0)`, [
    ADMIN_TAKEN,
  ]);

  before0 = { parts: await allParts(), links: await allLinks(), cats: await allCats() };

  await db.exec(SEED_SQL);
  after1 = { parts: await allParts(), links: await allLinks(), cats: await allCats() };

  /* After the first apply: an admin unlinks one look from one service, and renames another look. */
  deletedLink = after1.links.find((l) => l.slot_key === 'presidential_table')!;
  await db.query(`DELETE FROM public.inspiration_part_services WHERE slot_key = $1 AND canonical_service = $2`, [
    deletedLink.slot_key,
    deletedLink.canonical_service,
  ]);
  await db.query(`UPDATE public.inspiration_parts SET label_en = 'Head table' WHERE slot_key = 'presidential_table'`);
  const edited = { parts: await allParts(), links: await allLinks(), cats: await allCats() };

  await db.exec(SEED_SQL);
  after2 = { parts: await allParts(), links: await allLinks(), cats: await allCats() };
  (after2 as unknown as { edited: typeof edited }).edited = edited;
});

after(async () => {
  await db?.close();
});

const editedState = () => (after2 as unknown as { edited: { parts: PartRow[]; links: LinkRow[]; cats: CatRow[] } }).edited;
const isNew = (slot: string) => seedKeys.has(slot) && slot !== ADMIN_TAKEN;

/* ══ 1 · the 272 new parts and their links ══════════════════════════════════ */

test('⭐ the 272 new parts exist with their 2,384 links — label, home, order exactly as the approved block', async () => {
  assert.equal(seed.parts.length, 272, 'the generated block does not hold 272 parts');
  const nLinks = [...seed.links.values()].reduce((n, l) => n + l.length, 0);
  assert.equal(nLinks, 2384, 'the generated block does not hold 2,384 links');

  const byKey = new Map(after1.parts.map((p) => [p.slot_key, p]));
  const max0 = Math.max(...before0.parts.map((p) => p.sort_order));
  const tile = new Map(
    (await db.query<{ canonical_service: string; tile_id: string }>(`SELECT canonical_service, tile_id FROM public.canonical_service_taxonomy`)).rows.map(
      (r) => [r.canonical_service, r.tile_id],
    ),
  );
  let inserted = 0;
  seed.parts.forEach((sp, i) => {
    if (sp.key === ADMIN_TAKEN) return;
    const row = byKey.get(sp.key);
    assert.ok(row, `${sp.key}: not inserted`);
    inserted += 1;
    assert.equal(row.label_en, sp.label, `${sp.key}: label is not the CSV's`);
    assert.equal(row.kind, 'part');
    assert.equal(row.hidden, false);
    assert.equal(row.status, 'active');
    assert.equal(row.home_category_id, tile.get(seed.links.get(sp.key)![0]!), `${sp.key}: home is not the first service's tile`);
    assert.equal(row.sort_order, max0 + i + 1, `${sp.key}: sort_order is not max + its place`);
  });
  assert.equal(inserted, 271, 'every seed part but the admin-taken key is inserted');

  for (const [key, services] of seed.links) {
    const got = after1.links.filter((l) => l.slot_key === key).sort((a, b) => a.sort_order - b.sort_order);
    if (key === ADMIN_TAKEN) continue;
    assert.deepEqual(got.map((l) => l.canonical_service), services, `${key}: links are not the CSV's, in order`);
    assert.deepEqual(got.map((l) => l.sort_order), services.map((_, i) => i), `${key}: link sort_order is not 0..n-1`);
  }
  const newLinks = after1.links.filter((l) => isNew(l.slot_key)).length;
  assert.equal(newLinks, 2384 - seed.links.get(ADMIN_TAKEN)!.length);
});

test('the double write: every new part’s stored categories equal the derived view', async () => {
  const derived = (
    await db.query<CatRow>(
      `SELECT slot_key, category_id, sort_order FROM public.inspiration_part_categories_derived ORDER BY slot_key, category_id`,
    )
  ).rows.filter((r) => isNew(r.slot_key));
  const stored = after1.cats.filter((r) => isNew(r.slot_key));
  assert.ok(derived.length > 0, 'no new part derives an also-category — the comparison would be vacuous');
  assert.deepEqual(stored, derived);
  const trig = await db.query<{ tgenabled: string }>(
    `SELECT tgenabled FROM pg_trigger WHERE tgname = 'inspiration_part_services_keep_categories'`,
  );
  assert.equal(trig.rows[0]?.tgenabled, 'O', 'the double-write trigger was left disabled');
});

/* ══ 2 · existing rows unchanged ════════════════════════════════════════════ */

test('⭐ every existing part and link is unchanged by both applies — the admin-taken key included', async () => {
  const old = new Set(before0.parts.map((p) => p.slot_key));
  assert.equal(old.size, 30, '29 parts + the admin-made one');
  for (const state of [after1, after2]) {
    assert.deepEqual(state.parts.filter((p) => old.has(p.slot_key)), before0.parts);
    assert.deepEqual(state.links.filter((l) => old.has(l.slot_key)), before0.links);
    assert.deepEqual(state.cats.filter((c) => old.has(c.slot_key)), before0.cats);
  }
  assert.deepEqual(
    after2.links.filter((l) => l.slot_key === ADMIN_TAKEN).map((l) => l.canonical_service),
    ['events_place'],
    'the admin’s own part gained the seed’s links',
  );
});

/* ══ 3 · a second apply inserts nothing ═════════════════════════════════════ */

test('⭐ a second apply inserts nothing — and an admin’s label edit on a seed part stays', async () => {
  const e = editedState();
  assert.deepEqual(after2.parts, e.parts, 'the second apply changed inspiration_parts');
  assert.deepEqual(after2.links, e.links, 'the second apply changed inspiration_part_services');
  assert.deepEqual(after2.cats, e.cats, 'the second apply changed inspiration_part_categories');
  assert.equal(after2.parts.find((p) => p.slot_key === 'presidential_table')?.label_en, 'Head table');
});

/* ══ 4 · a removed link stays removed ═══════════════════════════════════════ */

test('⭐ a link an admin deleted after the first apply is NOT re-created by the second', async () => {
  assert.ok(deletedLink, 'the fixture found no link to delete');
  assert.ok(
    !after2.links.some((l) => l.slot_key === deletedLink.slot_key && l.canonical_service === deletedLink.canonical_service),
    `the second apply re-linked ${deletedLink.slot_key} → ${deletedLink.canonical_service}`,
  );
  assert.equal(after2.links.length, after1.links.length - 1);
});

/* ══ 5 · without the prod-only services, the replay still applies ═══════════ */

test('the full replay (no prod-only services) applies the seed and skips only what it cannot place', async () => {
  const full = (await createReplayedDb()).db;
  try {
    const parts = await full.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.inspiration_parts WHERE slot_key = ANY($1::text[])`,
      [[...seedKeys]],
    );
    const missing = new Set(PROD_ONLY_SERVICES.map(([k]) => k));
    const placeable = seed.parts.filter((p) => seed.links.get(p.key)!.some((s) => !missing.has(s))).length;
    assert.equal(parts.rows[0]!.n, placeable, 'a part with a live first-or-later service was not seeded');
    const links = await full.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.inspiration_part_services WHERE slot_key = ANY($1::text[])`,
      [[...seedKeys]],
    );
    const expected = [...seed.links].reduce((n, [, s]) => n + s.filter((k) => !missing.has(k)).length, 0);
    assert.equal(links.rows[0]!.n, expected);
  } finally {
    await full.close();
  }
});
