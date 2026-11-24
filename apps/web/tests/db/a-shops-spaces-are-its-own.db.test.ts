/**
 * A SHOP'S SPACES, AND THE TABLES IN THEM, ARE ITS OWN — executed against real Postgres
 * (migration 20271356372536_spaces_on_schedule_pools; specs `prototypes/spaces_final_screens_2026-11-19.html`,
 * DECISION_LOG 2026-11-19 "Spaces ARE vendor_schedule_pools rows plus a kind column").
 *
 * Shaped around REFUSALS — a test that only reads a hall back would pass against a table with no rules:
 *   · a booked-whole kind (hall, room, cart, vehicle, item) IS a hall to the booking path; a counted one is NOT;
 *   · a count belongs to a counted kind only, and "in repair" never exceeds it; a size is both sides or neither;
 *   · "Connects to" stays inside the shop and between halls and rooms;
 *   · a table or a door hangs only on the shop's own hall or room (never a cart, never another shop's hall);
 *   · ends are a Long table's alone; one table name per room;
 *   · a stranger reads no table; a viewer seat reads but cannot write; the 18 Nov floors table is gone.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<'owner' | 'viewer' | 'stranger' | 'shop' | 'other' | 'hall' | 'hall2' | 'cart' | 'otherHall', string>;

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
}
async function mkUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function mkShop(owner: string, name: string): Promise<string> {
  const v = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [owner, name],
    )
  ).rows[0]!.v;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [v, owner],
  );
  return v;
}
/** The error message of a statement that must fail ('' when it did not). */
async function refused(sql: string, params: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.owner = await mkUser('spaces-owner@units.test');
  F.viewer = await mkUser('spaces-viewer@units.test');
  F.stranger = await mkUser('spaces-stranger@units.test');
  F.shop = await mkShop(F.owner, 'Casa Lumen Hotel');
  F.other = await mkShop(F.stranger, 'Other Shop');
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'viewer')`, [F.shop, F.viewer]);
  const space = async (shop: string, kind: string, name: string, isHall: boolean): Promise<string> =>
    (
      await db.query<{ p: string }>(
        `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, calendar_name, pool_label, is_vendor_created, is_hall, space_kind)
         VALUES ($1, $2, $2, TRUE, $3, $4) RETURNING pool_id AS p`,
        [shop, name, isHall, kind],
      )
    ).rows[0]!.p;
  F.hall = await space(F.shop, 'hall', 'Hall001', true);
  F.hall2 = await space(F.shop, 'hall', 'Hall002', true);
  F.cart = await space(F.shop, 'cart', 'Cart001', true);
  F.otherHall = await space(F.other, 'hall', 'Hall001', true);
  await db.query(
    `INSERT INTO public.vendor_units (vendor_profile_id, pool_id, kind, name, table_shape, chairs, chairs_at_ends)
     VALUES ($1, $2, 'table', 'T1', 'long', 10, TRUE)`,
    [F.shop, F.hall],
  );
  await db.query(`INSERT INTO public.vendor_unit_doors (vendor_profile_id, pool_id, wall) VALUES ($1, $2, 'front')`, [F.shop, F.hall]);
});
after(async () => {
  await db?.close();
});

const pool = (kind: string, isHall: boolean, extra = '', vals: unknown[] = []) =>
  refused(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, calendar_name, is_hall, space_kind${extra ? ', ' + extra : ''})
     VALUES ($1, 'X', $2, $3${vals.map((_, i) => `, $${i + 4}`).join('')})`,
    [F.shop, isHall, kind, ...vals],
  );

test('a booked-whole kind is a hall to the booking path; a counted kind is not', async () => {
  for (const k of ['hall', 'room', 'cart', 'vehicle', 'item']) {
    assert.equal(await pool(k, true), '', `${k} as is_hall was refused`);
    assert.notEqual(await pool(k, false), '', `${k} was saved as a counted thing`);
  }
  for (const k of ['object', 'clothing']) {
    assert.equal(await pool(k, false, 'space_count', [200]), '', `${k} with a count was refused`);
    assert.notEqual(await pool(k, true, 'space_count', [200]), '', `${k} was saved as one booking a day`);
  }
  assert.notEqual(await pool('boat', true), '', 'a seventh kind was accepted');
});

