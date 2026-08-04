/**
 * Vendor package authoring under RLS — can a TEAM ADMIN actually build a
 * package, or only start one?
 *
 * THE BUG (live on main before 20271104090000, and silent):
 * `vendor_packages` got a `*_team_admin` policy in 20260822000000:42-46;
 * `vendor_package_items` and `vendor_package_item_options` did not. A vendor
 * team admin therefore INSERTs the package row, is refused every inclusion row,
 * and the server action deletes the package it just made
 * (app/vendor-dashboard/packages/actions.ts:227-231). Half-write, then
 * self-erase, with nothing surfaced — an RLS refusal and an empty result are the
 * same value to the client.
 *
 * Test 1 FAILS on main. That is the point of it.
 *
 * The other three exist so the fix cannot be "widen it until green":
 *   2. an AGENT-rank member must still be refused (the helper unions admin+),
 *   3. an admin of vendor 1 must not attach a row to vendor 2's package —
 *      catches a WITH CHECK that merely restates USING,
 *   4. anon must be exactly as it was: no writes, reads only under is_active.
 *
 * Run: pnpm --filter @setnayan/web test:db
 * In-process PGlite replays the real supabase/migrations under real RLS.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}

/**
 * Seed as the DEFAULT role, not service_role: `SET ROLE service_role` makes the
 * on_auth_user_created trigger fail with "permission denied for table users",
 * and the default role bypasses RLS anyway. Same shape the other package db
 * tests use.
 */
async function asSetup(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/**
 * account_type 'customer' so the auth trigger does not mint a COMPETING
 * vendor_profiles row for these users — the same reason
 * package-option-branching.db.test.ts:103-104 gives. Team membership, not
 * account type, is what this test is about.
 */
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer'::text)) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** True when the statement was refused (RLS error OR zero rows written). */
async function refused(sql: string, params: unknown[]): Promise<boolean> {
  try {
    const r = await db.query(sql, params as never[]);
    return (r.rows?.length ?? 0) === 0;
  } catch {
    return true;
  }
}

// Concrete keys, not Record<string, string>: under `noUncheckedIndexedAccess`
// (which CI's tsc enforces and a loose local run does not) an index signature
// makes every read `string | undefined`, and asUser() takes a string.
const F: {
  ownerA: string;
  adminB: string;
  agentC: string;
  vendor1: string;
  vendor2: string;
  pkg2: string;
} = { ownerA: '', adminB: '', agentC: '', vendor1: '', vendor2: '', pkg2: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asSetup();

  F.ownerA = await createUser('owner-a@packages.test');
  F.adminB = await createUser('admin-b@packages.test');
  F.agentC = await createUser('agent-c@packages.test');
  const ownerD = await createUser('owner-d@packages.test');

  const v1 = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Vendor One') RETURNING vendor_profile_id`,
    [F.ownerA],
  );
  F.vendor1 = v1.rows[0]!.vendor_profile_id;

  const v2 = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Vendor Two') RETURNING vendor_profile_id`,
    [ownerD],
  );
  F.vendor2 = v2.rows[0]!.vendor_profile_id;

  // B is an ADMIN of vendor 1; C is only an AGENT of vendor 1.
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'admin'), ($1, $3, 'agent')`,
    [F.vendor1, F.adminB, F.agentC],
  );

  // A package belonging to vendor 2, used for the cross-vendor case.
  const p2 = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, 'Vendor Two Package', 2000000, 0, FALSE, 'reception_venue')
     RETURNING package_id`,
    [F.vendor2],
  );
  F.pkg2 = p2.rows[0]!.package_id;
});

after(async () => {
  await db?.close();
});

test('a vendor TEAM ADMIN can author a whole package — row, items and options', async () => {
  await asUser(F.adminB);

  const pkg = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, 'Team Admin Package', 2000000, 0, FALSE, 'catering')
     RETURNING package_id`,
    [F.vendor1],
  );
  assert.equal(pkg.rows.length, 1, 'team admin could not create the package row');
  const packageId = pkg.rows[0]!.package_id;

  const items = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, parent_option_id, is_default_included)
     VALUES ($1, 'catering', 'Main course', 100000, 0, NULL, TRUE),
            ($1, 'catering', 'Dessert',     50000,  1, NULL, TRUE)
     RETURNING item_id`,
    [packageId],
  );
  assert.equal(
    items.rows.length,
    2,
    'team admin created the package but was refused its items — this is the bug ' +
      '20271104090000 closes; the server action would now delete the package it just made',
  );

  const opts = await db.query<{ option_id: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, is_default, is_available, display_order)
     VALUES ($1, 'Beef',    0, TRUE,  TRUE, 0),
            ($1, 'Salmon', 25000, FALSE, TRUE, 1)
     RETURNING option_id`,
    [items.rows[0]!.item_id],
  );
  assert.equal(opts.rows.length, 2, 'team admin was refused the item options');
});

test('an AGENT-rank member is still refused — the helper unions admin and above', async () => {
  await asSetup();
  const pkg = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, 'Agent Probe', 2000000, 0, FALSE, 'catering')
     RETURNING package_id`,
    [F.vendor1],
  );
  const packageId = pkg.rows[0]!.package_id;

  await asUser(F.agentC);
  assert.ok(
    await refused(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id, is_default_included)
       VALUES ($1, 'catering', 'Agent should not write this', 1000, 0, NULL, TRUE)
       RETURNING item_id`,
      [packageId],
    ),
    'an agent-rank team member was able to write a package item — the fix is too wide',
  );
});

test('an admin of one vendor cannot attach an item to another vendor’s package', async () => {
  await asUser(F.adminB);
  assert.ok(
    await refused(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id, is_default_included)
       VALUES ($1, 'catering', 'Cross-vendor write', 1000, 0, NULL, TRUE)
       RETURNING item_id`,
      [F.pkg2],
    ),
    'WITH CHECK did not hold: vendor 1’s admin wrote into vendor 2’s package',
  );
});

test('anon is unchanged — no writes, and reads only under an active package', async () => {
  await asSetup();
  const pkg = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active)
     VALUES ($1, 'Inactive Package', 2000000, 0, FALSE, 'catering', FALSE)
     RETURNING package_id`,
    [F.vendor1],
  );
  const inactiveId = pkg.rows[0]!.package_id;
  await db.query(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, parent_option_id, is_default_included)
     VALUES ($1, 'catering', 'Hidden line', 1000, 0, NULL, TRUE)`,
    [inactiveId],
  );

  await asAnon();
  assert.ok(
    await refused(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id, is_default_included)
       VALUES ($1, 'catering', 'anon write', 1000, 9, NULL, TRUE)
       RETURNING item_id`,
      [inactiveId],
    ),
    'anon gained write access to package items',
  );

  const visible = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.vendor_package_items WHERE package_id = $1`,
    [inactiveId],
  );
  assert.equal(
    visible.rows[0]!.n,
    '0',
    'anon can see items of an INACTIVE package — the is_active read gate regressed',
  );
});
