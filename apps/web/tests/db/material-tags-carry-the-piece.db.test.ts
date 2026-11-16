/**
 * 🏷 MATERIAL TAGS CARRY THE PIECE — the schema half (migration 20271349425906, owner 2026-11-16 b8d39503).
 *
 *   · the four `via` columns take only the ten words (lib/material-tags.ts MATERIAL_VIAS) — a typo is refused, not kept
 *   · every new column is nullable with no default: adding it wrote nothing into an existing row
 *   · `signup_attributions` is closed to anon and never written by a browser (RLS on, grants revoked); a signed-in
 *     person reads only their OWN row (RA 10173 export); the service role writes it; one row per user; it dies with
 *     the user and with the shop
 *
 * SABOTAGE (each run once, reverted): drop the `REVOKE ALL … FROM anon, authenticated` line → the "closed" test goes
 * RED; widen the own-row policy to `USING (true)` → the "ONLY their own row" test goes RED; drop the two `GRANT SELECT (…)` lines → the "readable" test goes RED (and the migration's own post-condition).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid } from './replay-migrations';
import { MATERIAL_VIAS } from '../../lib/material-tags';

let db: PGlite;
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await db?.close();
});

async function asRoot(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
}

async function newUser(): Promise<string> {
  await asRoot();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`tags-${++n}@material-tags.test`],
  );
  return r.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const owner = await newUser();
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[]) RETURNING vendor_profile_id`,
    [owner, `Tag Shop ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

test('every new column is nullable with no default — nothing was written into an existing row', async () => {
  await asRoot();
  const r = await db.query<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null }>(
    `SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'vendor_profile_views' AND column_name = 'via')
          OR (table_name = 'chat_threads' AND column_name IN ('inquiry_via', 'inquiry_utm'))
          OR (table_name = 'event_vendors' AND column_name IN ('source_via', 'source_utm')))`,
  );
  assert.equal(r.rows.length, 5);
  for (const c of r.rows) {
    assert.equal(c.is_nullable, 'YES', `${c.table_name}.${c.column_name}`);
    assert.equal(c.column_default, null, `${c.table_name}.${c.column_name} must not default anything onto old rows`);
  }
});

test('the new thread and booking columns are READABLE like their siblings — or every select naming them is refused', async () => {
  await asRoot();
  for (const [table, col] of [
    ['chat_threads', 'inquiry_via'],
    ['chat_threads', 'inquiry_utm'],
    ['event_vendors', 'source_via'],
    ['event_vendors', 'source_utm'],
  ] as const) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_column_privilege($1, $2, $3, 'SELECT') AS ok`, [role, `public.${table}`, col]);
      assert.equal(r.rows[0]!.ok, true, `${role} cannot read ${table}.${col}`);
    }
  }
});

test('a view takes each of the ten pieces and refuses anything else', async () => {
  const shop = await newShop();
  await asRoot();
  for (const via of MATERIAL_VIAS) {
    await db.query(`INSERT INTO public.vendor_profile_views (vendor_profile_id, source, via) VALUES ($1, 'own', $2)`, [shop, via]);
  }
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_profile_views (vendor_profile_id, source, via) VALUES ($1, 'own', 'flyer')`, [shop]),
    /check/i,
  );
});

test('signup_attributions: closed to anon, never written by a browser, and a person reads ONLY their own row', async () => {
  await asRoot();
  const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_attributions'::regclass`);
  assert.equal(rls.rows[0]!.relrowsecurity, true);
  const can = async (role: string, priv: string) =>
    (await db.query<{ ok: boolean }>(`SELECT has_table_privilege($1, 'public.signup_attributions', $2) AS ok`, [role, priv])).rows[0]!.ok;
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal(await can('anon', priv), false, `anon must not ${priv}`);
  for (const priv of ['INSERT', 'UPDATE', 'DELETE']) assert.equal(await can('authenticated', priv), false, `authenticated must not ${priv}`);
  const shop = await newShop();
  const me = await newUser();
  const other = await newUser();
  await db.query(`INSERT INTO public.signup_attributions (user_id, vendor_profile_id, via) VALUES ($1, $3, 'card'), ($2, $3, 'tarp')`, [me, other, shop]);
  await setAuthUid(db, me);
  await db.exec('SET ROLE authenticated');
  const seen = await db.query<{ via: string }>(`SELECT via FROM public.signup_attributions`);
  assert.deepEqual(seen.rows.map((r) => r.via), ['card'], 'a person sees their own row and nobody else’s');
  await assert.rejects(db.query(`UPDATE public.signup_attributions SET via = 'photo' WHERE user_id = $1`, [me]), /permission denied/i);
  await asRoot();
});

test('the service role writes one row per user; a tagless row is refused; it dies with the user and the shop', async () => {
  const shop = await newShop();
  const user = await newUser();
  await db.exec('SET ROLE service_role');
  await db.query(`INSERT INTO public.signup_attributions (user_id, vendor_profile_id, via, src) VALUES ($1, $2, 'card', 'own')`, [user, shop]);
  await db.query(
    `INSERT INTO public.signup_attributions (user_id, vendor_profile_id, via) VALUES ($1, $2, 'tarp') ON CONFLICT (user_id) DO NOTHING`,
    [user, shop],
  );
  const kept = await db.query<{ via: string }>(`SELECT via FROM public.signup_attributions WHERE user_id = $1`, [user]);
  assert.deepEqual(kept.rows.map((r) => r.via), ['card'], 'the first piece wins');
  const other = await newUser();
  await db.exec('SET ROLE service_role');
  await assert.rejects(
    db.query(`INSERT INTO public.signup_attributions (user_id, vendor_profile_id) VALUES ($1, $2)`, [other, shop]),
    /check/i,
    'a row that names no piece and no campaign says nothing',
  );
  await asRoot();
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [user]);
  const gone = await db.query(`SELECT 1 FROM public.signup_attributions WHERE user_id = $1`, [user]);
  assert.equal(gone.rows.length, 0, 'a closed account takes its row with it');
});
