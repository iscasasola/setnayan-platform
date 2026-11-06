/**
 * THE MIGRATION IS THE APPROVED TAXONOMY — v2, value for value.
 *
 * Migration 20271320461004 carries a compacted copy of the two approved
 * sources: supabase/data/taxonomy-v2-2026-11-06.json (the target, owner-approved
 * 6 Nov, DECISION_LOG "TAXONOMY V2 APPROVED") and the merge map it builds on.
 * This guard fails if the copy ever disagrees with them — a live key placed
 * elsewhere, a service renamed, a category moved, a specialty value or its
 * event scope dropped, a Setnayan product folded — so the migration can never
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
type Value = { v: string; event_types: string[] };
type Specialty = { label: string; question: string; values: Value[] };
type Service = { key: string; label: string; status: string; event_types: string[]; specialties: Specialty[] };
type V2 = {
  groups: { label: string; categories: { label: string; tile: string; services: Service[] }[] }[];
  not_in_picker: { key: string; why: string }[];
  live_key_map: Record<string, { service: string; as: string; specialty?: string; value?: string; status: string }>;
};
const v2 = JSON.parse(
  fs.readFileSync(path.join(REPO, 'supabase/data/taxonomy-v2-2026-11-06.json'), 'utf8'),
) as V2;
const map = JSON.parse(
  fs.readFileSync(path.join(REPO, 'supabase/data/taxonomy-merge-2026-11-06.json'), 'utf8'),
) as { from_slug: string; from_category: string; into_category: string }[];

function literal<T>(name: string): T {
  const m = sql.match(new RegExp(`${name}\\s+JSONB\\s*:=\\s*\\$map\\$([\\s\\S]*?)\\$map\\$`));
  assert.ok(m, `${name} literal must be present`);
  return JSON.parse(m![1]!) as T;
}
type Row = { f: string; i: string; fn: string | null; fv: string | null; fc: string; ic: string; s: boolean };
type SvcPayload = {
  k: string; n: string; t: string; e: string[] | null; new: boolean;
  sp: { k: string; l: string; q: string | null; b: boolean; v: { v: string; e: string[] | null }[] }[];
};
const rows = literal<Row[]>('v_rows');
const services = literal<SvcPayload[]>('v_services');
const cats = v2.groups.flatMap((g) => g.categories);
const v2Services = cats.flatMap((c) => c.services.map((s) => ({ ...s, tile: c.tile })));

test('v2 itself: 39 categories, 84 services (16 new), 296 live keys', () => {
  assert.equal(cats.length, 39);
  assert.equal(v2Services.length, 84);
  assert.equal(v2Services.filter((s) => s.status === 'NEW').length, 16);
  assert.equal(Object.keys(v2.live_key_map).length, 296);
});

test('every live key is placed exactly where v2 places it', () => {
  assert.equal(rows.length, 296);
  const byKey = new Map(rows.map((r) => [r.f, r]));
  assert.equal(byKey.size, 296, 'each live key once');
  for (const [k, e] of Object.entries(v2.live_key_map)) {
    const r = byKey.get(k);
    assert.ok(r, `missing ${k}`);
    assert.equal(r!.i, e.service, `${k} → ${e.service}`);
    assert.equal(r!.s, e.status === 'setnayan product', `${k}: Setnayan flag`);
    if (e.as === 'specialty' && e.specialty !== 'Rental') assert.equal(r!.fv, e.value, `${k}: value`);
    if (e.as === 'service') assert.equal(r!.fn, null, `${k} carries no specialty`);
  }
});

test('every v2 service is in the migration with its category, name, events and every specialty value + scope', () => {
  const got = new Map(services.map((p) => [p.k, p]));
  for (const s of v2Services) {
    const p = got.get(s.key);
    assert.ok(p, `missing service ${s.key}`);
    assert.equal(p!.t, s.tile, `${s.key}: category`);
    assert.equal(p!.n, s.label, `${s.key}: name`);
    assert.deepEqual(p!.e, s.event_types, `${s.key}: event types`);
    assert.equal(p!.new, s.status === 'NEW', `${s.key}: new`);
    assert.deepEqual(p!.sp.map((x) => x.l), s.specialties.map((x) => x.label), `${s.key}: specialties`);
    s.specialties.forEach((sp, i) => {
      assert.deepEqual(
        p!.sp[i]!.v,
        sp.values.map((x) => ({ v: x.v, e: x.event_types })),
        `${s.key} › ${sp.label}: values and their event scope`,
      );
    });
  }
});

test('Tea ceremony master is its own service (the corrected merge), not a Host / emcee value', () => {
  const r = rows.find((x) => x.f === 'tea_ceremony_master')!;
  assert.equal(r.i, 'tea_ceremony_master');
  assert.equal(r.fn, null);
  assert.equal(services.find((p) => p.k === 'tea_ceremony_master')!.t, 'host_mc');
  const host = services.find((p) => p.k === 'host_emcee')!;
  assert.ok(!host.sp.some((sp) => sp.v.some((x) => /tea ceremony/i.test(x.v))));
});

test('a Setnayan product is never folded into another service', () => {
  for (const r of rows.filter((x) => x.s)) assert.equal(r.f, r.i, `${r.f} is a Setnayan product`);
  assert.match(sql, /CONTINUE WHEN \(r->>'s'\)::boolean;/);
});

test('survivor self-rows run before any merge (the pre-Cana / Muslim order case)', () => {
  const firstMerge = rows.findIndex((r) => r.f !== r.i);
  const lastSelf = rows.map((r) => r.f === r.i).lastIndexOf(true);
  assert.ok(lastSelf < firstMerge, 'every f = i row must precede the first f ≠ i row');
});

test('every category fold lands on a live v2 category, never on one that also folds', () => {
  const tiles = literal<{ s: string; d: string }[]>('v_tiles');
  const live = new Set([...cats.map((c) => c.tile), ...rows.map((r) => r.ic)]);
  for (const t of tiles) {
    assert.ok(live.has(t.d), `${t.s} → ${t.d}: destination must be live`);
    assert.ok(!live.has(t.s), `${t.s} is live — it must not also fold`);
  }
  // …and every category a live key sits in today either survives or folds.
  for (const r of map) {
    assert.ok(live.has(r.from_category) || tiles.some((t) => t.s === r.from_category), `${r.from_category} unaccounted`);
  }
});
