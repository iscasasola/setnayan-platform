/**
 * BUILD T1 — THE SHIPPED TAXONOMY IS THE OWNER-APPROVED PHILIPPINE ONE (2026-11-16).
 *
 * Owner, 2026-11-16, on the live app: "this is not my taxonomy". The approved tree is corpus
 * `TAXONOMY_PH_FULL_2026-11-07.md` ("the ONE spec for build T1"), transcribed — with stable slugs — into
 * `supabase/data/taxonomy-ph-2026-11-07.json`. This file pins the three code-side copies to that transcription:
 *
 *   1. the migration that writes it (`20271349743729_t1_philippine_taxonomy.sql`) embeds EXACTLY that JSON;
 *   2. the code fallback (`lib/taxonomy.ts` — what every screen shows when the DB read fails) puts every group,
 *      category and service where the spec does, with the spec's names;
 *   3. the module-load service names (`lib/taxonomy-service-names.ts`) say the spec's words.
 *
 * The database side is `tests/db/t1-taxonomy-is-the-spec.db.test.ts`.
 *
 * ⚠ IF THIS FAILS, DO NOT EDIT THE EXPECTED SIDE TO GO GREEN. The JSON is the owner's tree. Change the code copy
 * (and the migration, through a NEW migration) to match it — or change the JSON only with an owner ruling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ADMIN_ONLY_TILES,
  TAXONOMY_MAP,
  TILE_PARENT,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_TILE_LABEL,
  type WeddingTile,
} from './taxonomy';
import { SERVICE_NAME_PH } from './taxonomy-service-names';
import { taxonomyLabel } from './marketplace-category-options';

type Service = { key: string; label: string; new?: boolean; setnayan?: boolean };
type Category = { id: string; label: string; folds?: string[]; hidden_unchanged?: boolean; services: Service[] };
type Group = { id: string; label: string; short: string; unchanged?: boolean; categories: Category[] };
type Target = { groups: Group[]; merges: { from: string; into: string }[]; hide: string[]; hide_categories: string[] };

const ROOT = path.resolve(__dirname, '../../..');
const JSON_PATH = path.join(ROOT, 'supabase/data/taxonomy-ph-2026-11-07.json');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20271349743729_t1_philippine_taxonomy.sql');
const target = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Target;

const services = target.groups.flatMap((g) => g.categories.flatMap((c) => c.services.map((s) => ({ g, c, s }))));

test('the migration embeds exactly the target JSON', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const m = sql.match(/\$target\$([\s\S]*?)\$target\$/);
  assert.ok(m, 'no $target$ literal in the migration');
  assert.deepEqual(JSON.parse(m![1]!), target, 'the migration and supabase/data/taxonomy-ph-2026-11-07.json disagree');
});

test('every group of the spec is a folder in code, with the spec’s name, in order', () => {
  for (const g of target.groups) {
    assert.ok((WEDDING_FOLDER_ORDER as readonly string[]).includes(g.id), `group ${g.id} is not a folder in code`);
    assert.equal(WEDDING_FOLDER_LABEL[g.id as keyof typeof WEDDING_FOLDER_LABEL], g.label, `group ${g.id} name`);
    assert.equal(WEDDING_FOLDER_SHORT_LABEL[g.id as keyof typeof WEDDING_FOLDER_SHORT_LABEL], g.short, `group ${g.id} short name`);
  }
  const order = WEDDING_FOLDER_ORDER as readonly string[];
  assert.equal(order.indexOf('gifts'), order.indexOf('prints') + 1, 'Gifts sits right after Invitations & Prints');
});

test('every category of the spec is in its group with the spec’s name', () => {
  for (const g of target.groups) {
    for (const c of g.categories) {
      const t = c.id as WeddingTile;
      assert.equal(TILE_PARENT[t], g.id, `category ${c.id} is not under ${g.id}`);
      assert.equal(WEDDING_TILE_LABEL[t], c.label, `category ${c.id} name`);
      for (const f of c.folds ?? []) {
        assert.ok(ADMIN_ONLY_TILES.has(f as WeddingTile), `folded category ${f} must be hidden in the fallback`);
      }
    }
  }
  for (const h of target.hide_categories) assert.ok(ADMIN_ONLY_TILES.has(h as WeddingTile), `${h} must be hidden`);
  assert.ok(!ADMIN_ONLY_TILES.has('officiants'), 'officiants is shown again (house blessing, mass / novena)');
});

test('every service of the spec sits on its category, in its group, visible', () => {
  for (const { g, c, s } of services) {
    const e = TAXONOMY_MAP[s.key];
    assert.ok(e, `service ${s.key} (${s.label}) is missing from TAXONOMY_MAP`);
    assert.equal(e!.tile, c.id, `service ${s.key} category`);
    assert.equal(e!.folder, g.id, `service ${s.key} group`);
    if (!s.setnayan) assert.ok(!e!.marketplaceHidden, `service ${s.key} must be visible`);
  }
});

test('no visible service in code is outside the spec (except groups/categories the spec leaves unchanged)', () => {
  const listed = new Set(services.map(({ s }) => s.key));
  const unchangedTiles = new Set(
    target.groups.flatMap((g) => g.categories.filter((c) => c.services.length === 0).map((c) => c.id)),
  );
  const stray = Object.entries(TAXONOMY_MAP)
    .filter(([k, e]) => !e.marketplaceHidden && !listed.has(k) && !unchangedTiles.has(e.tile ?? ''))
    .map(([k, e]) => `${k} (${e.tile})`);
  assert.deepEqual(stray, [], 'visible services the spec does not place');
});

test('every ⇢ source and ⛔ service is hidden in code (the row is kept)', () => {
  for (const m of target.merges) {
    const e = TAXONOMY_MAP[m.from];
    if (e) assert.ok(e.marketplaceHidden, `${m.from} folds into ${m.into} and must be hidden`);
    assert.ok(TAXONOMY_MAP[m.into], `merge destination ${m.into} must exist`);
  }
  for (const k of target.hide) assert.ok(TAXONOMY_MAP[k]?.marketplaceHidden, `${k} is ⛔ and must be hidden`);
});

test('the module-load service names are the spec’s words', () => {
  const want = Object.fromEntries(services.filter(({ s }) => !s.setnayan).map(({ s }) => [s.key, s.label]));
  assert.deepEqual({ ...SERVICE_NAME_PH }, want);
  assert.equal(taxonomyLabel('pre_nup_photographer'), 'Prenup shoot');
  assert.equal(taxonomyLabel('same_day_edit'), 'SDE');
});

test('all twenty ✚ additions the owner approved on 7 Nov are in the tree', () => {
  // DECISION_LOG 2026-11-07 "ALL ✚ TAXONOMY AND EVENT ADDITIONS APPROVED" — the 20-item list, verbatim order.
  const approved = [
    'Franchise food carts', 'Lounge set rental', 'Baptismal gown / baby barong', 'Christening package', 'Loot bags',
    'Tarpaulin & standee', 'Fast-food party package', "Kids' party host", 'Balloon decor', 'Videoke rental',
    'Proposal setup', 'Stage & truss', 'Event staff & ushers', 'Security guards', 'Packed meals', 'Ribbon-cutting set',
    'House blessing', 'Wake catering', 'Memorial prints / prayer cards', 'Mass / novena scheduling',
  ];
  const names = new Set(services.map(({ s }) => s.label));
  for (const n of approved) assert.ok(names.has(n), `approved addition "${n}" is missing`);
});

test('the old US-directory names are gone from the code copy', () => {
  const shown = [
    ...Object.values(WEDDING_FOLDER_LABEL),
    ...Object.entries(WEDDING_TILE_LABEL).filter(([t]) => !ADMIN_ONLY_TILES.has(t as WeddingTile)).map(([, l]) => l),
    ...Object.values(SERVICE_NAME_PH),
  ];
  for (const old of ['Venues & churches', 'Same-Day Edit Specialist', 'Pre-Nup Photographer', 'Boudoir Photographer']) {
    assert.ok(!shown.includes(old), `"${old}" is still shown`);
  }
});
