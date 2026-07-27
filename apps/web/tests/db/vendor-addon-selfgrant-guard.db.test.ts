/**
 * vendor_profiles paid-ADD-ON self-grant guard — end-to-end (test:db, migrations
 * replayed).
 *
 * THE HOLE THIS LOCKS: `vendor_profiles_owner` (20260513120000:62-67) is
 * `FOR ALL TO authenticated USING (user_id = auth.uid())`. Postgres RLS is
 * ROW-level, never COLUMN-level, and there is no column-scoped GRANT on this
 * table — so a vendor may PATCH ANY column of their OWN row through PostgREST
 * unless a trigger says otherwise. `guard_vendor_profiles_entitlement`
 * (20270920020000) guarded only tier_state / tier_expires_at /
 * extra_agent_seats; the four PAID ADD-ON columns shipped later were never added
 * to it, so a vendor could hand themselves a free Vendor AI window, a free
 * branded 3D booth, and an infinitely re-armable "one-time" free trial.
 *
 * Migration 20271002456914 extends the guard. These tests prove, against real
 * replayed SQL, that (a) each column is now blocked for the vendor, (b) the
 * service-role activation path still works, and (c) an ordinary profile edit is
 * untouched.
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

/** Impersonate the vendor themselves (uid + role claim + SET ROLE). */
async function asVendor(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** A vendor account + its profile, created privileged (the real registration path). */
async function newVendor(email: string): Promise<{ uid: string; vendorProfileId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const uid = u.rows[0]!.id;
  // A vendor-typed signup already provisions its vendor_profiles row via the
  // on_auth_user_created trigger, so adopt that row rather than inserting a
  // second one (vendor_profiles_user_id_key is UNIQUE).
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE public.vendor_profiles
          SET business_name = 'Guard Test Vendor', location_city = 'Manila'
        WHERE user_id = $1`,
      [uid],
    );
    return { uid, vendorProfileId: existing.rows[0]!.vendor_profile_id };
  }
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Guard Test Vendor', 'Manila', ARRAY['photography']::text[])
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { uid, vendorProfileId: v.rows[0]!.vendor_profile_id };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await reset();
  await db?.close();
});

// ── every paid add-on column is blocked for the vendor ──────────────────────

const GUARDED_ADDON_COLUMNS = [
  'ai_addon_expires_at',
  'ai_addon_trial_used_at',
  'booth_addon_expires_at',
  'booth_addon_trial_used_at',
] as const;

// ── the AI ladder LEVEL marker (20271003111715) ─────────────────────────────
// The level decides whether the vendor gets Basic or Advanced behaviour, so it
// must be exactly as unwritable as the windows above. Kept separate because it
// is TEXT, not a timestamp, and because self-promotion 'basic' -> 'advanced' is
// the specific attack.

test('a vendor CANNOT self-promote ai_addon_level to advanced', async () => {
  const { uid, vendorProfileId } = await newVendor('level-promote@guard.test');
  await asVendor(uid);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET ai_addon_level = 'advanced'
          WHERE vendor_profile_id = $1`,
        [vendorProfileId],
      ),
    /self-grant blocked/,
  );
  await reset();
  const r = await db.query<{ lvl: string }>(
    `SELECT ai_addon_level AS lvl FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.lvl, 'basic', 'the level must stay basic');
});

test('every vendor defaults to level basic, and the CHECK rejects junk levels', async () => {
  const { vendorProfileId } = await newVendor('level-default@guard.test');
  await reset();
  const r = await db.query<{ lvl: string }>(
    `SELECT ai_addon_level AS lvl FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.lvl, 'basic', 'least privilege by default');

  await asService();
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET ai_addon_level = 'ultra' WHERE vendor_profile_id = $1`,
        [vendorProfileId],
      ),
    /vendor_profiles_ai_addon_level_check/,
  );
});

test('the SERVICE-ROLE activation path CAN promote the level', async () => {
  const { vendorProfileId } = await newVendor('level-service@guard.test');
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles SET ai_addon_level = 'advanced' WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await reset();
  const r = await db.query<{ lvl: string }>(
    `SELECT ai_addon_level AS lvl FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.lvl, 'advanced');
});

