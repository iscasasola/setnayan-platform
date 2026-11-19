/**
 * 🧑‍🤝‍🧑 THE SIX SUPPLIER ROLES (owner 19 Nov 2026 — iscasasola/setnayan-platform#8013), proved against the replayed
 * schema (migration `supplier_six_roles`):
 *   · the rank follows the role — and a legacy write of the rank alone moves the role to its nearest;
 *   · the "a shop keeps one admin" floor still holds when the change arrives as a role;
 *   · a whole-shop role carries no branch; a branch of ANOTHER shop is refused;
 *   · a Branch Manager holds their branch's cards; manages only their branch, only below them; cannot promote;
 *   · the shop's own role names: members read, only a Shop Manager writes;
 *   · Marketing may edit a card but not open one;
 *   · event day: the client's Account Manager reaches it with no grant; a Helper does not.
 * Every case asserts a VALUE, never only a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<string, string>;

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    await setAuthUid(db, uid);
    await setRole('authenticated');
    await db.exec('SET ROLE authenticated');
    return await fn();
  } finally {
    await reset();
  }
}
async function mkUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function seat(user: string, duty: string, branch: string | null = null): Promise<string> {
  const r = await db.query<{ m: string }>(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty, branch_id)
     VALUES ($1, $2, 'viewer', $3, $4) RETURNING vendor_team_member_id AS m`,
    [F.shop, user, duty, branch],
  );
  return r.rows[0]!.m;
}
async function row(member: string): Promise<{ role: string; duty: string; branch_id: string | null; whole_branch_keys: string[] }> {
  return (
    await db.query<{ role: string; duty: string; branch_id: string | null; whole_branch_keys: string[] }>(
      `SELECT role::text AS role, duty, branch_id, whole_branch_keys FROM public.vendor_team_members WHERE vendor_team_member_id = $1`,
      [member],
    )
  ).rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  for (const k of ['owner', 'bm', 'am', 'mkt', 'helper', 'newbie', 'other']) F[k] = await mkUser(`${k}@six-roles.test`);
  F.shop = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Blooms & Co.')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.owner],
    )
  ).rows[0]!.v;
  F.otherShop = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Elsewhere')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.other],
    )
  ).rows[0]!.v;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [F.shop, F.owner],
  );
  F.makati = (
    await db.query<{ b: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km)
       VALUES ($1, 'Makati', 'Makati', 20) RETURNING branch_id AS b`,
      [F.shop],
    )
  ).rows[0]!.b;
  F.elsewhereBranch = (
    await db.query<{ b: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km)
       VALUES ($1, 'Far', 'Far', 20) RETURNING branch_id AS b`,
      [F.otherShop],
    )
  ).rows[0]!.b;
  F.makatiCard = await insertLiveCard(db, { vendor_profile_id: F.shop, category: 'photographer', title: 'Wedding Styling', starting_price_php: 30000, branch_id: F.makati });
  F.mainCard = await insertLiveCard(db, { vendor_profile_id: F.shop, category: 'photographer', title: 'Corporate Stage', starting_price_php: 30000 });
});
after(async () => {
  await db?.close();
});

test('the founder seat written by rank alone is a Shop Manager', async () => {
  const r = (await db.query<{ duty: string; role: string }>(`SELECT duty, role::text AS role FROM public.vendor_team_members WHERE user_id = $1`, [F.owner])).rows[0]!;
  assert.deepEqual(r, { duty: 'shop_manager', role: 'admin' });
});

test('the rank follows the role, whatever rank was typed', async () => {
  F.bmSeat = await seat(F.bm, 'branch_manager', F.makati);
  F.amSeat = await seat(F.am, 'account_manager', F.makati);
  F.mktSeat = await seat(F.mkt, 'marketing', F.makati);
  F.helperSeat = await seat(F.helper, 'helper');
  assert.equal((await row(F.bmSeat)).role, 'agent');
  assert.equal((await row(F.amSeat)).role, 'agent');
  const mkt = await row(F.mktSeat);
  assert.equal(mkt.role, 'viewer');
  assert.equal(mkt.branch_id, null, 'Marketing covers the whole shop — its branch is dropped');
  assert.equal((await row(F.helperSeat)).role, 'viewer');
});

test('a legacy rank write moves the role to that rank’s nearest', async () => {
  await db.query(`UPDATE public.vendor_team_members SET role = 'agent' WHERE vendor_team_member_id = $1`, [F.helperSeat]);
  assert.deepEqual(
    { role: (await row(F.helperSeat)).role, duty: (await row(F.helperSeat)).duty },
    { role: 'agent', duty: 'account_manager' },
  );
  await db.query(`UPDATE public.vendor_team_members SET duty = 'helper' WHERE vendor_team_member_id = $1`, [F.helperSeat]);
  assert.equal((await row(F.helperSeat)).role, 'viewer');
});

test('the last-admin floor holds when the change arrives as a role', async () => {
  let err = '';
  try {
    await db.query(`UPDATE public.vendor_team_members SET duty = 'helper' WHERE user_id = $1 AND vendor_profile_id = $2`, [F.owner, F.shop]);
  } catch (e) {
    err = (e as Error).message;
  }
  assert.match(err, /VENDOR_LAST_ADMIN/);
});

test('a branch of another shop is refused', async () => {
  let err = '';
  try {
    await db.query(`UPDATE public.vendor_team_members SET branch_id = $2 WHERE vendor_team_member_id = $1`, [F.amSeat, F.elsewhereBranch]);
  } catch (e) {
    err = (e as Error).message;
  }
  assert.match(err, /VENDOR_TEAM_BRANCH_NOT_THIS_SHOP/);
});

test('a Branch Manager holds their branch’s cards — and only theirs', async () => {
  const bm = await row(F.bmSeat);
  assert.deepEqual(bm.whole_branch_keys, [F.makati]);
  const cards = (
    await db.query<{ s: string }>(`SELECT vendor_service_id AS s FROM public.vendor_service_agents WHERE vendor_team_member_id = $1`, [F.bmSeat])
  ).rows.map((r) => r.s);
  assert.deepEqual(cards, [F.makatiCard]);
});

test('a Branch Manager adds below them at their branch — never above, never elsewhere', async () => {
  const added = await as(F.bm, async () =>
    db.query<{ duty: string; role: string }>(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty, branch_id)
       VALUES ($1, $2, 'viewer', 'event_crew', $3) RETURNING duty, role::text AS role`,
      [F.shop, F.newbie, F.makati],
    ),
  );
  assert.deepEqual(added.rows[0], { duty: 'event_crew', role: 'viewer' });

  for (const [duty, branch, why] of [
    ['shop_manager', null, 'promote to Shop Manager'],
    ['account_manager', null, 'file someone at Main'],
  ] as const) {
    let err = '';
    try {
      await as(F.bm, () =>
        db.query(`UPDATE public.vendor_team_members SET duty = $2, branch_id = $3 WHERE vendor_team_member_id = $1`, [F.amSeat, duty, branch]),
      );
    } catch (e) {
      err = (e as Error).message;
    }
    assert.match(err, /row-level security/, `a Branch Manager must not ${why}`);
  }
  assert.equal((await row(F.amSeat)).duty, 'account_manager', 'nothing moved');

  // They do not even see the Marketing seat (whole shop) to change it.
  const seen = await as(F.bm, () =>
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_team_members WHERE vendor_team_member_id = $1`, [F.mktSeat]),
  );
  assert.equal(seen.rows[0]!.n, 0);
});

test('role names: the team reads them, only a Shop Manager writes them', async () => {
  await as(F.owner, () =>
    db.query(`INSERT INTO public.vendor_role_names (vendor_profile_id, duty, display_name, updated_by) VALUES ($1, 'account_manager', 'Lead Stylist', $2)`, [F.shop, F.owner]),
  );
  const read = await as(F.helper, () =>
    db.query<{ display_name: string }>(`SELECT display_name FROM public.vendor_role_names WHERE vendor_profile_id = $1 AND duty = 'account_manager'`, [F.shop]),
  );
  assert.equal(read.rows[0]?.display_name, 'Lead Stylist');
  let err = '';
  try {
    await as(F.bm, () =>
      db.query(`INSERT INTO public.vendor_role_names (vendor_profile_id, duty, display_name) VALUES ($1, 'helper', 'Runner')`, [F.shop]),
    );
  } catch (e) {
    err = (e as Error).message;
  }
  assert.match(err, /row-level security/);
  const stranger = await as(F.other, () =>
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_role_names WHERE vendor_profile_id = $1`, [F.shop]),
  );
  assert.equal(stranger.rows[0]!.n, 0, 'another shop reads none of these names');
});

test('Marketing edits a card’s words, and opens no card', async () => {
  await as(F.mkt, () => db.query(`UPDATE public.vendor_services SET title = 'Wedding Styling · Signature' WHERE vendor_service_id = $1`, [F.mainCard]));
  const t = (await db.query<{ title: string }>(`SELECT title FROM public.vendor_services WHERE vendor_service_id = $1`, [F.mainCard])).rows[0]!;
  assert.equal(t.title, 'Wedding Styling · Signature');
  // A Helper's update matches nothing.
  await as(F.helper, () => db.query(`UPDATE public.vendor_services SET title = 'hijack' WHERE vendor_service_id = $1`, [F.mainCard]));
  assert.equal((await db.query<{ title: string }>(`SELECT title FROM public.vendor_services WHERE vendor_service_id = $1`, [F.mainCard])).rows[0]!.title, 'Wedding Styling · Signature');
});

test('event day: the client’s Account Manager is in with no grant; a Helper is not', async () => {
  await db.query(`INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [F.makatiCard, F.amSeat]);
  const ev = (await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Dela Cruz wedding', 'birthday') RETURNING event_id AS e`)).rows[0]!.e;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'misc', 'Blooms & Co.', 'contracted', $2, $3)`,
    [ev, F.shop, F.makatiCard],
  );
  const am = await as(F.am, () => db.query<{ e: string }>(`SELECT public.current_vendor_dayof_grant_event_ids() AS e`));
  assert.ok(am.rows.some((r) => r.e === ev), 'the Account Manager whose card it booked reaches the day');
  const bm = await as(F.bm, () => db.query<{ e: string }>(`SELECT public.current_vendor_dayof_grant_event_ids() AS e`));
  assert.ok(bm.rows.some((r) => r.e === ev), 'the Branch Manager of that card’s branch reaches the day');
  const helper = await as(F.helper, () => db.query<{ e: string }>(`SELECT public.current_vendor_dayof_grant_event_ids() AS e`));
  assert.ok(!helper.rows.some((r) => r.e === ev), 'a Helper with no grant does not');
});
