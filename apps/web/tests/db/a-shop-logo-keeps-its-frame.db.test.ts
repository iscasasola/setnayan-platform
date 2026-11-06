/**
 * A SHOP LOGO KEEPS ITS ALIGN + ZOOM — migration 20271316444107 (owner, the 2026-11-06 /open-shop gate walk, A2:
 * logo "zoom and align", the Event Hub Maker photo control reused).
 *
 * Proves on the replayed schema, not by reading the SQL:
 *   1. the two columns exist and refuse anything outside the Maker's closed sets (focal 1–9 · zoom 100/120/150) —
 *      the SAME sets `lib/hub-canvas.ts` exports, read here, never retyped;
 *   2. a signed-in person can SELECT them (column-scoped since 20271217955839 — a column born unreadable refuses
 *      the whole PostgREST query), anon cannot;
 *   3. the shop's own definer view `vendor_profiles_self` projects them (the logo screen reads through it).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { HUB_FOCAL_POINTS, HUB_ZOOMS } from '../../lib/hub-canvas';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
}, { timeout: 600000 });

after(async () => {
  await db?.close?.();
});

async function hasPriv(role: string, col: string): Promise<boolean> {
  const r = (await db.query(
    `SELECT has_column_privilege($1, 'public.vendor_profiles', $2, 'SELECT') AS ok`,
    [role, col],
  )) as { rows: { ok: boolean }[] };
  return r.rows[0]!.ok;
}

/** Does the column's CHECK accept this value? Asked of the constraint itself, inside a rolled-back statement. */
async function accepts(col: 'logo_focal' | 'logo_zoom', value: number | null): Promise<boolean> {
  const cons = (await db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.vendor_profiles'::regclass AND conname = $1`,
    [`vendor_profiles_${col}_chk`],
  )) as { rows: { def: string }[] };
  const def = cons.rows[0]?.def;
  assert.ok(def, `no CHECK on vendor_profiles.${col}`);
  const expr = def.replace(/^CHECK\s*/, '').replaceAll(col, value === null ? 'NULL::smallint' : `${value}::smallint`);
  const r = (await db.query(`SELECT COALESCE(${expr}, true) AS ok`)) as { rows: { ok: boolean }[] };
  return r.rows[0]!.ok;
}

test('both columns exist on vendor_profiles', async () => {
  const r = (await db.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles' AND column_name IN ('logo_focal', 'logo_zoom')
      ORDER BY column_name`,
  )) as { rows: { column_name: string }[] };
  assert.deepEqual(r.rows.map((x) => x.column_name), ['logo_focal', 'logo_zoom']);
});

test('the CHECKs are exactly the Maker’s closed sets — and NULL (the default frame) passes', async () => {
  for (const f of HUB_FOCAL_POINTS) assert.equal(await accepts('logo_focal', f), true, `focal ${f}`);
  for (const bad of [0, 10, -1]) assert.equal(await accepts('logo_focal', bad), false, `focal ${bad} must be refused`);
  for (const z of HUB_ZOOMS) assert.equal(await accepts('logo_zoom', z), true, `zoom ${z}`);
  for (const bad of [0, 99, 137, 200]) assert.equal(await accepts('logo_zoom', bad), false, `zoom ${bad} must be refused`);
  assert.equal(await accepts('logo_focal', null), true);
  assert.equal(await accepts('logo_zoom', null), true);
});

test('a signed-in person may read the frame; anon may not', async () => {
  for (const col of ['logo_focal', 'logo_zoom']) {
    assert.equal(await hasPriv('authenticated', col), true, `authenticated cannot select ${col}`);
    assert.equal(await hasPriv('anon', col), false, `anon can select ${col}`);
  }
  // Proved by selecting, not only by asking the catalogue.
  await db.exec('SET ROLE authenticated');
  try {
    await db.query('SELECT vendor_profile_id, logo_url, logo_focal, logo_zoom FROM public.vendor_profiles LIMIT 1');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
  }
});

test('the shop’s own view projects the frame', async () => {
  const r = (await db.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles_self' AND column_name IN ('logo_focal', 'logo_zoom')`,
  )) as { rows: { column_name: string }[] };
  assert.equal(r.rows.length, 2, 'vendor_profiles_self was not rebuilt with the new columns');
});
