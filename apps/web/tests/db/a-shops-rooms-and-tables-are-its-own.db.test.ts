/**
 * A SHOP'S ROOMS AND TABLES ARE ITS OWN — Rooms & seating storage, executed against real Postgres
 * (migration 20271350389612; specs `prototypes/units_rooms_seating_2026-11-18/MAP.md`, piece A).
 *
 * Shaped around REFUSALS — a test that only reads a room back would pass against a table with no rules:
 *   · a stranger reads NOTHING and writes nothing (supplier-only; couples never see which room or table);
 *   · a room cannot be filed on a dining area, a table cannot be filed on a hotel floor;
 *   · a row cannot point at ANOTHER shop's floor (the guard, not only RLS);
 *   · a table needs a type and one chair count; "chairs at the ends" is a Long table's alone;
 *   · a hotel floor has no room size (the hall's size is `vendor_profiles`, never here).
 * And one positive: the shop's own viewer-seat teammate READS, but cannot write.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<'owner' | 'viewer' | 'stranger' | 'shop' | 'other' | 'floor' | 'area' | 'otherFloor', string>;

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
  F.owner = await mkUser('rooms-owner@units.test');
  F.viewer = await mkUser('rooms-viewer@units.test');
  F.stranger = await mkUser('rooms-stranger@units.test');
  F.shop = await mkShop(F.owner, 'Casa Lumen Hotel');
  F.other = await mkShop(F.stranger, 'Other Shop');
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'viewer')`, [F.shop, F.viewer]);
  F.floor = (
    await db.query<{ g: string }>(
      `INSERT INTO public.vendor_unit_groups (vendor_profile_id, kind, name) VALUES ($1, 'floor', '3rd floor') RETURNING group_id AS g`,
      [F.shop],
    )
  ).rows[0]!.g;
  F.area = (
    await db.query<{ g: string }>(
      `INSERT INTO public.vendor_unit_groups (vendor_profile_id, kind, name, width_m, length_m)
       VALUES ($1, 'dining_area', 'Garden', 20, 14) RETURNING group_id AS g`,
      [F.shop],
    )
  ).rows[0]!.g;
  F.otherFloor = (
    await db.query<{ g: string }>(
      `INSERT INTO public.vendor_unit_groups (vendor_profile_id, kind, name) VALUES ($1, 'floor', 'Ground') RETURNING group_id AS g`,
      [F.other],
    )
  ).rows[0]!.g;
  await db.query(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '301')`, [F.shop, F.floor]);
  await db.query(
    `INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name, table_shape, chairs, chairs_at_ends)
     VALUES ($1, $2, 'table', 'T1', 'long', 10, TRUE)`,
    [F.shop, F.area],
  );
  await db.query(`INSERT INTO public.vendor_unit_doors (vendor_profile_id, group_id, wall) VALUES ($1, NULL, 'front')`, [F.shop]);
});
after(async () => {
  await db?.close();
});

test('a room cannot sit on a dining area, nor a table on a hotel floor', async () => {
  const room = await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '302')`, [F.shop, F.area]);
  assert.match(room, /unit_group_not_yours/, 'a room was filed on a dining area');
  const table = await refused(
    `INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name, table_shape, chairs) VALUES ($1, $2, 'table', 'T9', 'round', 8)`,
    [F.shop, F.floor],
  );
  assert.match(table, /unit_group_not_yours/, 'a table was filed on a hotel floor');
});

test('a row cannot point at another shop’s floor', async () => {
  const msg = await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '999')`, [F.shop, F.otherFloor]);
  assert.match(msg, /unit_group_not_yours/);
});

test('a table needs a type and one chair count; ends are a Long table’s alone; a floor has no size', async () => {
  assert.notEqual(await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'table', 'T2')`, [F.shop, F.area]), '');
  assert.notEqual(
    await refused(
      `INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name, table_shape, chairs, chairs_at_ends) VALUES ($1, $2, 'table', 'T3', 'round', 8, TRUE)`,
      [F.shop, F.area],
    ),
    '',
    'a Round table took "chairs at the ends"',
  );
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_unit_groups (vendor_profile_id, kind, name, width_m, length_m) VALUES ($1, 'floor', '4th', 10, 10)`, [F.shop]),
    '',
    'a hotel floor took a room size',
  );
  assert.notEqual(
    await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '301')`, [F.shop, F.floor]),
    '',
    'two rooms named 301 in one shop',
  );
});

test('supplier-only: a stranger reads nothing and writes nothing; a viewer seat reads but cannot write', async () => {
  try {
    await as(F.stranger);
    for (const t of ['vendor_unit_groups', 'vendor_units', 'vendor_unit_doors']) {
      const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t} WHERE vendor_profile_id = $1`, [F.shop]);
      assert.equal(r.rows[0]!.n, 0, `a stranger read ${t}`);
    }
    assert.notEqual(
      await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '777')`, [F.shop, F.floor]),
      '',
      'a stranger wrote a room into another shop',
    );
    await reset();
    await as(F.viewer);
    const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_units WHERE vendor_profile_id = $1`, [F.shop]);
    assert.equal(seen.rows[0]!.n, 2, 'the shop’s own viewer seat cannot read its rooms and tables');
    assert.notEqual(
      await refused(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '303')`, [F.shop, F.floor]),
      '',
      'a viewer seat wrote a room',
    );
    await reset();
    await as(F.owner);
    await db.query(`INSERT INTO public.vendor_units (vendor_profile_id, group_id, kind, name) VALUES ($1, $2, 'room', '304')`, [F.shop, F.floor]);
  } finally {
    await reset();
  }
});
