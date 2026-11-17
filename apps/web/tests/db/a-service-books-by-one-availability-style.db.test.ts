/**
 * a-service-books-by-one-availability-style.db.test.ts — 🔒 every service carries ONE of seven Availability styles,
 * set on Admin › Categories by an admin only, and nothing is decided for the owner (Availability plan, step 2; the
 * seven owner-ruled 2026-11-17).
 *
 * Runs the REAL cores (`setAvailabilityStyleCore`, `setCategoryAvailabilityCore`, `addServiceCore`) against the
 * replayed schema through `supabase-over-pglite.ts`, and holds:
 *   1. the column exists, nullable, and EVERY service starts Not set (nothing is seeded — the per-category list is an
 *      unreviewed proposal);
 *   2. the column's CHECK refuses a value outside the seven, whoever writes it;
 *   3. the service core refuses a bad value AND a non-admin, saves one of the seven with an audit row, clears to NULL;
 *   4. a combined service is refused;
 *   5. the category core writes every live service of the category, and refuses Not set / a non-admin;
 *   6. a new service takes the picked Availability, or none.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import type { AdminDb } from '../../app/admin/categories/_components/taxonomy-writes';
import { AVAILABILITY_STYLES } from '../../lib/availability-styles';

type Writes = typeof import('../../app/admin/categories/_components/taxonomy-writes');
let W: Writes;
let db: PGlite;
let admin: AdminDb;
let ADMIN = '';
let CUSTOMER = '';
let SERVICE = '';
let TILE = '';

const newUser = async (email: string) =>
  (await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`, [email])).rows[0]!.id;

before(async () => {
  db = (await createReplayedDb()).db;
  admin = makeAdminClient(db) as unknown as AdminDb;
  ADMIN = await newUser('availability-admin@setnayan.test');
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [ADMIN]);
  CUSTOMER = await newUser('availability-customer@setnayan.test');
  // A category with at least two live services, and one of them.
  const row = (
    await db.query<{ tile: string; k: string }>(
      `SELECT tile_id AS tile, min(canonical_service) AS k FROM public.canonical_service_taxonomy
        WHERE merged_into IS NULL AND tile_id IS NOT NULL GROUP BY tile_id HAVING count(*) >= 2 ORDER BY tile_id LIMIT 1`,
    )
  ).rows[0]!;
  TILE = row.tile;
  SERVICE = row.k;
  W = await import('../../app/admin/categories/_components/taxonomy-writes');
});
after(async () => {
  await db?.close();
});

const styleOf = async (k: string) =>
  (await db.query<{ v: string | null }>(`SELECT availability_style AS v FROM public.canonical_service_taxonomy WHERE canonical_service = $1`, [k])).rows[0]?.v;

test('the column exists, nullable, and every service starts Not set — nothing is decided for the owner', async () => {
  const c = (
    await db.query<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'canonical_service_taxonomy' AND column_name = 'availability_style'`,
    )
  ).rows[0];
  assert.deepEqual(c, { is_nullable: 'YES', data_type: 'text' });
  const total = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.canonical_service_taxonomy`)).rows[0]!.n;
  assert.ok(total > 50, 'the service seed did not replay — nothing was checked');
  const set = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.canonical_service_taxonomy WHERE availability_style IS NOT NULL`)).rows[0]!.n;
  assert.equal(set, 0, 'a migration set Availability — the per-category list is unreviewed and must not be seeded');
});

test('the CHECK takes exactly the seven and refuses anything else', async () => {
  for (const s of AVAILABILITY_STYLES) {
    await db.query(`UPDATE public.canonical_service_taxonomy SET availability_style = $1 WHERE canonical_service = $2`, [s.value, SERVICE]);
  }
  for (const bad of ['', 'weekly', 'DAY']) {
    await assert.rejects(
      db.query(`UPDATE public.canonical_service_taxonomy SET availability_style = $1 WHERE canonical_service = $2`, [bad, SERVICE]),
      /canonical_service_taxonomy_availability_style_check/,
      `the column took “${bad}”`,
    );
  }
  await db.query(`UPDATE public.canonical_service_taxonomy SET availability_style = NULL WHERE canonical_service = $1`, [SERVICE]);
});

test('the service core refuses a non-admin and a value outside the seven', async () => {
  const notAdmin = await W.setAvailabilityStyleCore(admin, CUSTOMER, SERVICE, 'day');
  assert.equal(notAdmin.ok, false, 'a non-admin set Availability');
  const nobody = await W.setAvailabilityStyleCore(admin, '', SERVICE, 'day');
  assert.equal(nobody.ok, false);
  const bad = await W.setAvailabilityStyleCore(admin, ADMIN, SERVICE, 'weekly');
  assert.equal(bad.ok, false, 'a value outside the seven was accepted');
  assert.equal(await styleOf(SERVICE), null, 'a refused write landed');
});

test('an admin saves one of the seven (one audit row), and blank clears it back to Not set', async () => {
  /* 🧪 SABOTAGE TARGET: the core's update of canonical_service_taxonomy.availability_style. */
  const r = await W.setAvailabilityStyleCore(admin, ADMIN, SERVICE, 'hour');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.ok && r.previous, '');
  assert.equal(await styleOf(SERVICE), 'hour');
  const audits = (
    await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'taxonomy.set_availability_style' AND target_id = $1`, [SERVICE])
  ).rows[0]!.n;
  assert.equal(audits, 1);
  const again = await W.setAvailabilityStyleCore(admin, ADMIN, SERVICE, 'hour');
  assert.ok(again.ok && again.message === 'No change.');
  const cleared = await W.setAvailabilityStyleCore(admin, ADMIN, SERVICE, '');
  assert.ok(cleared.ok, JSON.stringify(cleared));
  assert.equal(await styleOf(SERVICE), null);
});

test('an unknown service and a combined one are refused', async () => {
  assert.equal((await W.setAvailabilityStyleCore(admin, ADMIN, 'no_such_service_av', 'day')).ok, false);
  const [{ k: from }, { k: into }] = (
    await db.query<{ k: string }>(
      `SELECT canonical_service AS k FROM public.canonical_service_taxonomy WHERE merged_into IS NULL AND tile_id <> $1 ORDER BY canonical_service LIMIT 2`,
      [TILE],
    )
  ).rows as [{ k: string }, { k: string }];
  await db.query(`UPDATE public.canonical_service_taxonomy SET merged_into = $1 WHERE canonical_service = $2`, [into, from]);
  assert.equal((await W.setAvailabilityStyleCore(admin, ADMIN, from, 'day')).ok, false);
  assert.equal(await styleOf(from), null);
});

test('a whole category is set in one action — every live service — and Not set / a non-admin are refused', async () => {
  assert.equal((await W.setCategoryAvailabilityCore(admin, CUSTOMER, TILE, 'piece')).ok, false, 'a non-admin set a whole category');
  assert.equal((await W.setCategoryAvailabilityCore(admin, ADMIN, TILE, '')).ok, false, 'Not set is not a bulk pick');
  assert.equal((await W.setCategoryAvailabilityCore(admin, ADMIN, TILE, 'weekly')).ok, false);
  const r = await W.setCategoryAvailabilityCore(admin, ADMIN, TILE, 'piece');
  assert.ok(r.ok, JSON.stringify(r));
  const left = (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.canonical_service_taxonomy WHERE tile_id = $1 AND merged_into IS NULL AND availability_style IS DISTINCT FROM 'piece'`,
      [TILE],
    )
  ).rows[0]!.n;
  assert.equal(left, 0, 'a service of the category was left out');
  // …and one service can then be changed on its own.
  assert.ok((await W.setAvailabilityStyleCore(admin, ADMIN, SERVICE, 'order')).ok);
  assert.equal(await styleOf(SERVICE), 'order');
});

test('a new service takes the picked Availability — or none — and refuses one outside the seven', async () => {
  const picked = await W.addServiceCore(admin, ADMIN, { tileId: TILE, label: 'Availability Probe One', availability: 'time' });
  assert.ok(picked.ok, JSON.stringify(picked));
  assert.equal(await styleOf(picked.ok ? picked.id! : ''), 'time');
  const none = await W.addServiceCore(admin, ADMIN, { tileId: TILE, label: 'Availability Probe Two' });
  assert.ok(none.ok, JSON.stringify(none));
  assert.equal(await styleOf(none.ok ? none.id! : ''), null, 'a new service was given a style nobody picked');
  const bad = await W.addServiceCore(admin, ADMIN, { tileId: TILE, label: 'Availability Probe Three', availability: 'weekly' });
  assert.equal(bad.ok, false);
});
