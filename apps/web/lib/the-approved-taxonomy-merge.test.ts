/**
 * THE MIGRATION IS THE APPROVED MAP — byte for byte, row for row.
 *
 * Migration 20271320461004 carries a compacted copy of
 * supabase/data/taxonomy-merge-2026-11-06.json (the map the owner approved on
 * 2026-11-06). This guard fails if the two ever disagree — a row dropped, a
 * destination changed, a Setnayan product un-flagged — so the copy can never
 * quietly become a different decision from the one that was approved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sql = fs.readFileSync(
  path.join(REPO, 'supabase/migrations/20271320461004_apply_the_approved_taxonomy_merge_2026_11_06.sql'),
  'utf8',
);
type Row = {
  from_slug: string;
  into_slug: string;
  into_name: string;
  filter: { name: string; value: string } | null;
  from_category: string;
  into_category: string;
  setnayan_product: boolean;
};
const map = JSON.parse(
  fs.readFileSync(path.join(REPO, 'supabase/data/taxonomy-merge-2026-11-06.json'), 'utf8'),
) as Row[];

function literal(name: string): unknown {
  const m = sql.match(new RegExp(`${name}\\s+JSONB\\s*:=\\s*\\$map\\$([\\s\\S]*?)\\$map\\$`));
  assert.ok(m, `${name} literal must be present`);
  return JSON.parse(m![1]!);
}

test('every approved row is in the migration, unchanged', () => {
  const rows = literal('v_rows') as {
    f: string; i: string; n: string; fn: string | null; fv: string | null; fc: string; ic: string; s: boolean;
  }[];
  assert.equal(rows.length, map.length);
  const key = (f: string, i: string) => `${f}→${i}`;
  const got = new Map(rows.map((r) => [key(r.f, r.i), r]));
  for (const r of map) {
    const g = got.get(key(r.from_slug, r.into_slug));
    assert.ok(g, `missing ${key(r.from_slug, r.into_slug)}`);
    assert.equal(g!.n, r.into_name);
    assert.equal(g!.fn, r.filter?.name ?? null);
    assert.equal(g!.fv, r.filter?.value ?? null);
    assert.equal(g!.fc, r.from_category);
    assert.equal(g!.ic, r.into_category);
    assert.equal(g!.s, r.setnayan_product, `${r.from_slug}: Setnayan flag must match`);
  }
});

test('a Setnayan product is never folded into another trade', () => {
  for (const r of map.filter((x) => x.setnayan_product)) {
    assert.equal(r.from_slug, r.into_slug, `${r.from_slug} is a Setnayan product`);
  }
  assert.match(sql, /CONTINUE WHEN \(r->>'s'\)::boolean;/);
});

test('survivor self-rows run before any merge (the pre-Cana / Muslim order case)', () => {
  const rows = literal('v_rows') as { f: string; i: string }[];
  const firstMerge = rows.findIndex((r) => r.f !== r.i);
  const lastSelf = rows.map((r) => r.f === r.i).lastIndexOf(true);
  assert.ok(lastSelf < firstMerge, 'every f = i row must precede the first f ≠ i row');
});

test('every category merge lands on a surviving category, never on one that also disappears', () => {
  const tiles = literal('v_tiles') as { s: string; d: string }[];
  const survivors = new Set(map.map((r) => r.into_category));
  for (const t of tiles) {
    assert.ok(survivors.has(t.d), `${t.s} → ${t.d}: destination must survive`);
    assert.ok(!survivors.has(t.s), `${t.s} survives — it must not also be merged`);
  }
});
