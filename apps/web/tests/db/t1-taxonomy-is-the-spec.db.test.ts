/**
 * BUILD T1 — THE TAXONOMY TABLES EQUAL THE OWNER-APPROVED PHILIPPINE TREE (test:db, migrations replayed).
 *
 * Owner, 2026-11-16: "this is not my taxonomy". The approved tree is corpus `TAXONOMY_PH_FULL_2026-11-07.md`,
 * transcribed with stable slugs into `supabase/data/taxonomy-ph-2026-11-07.json`, and written by migration
 * `20271349743729_t1_philippine_taxonomy.sql`. After the full replay this asserts, against the tables every screen
 * reads (`service_categories`, `canonical_service_taxonomy`, `canonical_service_schemas`):
 *
 *   · every group / category / service is where the spec puts it, visible, with the spec's name;
 *   · every ⇢ fold is a tombstone forwarding to its destination (never deleted), every ⛔ is hidden, every folded
 *     category is hidden (never deleted);
 *   · applying the migration a SECOND time changes nothing (it is re-applied by `db push --include-all`).
 *
 * The code-side copy is `lib/t1-taxonomy-is-the-spec.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

type Service = { key: string; label: string; setnayan?: boolean };
type Category = { id: string; label: string; folds?: string[]; hidden_unchanged?: boolean; visible?: boolean; services: Service[] };
type Group = { id: string; label: string; short: string; categories: Category[] };
type Target = { groups: Group[]; merges: { from: string; into: string }[]; hide: string[]; hide_categories: string[] };

const ROOT = path.resolve(__dirname, '../../../..');
const target = JSON.parse(
  readFileSync(path.join(ROOT, 'supabase/data/taxonomy-ph-2026-11-07.json'), 'utf8'),
) as Target;
const MIGRATION = path.join(ROOT, 'supabase/migrations/20271349743729_t1_philippine_taxonomy.sql');

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

type CatRow = { id: string; parent_id: string | null; tier: number; label_en: string; label_short: string | null; marketplace_hidden: boolean };
type SvcRow = { canonical_service: string; folder_id: string; tile_id: string; marketplace_hidden: boolean; merged_into: string | null; display_name_en: string | null };

async function read() {
  const cats = (await db.query<CatRow>(`SELECT id, parent_id, tier, label_en, label_short, marketplace_hidden FROM public.service_categories`)).rows;
  const svcs = (await db.query<SvcRow>(
    `SELECT t.canonical_service, t.folder_id, t.tile_id, t.marketplace_hidden, t.merged_into, s.display_name_en
       FROM public.canonical_service_taxonomy t LEFT JOIN public.canonical_service_schemas s USING (canonical_service)`,
  )).rows;
  return { cat: new Map(cats.map((c) => [c.id, c])), svc: new Map(svcs.map((s) => [s.canonical_service, s])) };
}

test('every group and category is where the spec puts it, named as the spec names it', async () => {
  const { cat } = await read();
  for (const g of target.groups) {
    const row = cat.get(g.id);
    assert.ok(row && row.tier === 1, `group ${g.id} missing`);
    assert.equal(row!.label_en, g.label, `group ${g.id}`);
    assert.equal(row!.label_short, g.short, `group ${g.id} short`);
    assert.equal(row!.marketplace_hidden, false, `group ${g.id} hidden`);
    for (const c of g.categories) {
      const cr = cat.get(c.id);
      assert.ok(cr && cr.tier === 2, `category ${c.id} missing`);
      assert.equal(cr!.parent_id, g.id, `category ${c.id} group`);
      assert.equal(cr!.label_en, c.label, `category ${c.id} name`);
      if (!c.hidden_unchanged) assert.equal(cr!.marketplace_hidden, false, `category ${c.id} must be visible`);
      for (const f of c.folds ?? []) {
        assert.ok(cat.has(f), `folded category ${f} must be KEPT, not deleted`);
        assert.equal(cat.get(f)!.marketplace_hidden, true, `folded category ${f} must be hidden`);
      }
    }
  }
  for (const h of target.hide_categories) assert.equal(cat.get(h)?.marketplace_hidden, true, `${h} hidden`);
});

test('every service is on its category, visible, with the spec’s name', async () => {
  const { svc } = await read();
  const wrong: string[] = [];
  for (const g of target.groups) {
    for (const c of g.categories) {
      for (const s of c.services) {
        const r = svc.get(s.key);
        if (!r) { wrong.push(`${s.key}: missing`); continue; }
        if (r.tile_id !== c.id || r.folder_id !== g.id) wrong.push(`${s.key}: on ${r.folder_id}/${r.tile_id}, spec ${g.id}/${c.id}`);
        if (r.merged_into) wrong.push(`${s.key}: merged into ${r.merged_into}`);
        if (!s.setnayan && r.marketplace_hidden) wrong.push(`${s.key}: hidden`);
        if (!s.setnayan && r.display_name_en !== s.label) wrong.push(`${s.key}: named "${r.display_name_en}", spec "${s.label}"`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});

test('every ⇢ fold forwards to its destination and is kept; every ⛔ is hidden and kept', async () => {
  const { svc } = await read();
  for (const m of target.merges) {
    const r = svc.get(m.from);
    if (!r) continue; // a key only some databases ever had (prod admin additions) — nothing to fold here
    assert.equal(r.merged_into, m.into, `${m.from} must forward to ${m.into}`);
    assert.equal(r.marketplace_hidden, true, `${m.from} must be hidden`);
  }
  for (const k of target.hide) {
    assert.ok(svc.has(k), `${k} must be kept`);
    assert.equal(svc.get(k)!.marketplace_hidden, true, `${k} must be hidden`);
  }
});

test('no visible service sits outside the spec', async () => {
  const { svc } = await read();
  const listed = new Set(target.groups.flatMap((g) => g.categories.flatMap((c) => c.services.map((s) => s.key))));
  const leftAlone = new Set(target.groups.flatMap((g) => g.categories.filter((c) => c.services.length === 0).map((c) => c.id)));
  const stray = [...svc.values()]
    .filter((r) => !r.marketplace_hidden && !r.merged_into && !listed.has(r.canonical_service) && !leftAlone.has(r.tile_id))
    .map((r) => `${r.canonical_service} (${r.tile_id})`);
  assert.deepEqual(stray, []);
});

test('applying the migration a second time changes nothing', async () => {
  const snap = async () =>
    JSON.stringify([
      (await db.query(`SELECT id, parent_id, label_en, label_short, sort_order, marketplace_hidden, applicable_event_types
                         FROM public.service_categories ORDER BY id`)).rows,
      (await db.query(`SELECT t.canonical_service, t.folder_id, t.tile_id, t.marketplace_hidden, t.merged_into, t.sort_order,
                              t.applicable_event_types, s.display_name_en
                         FROM public.canonical_service_taxonomy t LEFT JOIN public.canonical_service_schemas s USING (canonical_service)
                        ORDER BY 1`)).rows,
    ]);
  const before1 = await snap();
  await db.exec(readFileSync(MIGRATION, 'utf8'));
  assert.equal(await snap(), before1);
});
