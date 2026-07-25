/**
 * Two-ring reach columns — DB-level regression (executed, not prose).
 *
 * Guards migration 20271003528118_vendor_reach_rings.sql (owner-locked model
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6). It ADDs two nullable
 * INTEGER columns to public.vendor_profiles:
 *
 *   • reach_ring1_km — "free travel" ring; a venue inside it forces the vendor's
 *                      proposal transportation line to ₱0 (field disabled).
 *   • reach_ring2_km — "willing to travel" OUTER ring; beyond it the vendor is
 *                      not shown to that couple. Tier-capped AT READ TIME.
 *
 * What is proven here, against the FULL replayed prod schema (all migrations in
 * order, in-memory PGlite — no docker, no network):
 *
 *   1. both columns exist, are INTEGER, and are NULLABLE (the fail-safe default:
 *      NULL Ring 1 = no free-travel ring, so nothing is ever forced to ₱0);
 *   2. the 0–100 sanity CHECK actually rejects out-of-range values;
 *   3. the venue anchor the rings are measured against (events.venue_latitude /
 *      venue_longitude) is present — the rings are useless without it, and this
 *      migration deliberately adds NO new geo columns;
 *   4. THE ENTITLEMENT-GUARD DECISION IS PINNED: these are vendor PREFERENCES,
 *      so a vendor CAN write them under their own RLS — the tier cap is enforced
 *      by the read-side clamp in lib/vendor-reach-rings.ts, never by the column.
 *      If someone later "hardens" this by adding the columns to
 *      guard_vendor_profiles_entitlement, test 4 fails loudly and they will find
 *      this comment explaining why the vendor settings card would break.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let vendorUid: string;
let vendorProfileId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asVendor(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('reach-rings-vendor@example.com', jsonb_build_object('account_type','vendor'))
     RETURNING id`,
  );
  vendorUid = u.rows[0]!.id;

  // A vendor-typed signup already provisions its vendor_profiles row via the
  // on_auth_user_created trigger (vendor_profiles_user_id_key is UNIQUE).
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [vendorUid],
  );
  if (existing.rows.length > 0) {
    vendorProfileId = existing.rows[0]!.vendor_profile_id;
    await db.query(
      `UPDATE public.vendor_profiles
          SET business_name = 'Reach Rings Vendor', location_city = 'Quezon City'
        WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
  } else {
    const v = await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
       VALUES ($1, 'Reach Rings Vendor', 'Quezon City', ARRAY['photography']::text[])
       RETURNING vendor_profile_id`,
      [vendorUid],
    );
    vendorProfileId = v.rows[0]!.vendor_profile_id;
  }
});

after(async () => {
  await reset();
  await db?.close();
});

test('replay applies every migration incl. the reach-rings add (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('both ring columns exist on vendor_profiles, INTEGER + NULLABLE', async () => {
  const cols = await db.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
        AND column_name IN ('reach_ring1_km', 'reach_ring2_km')
      ORDER BY column_name`,
  );
  assert.equal(cols.rows.length, 2, 'both columns present');
  for (const row of cols.rows) {
    assert.equal(row.data_type, 'integer', `${row.column_name} type`);
    assert.equal(row.is_nullable, 'YES', `${row.column_name} nullable`);
    // NULL (never set) is the fail-safe: Ring 1 resolves to 0 km → nothing is
    // forced to ₱0; Ring 2 resolves to the tier cap → discovery never narrows.
    assert.equal(row.column_default, null, `${row.column_name} has no default`);
  }
});

test('a profile round-trips both rings and starts NULL', async () => {
  await reset();
  const before0 = await db.query<{ reach_ring1_km: number | null; reach_ring2_km: number | null }>(
    `SELECT reach_ring1_km, reach_ring2_km FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(before0.rows[0]!.reach_ring1_km, null);
  assert.equal(before0.rows[0]!.reach_ring2_km, null);

  const w = await db.query<{ reach_ring1_km: number; reach_ring2_km: number }>(
    `UPDATE public.vendor_profiles
        SET reach_ring1_km = 12, reach_ring2_km = 55
      WHERE vendor_profile_id = $1
      RETURNING reach_ring1_km, reach_ring2_km`,
    [vendorProfileId],
  );
  assert.equal(w.rows[0]!.reach_ring1_km, 12);
  assert.equal(w.rows[0]!.reach_ring2_km, 55);
});

test('the 0–100 km sanity CHECK rejects out-of-range values', async () => {
  await reset();
  for (const [col, bad] of [
    ['reach_ring1_km', -1],
    ['reach_ring1_km', 101],
    ['reach_ring2_km', -5],
    ['reach_ring2_km', 5000],
  ] as const) {
    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.vendor_profiles SET ${col} = $1 WHERE vendor_profile_id = $2`,
          [bad, vendorProfileId],
        ),
      /violates check constraint/i,
      `${col} = ${bad} must be rejected`,
    );
  }
  // The bounds themselves are legal.
  await db.query(
    `UPDATE public.vendor_profiles SET reach_ring1_km = 0, reach_ring2_km = 100
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
});

test('the venue anchor the rings measure against still exists on events', async () => {
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
        AND column_name IN ('venue_latitude', 'venue_longitude')`,
  );
  assert.equal(cols.rows.length, 2, 'THE EVENT VENUE decides the ring — anchor required');

  const hq = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
        AND column_name IN ('hq_latitude', 'hq_longitude')`,
  );
  assert.equal(hq.rows.length, 2, 'vendor HQ pin reused, not re-added');
});

test('rings are a vendor PREFERENCE: the vendor may write them under their own RLS', async () => {
  // The entitlement guard MUST NOT cover these columns — the tier cap is applied
  // by the read-side clamp (resolveRingRadii), not by blocking the write. If a
  // future migration adds them to guard_vendor_profiles_entitlement this fails,
  // and the vendor reach-settings card would be dead on arrival.
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles SET reach_ring1_km = NULL, reach_ring2_km = NULL
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  await asVendor(vendorUid);
  const r = await db.query<{ reach_ring1_km: number; reach_ring2_km: number }>(
    `UPDATE public.vendor_profiles
        SET reach_ring1_km = 8, reach_ring2_km = 30
      WHERE user_id = $1
      RETURNING reach_ring1_km, reach_ring2_km`,
    [vendorUid],
  );
  assert.equal(r.rows.length, 1, 'vendor own-row write allowed');
  assert.equal(r.rows[0]!.reach_ring1_km, 8);
  assert.equal(r.rows[0]!.reach_ring2_km, 30);
  await reset();
});

test('an over-tier Ring 2 is STORABLE (and inert) — the cap lives in the read clamp', async () => {
  // A Solo vendor self-PATCHing 100 km is not a hole: resolveRingRadii() clamps
  // to their 30 km cap on every read, so nothing downstream ever sees the 100.
  await reset();
  await asVendor(vendorUid);
  const r = await db.query<{ reach_ring2_km: number }>(
    `UPDATE public.vendor_profiles SET reach_ring2_km = 100 WHERE user_id = $1
      RETURNING reach_ring2_km`,
    [vendorUid],
  );
  assert.equal(r.rows[0]!.reach_ring2_km, 100);
  await reset();
});