test('the ADVANCED SKU is seeded INACTIVE — nothing is sellable yet', async () => {
  await reset();
  const r = await db.query<{ sku: string; active: boolean; price: string }>(
    `SELECT sku_code AS sku, is_active AS active, price_php AS price
       FROM public.vendor_billing_catalog WHERE sku_code = 'vendor_ai_addon_advanced'`,
  );
  assert.equal(r.rows.length, 1, 'the Advanced row must exist');
  assert.equal(r.rows[0]!.active, false, 'it must ship switched OFF (capabilities unbuilt)');
  assert.equal(Number(r.rows[0]!.price), 3000, 'seeded at the ENTRY band so a fallback cannot under-charge');
  // The new SKU code must carry the vendor_ prefix or lib/orders.ts
  // isVatInclusiveServiceKey mis-handles VAT and orders strand.
  assert.ok('vendor_ai_addon_advanced'.startsWith('vendor_'));
});

for (const col of GUARDED_ADDON_COLUMNS) {
  test(`a vendor CANNOT self-grant ${col}`, async () => {
    const { uid, vendorProfileId } = await newVendor(`selfgrant-${col}@guard.test`);
    await asVendor(uid);

    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.vendor_profiles SET ${col} = '2099-01-01T00:00:00Z'
            WHERE vendor_profile_id = $1`,
          [vendorProfileId],
        ),
      /self-grant blocked/,
      `${col} must be trigger-guarded`,
    );

    // And the row is genuinely unchanged.
    await reset();
    const after = await db.query<Record<string, string | null>>(
      `SELECT ${col} AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    assert.equal(after.rows[0]!.v, null, `${col} must still be NULL`);
  });
}

test('a vendor CANNOT re-arm a spent one-time trial by nulling the marker', async () => {
  // This is the subtler half: the atomic `WHERE trial_used_at IS NULL` claims in
  // ai-addon-actions.ts / booth-addon-actions.ts are only safe if the marker is
  // write-once. A vendor who can NULL it gets unlimited "first" free cycles.
  const { uid, vendorProfileId } = await newVendor('rearm@guard.test');
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles SET ai_addon_trial_used_at = NOW()
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );

  await asVendor(uid);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET ai_addon_trial_used_at = NULL
          WHERE vendor_profile_id = $1`,
        [vendorProfileId],
      ),
    /self-grant blocked/,
  );

  await reset();
  const r = await db.query<{ used: string | null }>(
    `SELECT ai_addon_trial_used_at AS used FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.notEqual(r.rows[0]!.used, null, 'the spent trial marker must survive');
});

test('a user CANNOT INSERT a fresh vendor profile that already carries an add-on window', async () => {
  // The INSERT branch closes the create-it-pre-granted vector. (The
  // DELETE-then-re-INSERT variant is separately unreachable: deleting the profile
  // trips VENDOR_LAST_ADMIN in vendor_team_guard_trg. This is the reachable one —
  // an account with no vendor profile yet opening a shop.)
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    ['pregranted@guard.test'],
  );
  const uid = u.rows[0]!.id;
  await asVendor(uid);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.vendor_profiles (user_id, business_name, booth_addon_expires_at)
         VALUES ($1, 'Sneaky', '2099-01-01T00:00:00Z')`,
        [uid],
      ),
    /self-grant blocked/,
  );

  // …while the same INSERT WITHOUT the pre-granted window is fine.
  await db.query(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Honest Shop')`,
    [uid],
  );
  await reset();
  const r = await db.query<{ n: string; b: string | null }>(
    `SELECT business_name AS n, booth_addon_expires_at AS b
       FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  assert.equal(r.rows[0]!.n, 'Honest Shop');
  assert.equal(r.rows[0]!.b, null);
});

// ── the legitimate paths still work ─────────────────────────────────────────

test('the SERVICE-ROLE activation path can still grant every add-on column', async () => {
  const { vendorProfileId } = await newVendor('service-grant@guard.test');
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles
        SET ai_addon_expires_at       = '2099-01-01T00:00:00Z',
            ai_addon_trial_used_at    = NOW(),
            booth_addon_expires_at    = '2099-01-01T00:00:00Z',
            booth_addon_trial_used_at = NOW()
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await reset();
  const r = await db.query<{ ai: string | null; booth: string | null }>(
    `SELECT ai_addon_expires_at AS ai, booth_addon_expires_at AS booth
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.notEqual(r.rows[0]!.ai, null, 'service_role must still be able to activate');
  assert.notEqual(r.rows[0]!.booth, null);
});

