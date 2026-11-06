/**
 * A PROFILE PICTURE KEEPS ITS ALIGN + ZOOM — migration 20271319958455. ⚖ Owner 2026-11-06, asked whether a person's
 * profile picture gets the business logo's align + zoom: "yes, use the same control".
 *
 * Proves on the replayed schema, not by reading the SQL:
 *   1. the two columns exist on `users` and refuse anything outside the SAME closed sets as the logo's pair
 *      (focal 1–9 · zoom 100/120/150) — `lib/hub-canvas.ts`'s sets, read here, never retyped;
 *   2. the person can read AND write their own frame (`user_owns_row`, through `users`' table-level grants), so the
 *      profile save never refuses the whole update over the two new columns;
 *   3. anon reaches NO row of `users` — the table-level anon SELECT this column inherits (a column REVOKE cannot
 *      subtract from a table grant) admits nothing, because `users` has no policy for anon.
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

async function hasPriv(role: string, col: string, priv: 'SELECT' | 'UPDATE'): Promise<boolean> {
  const r = (await db.query(`SELECT has_column_privilege($1, 'public.users', $2, $3) AS ok`, [role, col, priv])) as {
    rows: { ok: boolean }[];
  };
  return r.rows[0]!.ok;
}

/** Does the column's CHECK accept this value? Asked of the constraint itself. */
async function accepts(col: 'profile_photo_focal' | 'profile_photo_zoom', value: number | null): Promise<boolean> {
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

test('both columns exist on users, as SMALLINT', async () => {
  const r = (await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('profile_photo_focal', 'profile_photo_zoom')
      ORDER BY column_name`,
  )) as { rows: { column_name: string; data_type: string }[] };
  assert.deepEqual(
    r.rows.map((x) => `${x.column_name}:${x.data_type}`),
    ['profile_photo_focal:smallint', 'profile_photo_zoom:smallint'],
  );
});

test('the CHECKs are the logo’s closed sets — and NULL (the default frame) passes', async () => {
  for (const f of HUB_FOCAL_POINTS) assert.equal(await accepts('profile_photo_focal', f), true, `focal ${f}`);
  for (const bad of [0, 10, -1]) assert.equal(await accepts('profile_photo_focal', bad), false, `focal ${bad} must be refused`);
  for (const z of HUB_ZOOMS) assert.equal(await accepts('profile_photo_zoom', z), true, `zoom ${z}`);
  for (const bad of [0, 99, 137, 200]) assert.equal(await accepts('profile_photo_zoom', bad), false, `zoom ${bad} must be refused`);
  assert.equal(await accepts('profile_photo_focal', null), true);
  assert.equal(await accepts('profile_photo_zoom', null), true);
});

test('a signed-in person may read and write the frame (the profile save writes it with the photo)', async () => {
  for (const col of ['profile_photo_focal', 'profile_photo_zoom']) {
    assert.equal(await hasPriv('authenticated', col, 'SELECT'), true, `authenticated cannot select ${col}`);
    assert.equal(await hasPriv('authenticated', col, 'UPDATE'), true, `authenticated cannot update ${col}`);
  }
  await db.exec('SET ROLE authenticated');
  try {
    await db.query('SELECT user_id, profile_photo_url, profile_photo_focal, profile_photo_zoom FROM public.users LIMIT 1');
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
