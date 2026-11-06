/**
 * A SHOP LOGO KEEPS ITS FRAME — migration 20271316444107 (owner, the 2026-11-06 /open-shop gate walk: logo "zoom and
 * align"; reshaped 7 Nov, prototype v21, A3: drag + pinch — x / y 0–100, zoom 100–300, `lib/picture-frame.ts`).
 *
 * Proves on the replayed schema, not by reading the SQL:
 *   1. the three columns exist and refuse anything outside the ranges the reader accepts — the SAME bounds
 *      `lib/picture-frame.ts` exports, read here, never retyped;
 *   2. a signed-in person can SELECT them (column-scoped since 20271217955839 — a column born unreadable refuses
 *      the whole PostgREST query), anon cannot;
 *   3. the shop's own definer view `vendor_profiles_self` projects them (the logo screen reads through it);
 *   4. the keypad's column (`logo_focal`, 1–9) does not exist — it was reshaped before it ever shipped.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { PICTURE_ZOOM_MAX, PICTURE_ZOOM_MIN } from '../../lib/picture-frame';
import { LOGO_FRAME_INPUTS } from '../../lib/open-shop-logo';

let replay: ReplayResult;
let db: PGlite;

const COLS = [LOGO_FRAME_INPUTS.x, LOGO_FRAME_INPUTS.y, LOGO_FRAME_INPUTS.zoom] as const;

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
async function accepts(col: (typeof COLS)[number], value: number | null): Promise<boolean> {
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

test('the three frame columns exist on vendor_profiles — and the keypad column does not', async () => {
  const r = (await db.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
        AND column_name IN ('logo_focal', 'logo_focal_x', 'logo_focal_y', 'logo_zoom')
      ORDER BY column_name`,
  )) as { rows: { column_name: string }[] };
  assert.deepEqual(r.rows.map((x) => x.column_name), ['logo_focal_x', 'logo_focal_y', 'logo_zoom']);
});

test('the CHECKs are exactly the ranges the reader accepts — and NULL (the default frame) passes', async () => {
  for (const col of [LOGO_FRAME_INPUTS.x, LOGO_FRAME_INPUTS.y] as const) {
    for (const ok of [0, 1, 50, 99, 100]) assert.equal(await accepts(col, ok), true, `${col} ${ok}`);
    for (const bad of [-1, 101, 300]) assert.equal(await accepts(col, bad), false, `${col} ${bad} must be refused`);
    assert.equal(await accepts(col, null), true);
  }
  const z = LOGO_FRAME_INPUTS.zoom;
  for (const ok of [PICTURE_ZOOM_MIN, 120, 187, PICTURE_ZOOM_MAX]) assert.equal(await accepts(z, ok), true, `zoom ${ok}`);
  for (const bad of [0, PICTURE_ZOOM_MIN - 1, PICTURE_ZOOM_MAX + 1]) {
    assert.equal(await accepts(z, bad), false, `zoom ${bad} must be refused`);
  }
  assert.equal(await accepts(z, null), true);
});

test('a signed-in person may read the frame; anon may not', async () => {
  for (const col of COLS) {
    assert.equal(await hasPriv('authenticated', col), true, `authenticated cannot select ${col}`);
    assert.equal(await hasPriv('anon', col), false, `anon can select ${col}`);
  }
  // Proved by selecting, not only by asking the catalogue.
  await db.exec('SET ROLE authenticated');
  try {
    await db.query(`SELECT vendor_profile_id, logo_url, ${COLS.join(', ')} FROM public.vendor_profiles LIMIT 1`);
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
  }
});

test('the shop’s own view projects the frame', async () => {
  const r = (await db.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles_self' AND column_name = ANY($1::text[])`,
    [COLS as unknown as string[]],
  )) as { rows: { column_name: string }[] };
  assert.equal(r.rows.length, 3, 'vendor_profiles_self was not rebuilt with the new columns');
});