test('an ordinary profile edit by the vendor is UNAFFECTED', async () => {
  // The guard must no-op when no guarded column changes — otherwise every vendor
  // profile save breaks.
  const { uid, vendorProfileId } = await newVendor('ordinary-edit@guard.test');
  await asVendor(uid);
  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Renamed Studio'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await reset();
  const r = await db.query<{ n: string }>(
    `SELECT business_name AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 'Renamed Studio');
});

test('an edit that RE-STATES an add-on column at its current value is allowed', async () => {
  // IS DISTINCT FROM semantics: a full-row PATCH that echoes the unchanged value
  // must not trip the guard, or ordinary saves break for any vendor who holds an
  // add-on.
  const { uid, vendorProfileId } = await newVendor('restate@guard.test');
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles SET booth_addon_expires_at = '2099-01-01T00:00:00Z'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await asVendor(uid);
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Echo Studio',
            booth_addon_expires_at = '2099-01-01T00:00:00Z'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await reset();
  const r = await db.query<{ n: string }>(
    `SELECT business_name AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 'Echo Studio');
});

// ── TRUST columns: verification badge + admin visibility freeze (20271004444950)
// A vendor marking themselves "verified" is a TRUST/SAFETY failure, not just a
// revenue one — the badge is what tells a couple this business was checked. The
// same PATCH also reverses the visibility freeze applied to a suspended vendor.

test('a vendor CANNOT self-verify (verification_state)', async () => {
  const { uid, vendorProfileId } = await newVendor('selfverify@guard.test');
  await asVendor(uid);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET verification_state = 'verified'
          WHERE vendor_profile_id = $1`,
        [vendorProfileId],
      ),
    /self-grant blocked/,
  );
  await reset();
  const r = await db.query<{ v: string }>(
    `SELECT verification_state::text AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.notEqual(r.rows[0]!.v, 'verified', 'the trust badge must not be self-granted');
});

test('a vendor CANNOT reverse an admin visibility freeze (public_visibility)', async () => {
  const { uid, vendorProfileId } = await newVendor('unfreeze@guard.test');
  // Admin freezes them out of the marketplace (the suspension shape).
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles SET public_visibility = 'hidden'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await asVendor(uid);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET public_visibility = 'verified'
          WHERE vendor_profile_id = $1`,
        [vendorProfileId],
      ),
    /self-grant blocked/,
  );
  await reset();
  const r = await db.query<{ v: string }>(
    `SELECT public_visibility::text AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.v, 'hidden', 'the freeze must hold');
});

test('the ADMIN path can still verify and un-hide a vendor', async () => {
  const { vendorProfileId } = await newVendor('adminverify@guard.test');
  await asService();
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified', public_visibility = 'verified'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await reset();
  const r = await db.query<{ v: string; p: string }>(
    `SELECT verification_state::text AS v, public_visibility::text AS p
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(r.rows[0]!.v, 'verified');
  assert.equal(r.rows[0]!.p, 'verified');
});

test('ordinary vendor REGISTRATION still succeeds (the INSERT branch defaults)', async () => {
  // The INSERT guard compares against the real column DEFAULTS ('unverified' /
  // 'hidden'). Get either literal wrong and every self-registration 500s.
  //
  // 🔒 `hidden` since 2026-07-27 (was 'coming_soon'). The owner retired
  // coming_soon — "we only show shops that are ready" — and migration
  // 20271013500000 moved BOTH the column default AND the guard's INSERT-branch
  // literal in one step, precisely because moving only the default would have
  // made the guard reject every registration. This assertion is the thing that
  // proves the pair stayed in sync, so it must track the default, not lag it.
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    ['register-ok@guard.test'],
  );
  const uid = u.rows[0]!.id;
  await asVendor(uid);
  await db.query(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Honest Shop')`,
    [uid],
  );
  await reset();
  const r = await db.query<{ v: string; p: string }>(
    `SELECT verification_state::text AS v, public_visibility::text AS p
       FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  assert.equal(r.rows[0]!.v, 'unverified');
  assert.equal(
    r.rows[0]!.p,
    'hidden',
    'a self-registered shop must rest PRIVATE — the pre-2026-07-27 default ' +
      "('coming_soon') was publicly readable through vendor_profiles_public_read",
  );
});
