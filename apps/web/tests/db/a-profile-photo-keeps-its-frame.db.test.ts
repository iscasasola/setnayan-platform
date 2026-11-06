/**
 * A PROFILE PICTURE KEEPS ITS FRAME — migration 20271319958455. ⚖ Owner 2026-11-06, asked whether a person's
 * profile picture gets the business logo's frame: "yes, use the same control"; 7 Nov: drag + pinch.
 *
 * Proves on the replayed schema, not by reading the SQL:
 *   1. the three columns exist on `users` and refuse anything outside the SAME ranges as the logo's three
 *      (x / y 0–100 · zoom 100–300) — `lib/picture-frame.ts`'s bounds, read here, never retyped; the keypad pair
 *      the first cut stored (`profile_photo_focal` / `profile_photo_zoom`) is gone;
 *   2. the person can read AND write their own frame (`user_owns_row`, through `users`' table-level grants), so the
 *      profile save never refuses the whole update over the three new columns;
 *   3. anon reaches NO row of `users` — the table-level anon SELECT this column inherits (a column REVOKE cannot
 *      subtract from a table grant) admits nothing, because `users` has no policy for anon.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { PICTURE_ZOOM_MAX, PICTURE_ZOOM_MIN } from '../../lib/picture-frame';

const COLS = ['profile_focal_x', 'profile_focal_y', 'profile_zoom'] as const;

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
}, { timeout: 600000 });

after(async () => {
  await db?.close?.();
});

async function hasPriv(role: string, col: string, priv: 'SELECT' | 'UPDATE'): Promise<boolean> {
  const r = (await db.query(`SELECT has_column_privilege($1, 'public.users', $2, $3) AS ok`, [role, col, priv])) as {
    rows: { ok: boolean }[];
  };
  return r.rows[0]!.ok;
}

/** Does the column's CHECK accept this value? Asked of the constraint itself. */
async function accepts(col: (typeof COLS)[number], value: number | null): Promise<boolean> {
  const cons = (await db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass AND conname = $1`,
    [`users_${col}_chk`],
  )) as { rows: { def: string }[] };
  const def = cons.rows[0]?.def;
  assert.ok(def, `no CHECK on users.${col}`);
  const expr = def.replace(/^CHECK\s*/, '').replaceAll(col, value === null ? 'NULL::smallint' : `${value}::smallint`);
  const r = (await db.query(`SELECT COALESCE(${expr}, true) AS ok`)) as { rows: { ok: boolean }[] };
  return r.rows[0]!.ok;
}

test('the three columns exist on users, as SMALLINT — and the keypad pair is gone', async () => {
  const r = (await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('profile_focal_x', 'profile_focal_y', 'profile_zoom', 'profile_photo_focal', 'profile_photo_zoom')
      ORDER BY column_name`,
  )) as { rows: { column_name: string; data_type: string }[] };
  assert.deepEqual(
    r.rows.map((x) => `${x.column_name}:${x.data_type}`),
    ['profile_focal_x:smallint', 'profile_focal_y:smallint', 'profile_zoom:smallint'],
  );
});

test('the CHECKs are the logo’s ranges — and NULL (the default frame) passes', async () => {
  for (const col of ['profile_focal_x', 'profile_focal_y'] as const) {
    for (const v of [0, 1, 50, 99, 100]) assert.equal(await accepts(col, v), true, `${col} ${v}`);
    for (const bad of [-1, 101, 300]) assert.equal(await accepts(col, bad), false, `${col} ${bad} must be refused`);
    assert.equal(await accepts(col, null), true);
  }
  for (const z of [PICTURE_ZOOM_MIN, 150, 299, PICTURE_ZOOM_MAX]) assert.equal(await accepts('profile_zoom', z), true, `zoom ${z}`);
  for (const bad of [0, PICTURE_ZOOM_MIN - 1, PICTURE_ZOOM_MAX + 1]) {
    assert.equal(await accepts('profile_zoom', bad), false, `zoom ${bad} must be refused`);
  }
  assert.equal(await accepts('profile_zoom', null), true);
});

test('a signed-in person may read and write the frame (the profile save writes it with the photo)', async () => {
  for (const col of COLS) {
    assert.equal(await hasPriv('authenticated', col, 'SELECT'), true, `authenticated cannot select ${col}`);
    assert.equal(await hasPriv('authenticated', col, 'UPDATE'), true, `authenticated cannot update ${col}`);
  }
  await db.exec('SET ROLE authenticated');
  try {
    await db.query('SELECT user_id, profile_photo_url, profile_focal_x, profile_focal_y, profile_zoom FROM public.users LIMIT 1');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
  }
});

test('anon reaches no users row — the inherited table grant admits nothing', async () => {
  const r = (await db.query(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'users'
        AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])`,
  )) as { rows: { n: number }[] };
  assert.equal(r.rows[0]!.n, 0, 'a policy now admits anon to users rows — the frame columns are no longer row-hidden');
  const rls = (await db.query(`SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.users'::regclass`)) as {
    rows: { on: boolean }[];
  };
  assert.equal(rls.rows[0]!.on, true, 'RLS is off on users');
});