test('a count is a counted kind’s alone; in repair never exceeds it; a size is both sides or neither', async () => {
  assert.notEqual(await pool('hall', true, 'space_count', [5]), '', 'a hall took a count');
  assert.notEqual(await pool('object', false, 'space_count, in_repair_count', [10, 11]), '', 'more in repair than owned');
  assert.notEqual(await pool('hall', true, 'space_width_m', [20]), '', 'a hall took a width with no length');
  assert.notEqual(await pool('hall', true, 'space_width_m, space_length_m', [20, 600]), '', 'a 600 m hall');
  assert.equal(await pool('hall', true, 'space_width_m, space_length_m', [20, 30]), '');
  assert.notEqual(await pool('cart', true, 'floor_label', ['2F']), '', 'a cart was put on a floor');
  assert.equal(await pool('room', true, 'floor_label', ['2F']), '');
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_schedule_pools (vendor_profile_id, calendar_name, floor_label) VALUES ($1, 'Photo team', '2F')`, [F.shop]),
    '',
    'a team schedule (no kind) took a floor',
  );
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_schedule_pools (vendor_profile_id, calendar_name, space_count) VALUES ($1, 'Photo team', 3)`, [F.shop]),
    '',
    'a team schedule (no kind) took a count',
  );
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_schedule_pools (vendor_profile_id, calendar_name, space_width_m, space_length_m) VALUES ($1, 'Photo team', 2, 2)`, [F.shop]),
    '',
    'a team schedule (no kind) took a size',
  );
});

test('"Connects to" stays inside the shop and between halls and rooms', async () => {
  const set = (id: string, to: string) =>
    refused(`UPDATE public.vendor_schedule_pools SET connects_to_pool_id = $2 WHERE pool_id = $1`, [id, to]);
  assert.match(await set(F.hall, F.otherHall), /space_connects_not_yours/, 'a hall connected to another shop’s hall');
  assert.match(await set(F.hall, F.cart), /space_connects_not_yours/, 'a hall connected to a cart');
  assert.match(await set(F.cart, F.hall), /space_connects_not_yours/, 'a cart connected to a hall');
  assert.notEqual(await set(F.hall, F.hall), '', 'a hall connected to itself');
  assert.equal(await set(F.hall, F.hall2), '');
});

test('a table or a door hangs only on the shop’s own hall or room', async () => {
  const table = (p: string, name: string) =>
    refused(
      `INSERT INTO public.vendor_units (vendor_profile_id, pool_id, kind, name, table_shape, chairs) VALUES ($1, $2, 'table', $3, 'round', 8)`,
      [F.shop, p, name],
    );
  assert.match(await table(F.otherHall, 'T8'), /unit_space_not_yours/, 'a table went into another shop’s hall');
  assert.match(await table(F.cart, 'T8'), /unit_space_not_yours/, 'a table went onto a cart');
  assert.match(
    await refused(`INSERT INTO public.vendor_unit_doors (vendor_profile_id, pool_id, wall) VALUES ($1, $2, 'back')`, [F.shop, F.otherHall]),
    /unit_space_not_yours/,
    'a door went into another shop’s hall',
  );
  assert.equal(await table(F.hall2, 'T1'), '', 'T1 in a second hall was refused (names are per room)');
  assert.notEqual(await table(F.hall, 'T1'), '', 'two T1s in one hall');
  assert.notEqual(
    await refused(
      `INSERT INTO public.vendor_units (vendor_profile_id, pool_id, kind, name, table_shape, chairs, chairs_at_ends) VALUES ($1, $2, 'table', 'T3', 'round', 8, TRUE)`,
      [F.shop, F.hall],
    ),
    '',
    'a Round table took "chairs at the ends"',
  );
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_units (vendor_profile_id, pool_id, kind, name) VALUES ($1, $2, 'room', '301')`, [F.shop, F.hall]),
    '',
    'a room was filed as a unit (rooms are spaces now)',
  );
});

test('supplier-only tables: a stranger reads none; a viewer seat reads but cannot write; the 18 Nov floors are gone', async () => {
  const groups = await db.query<{ t: string | null }>(`SELECT to_regclass('public.vendor_unit_groups')::text AS t`);
  assert.equal(groups.rows[0]!.t, null, 'vendor_unit_groups still exists');
  try {
    await as(F.stranger);
    for (const t of ['vendor_units', 'vendor_unit_doors']) {
      const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t} WHERE vendor_profile_id = $1`, [F.shop]);
      assert.equal(r.rows[0]!.n, 0, `a stranger read ${t}`);
    }
    await reset();
    await as(F.viewer);
    const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_units WHERE vendor_profile_id = $1`, [F.shop]);
    assert.ok(seen.rows[0]!.n >= 1, 'the shop’s own viewer seat cannot read its tables');
    assert.notEqual(
      await refused(
        `INSERT INTO public.vendor_units (vendor_profile_id, pool_id, kind, name, table_shape, chairs) VALUES ($1, $2, 'table', 'T5', 'round', 8)`,
        [F.shop, F.hall],
      ),
      '',
      'a viewer seat wrote a table',
    );
  } finally {
    await reset();
  }
});
