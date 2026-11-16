/**
 * THE SHORTLIST QR IS NOT AN IMPORT · AN IMPORTED CLIENT IS NOT A COMPLETED BOOKING (owner 2026-11-16).
 *
 *  1 · ⟲ SUPERSEDED the same day by 1abf35b: the Shortlist QR (`vendor_shortlist_qr`) is an IMPORT QR under the
 *      first-supplier rule — like the shop's own invite (`vendor_invite`), the first imported supplier on an event
 *      books free (verified shop, imported after verification). Was d7f4b97f "a booking from it pays the normal fee".
 *      (Every fee case, including the two new Shortlist QR ones, also runs in `add-your-own-fee-rule.db.test.ts`.)
 *  2 · fd5814dc (3) — a client the supplier brought in (`vendor_invite` · `vendor_locked_qr` · `reuse_accept`) does
 *      not count toward the Completed bookings badge (`vendor_public_completed_events_stats`), while the supplier's
 *      own count (`vendor_full_completed_events_stats`) still shows every finished job.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`shortlist-qr-${n}@example.com`],
  );
  return u.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const userId = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Shortlist QR Studio', 'Manila', ARRAY['photography']::text[], 'verified', TIMESTAMPTZ '2020-01-01', 'verified')
     RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** One event, its couple, and one row for `shop` with this `source` and `status`. */
async function rowFor(shop: string, source: string | null, status: 'considering' | 'complete'): Promise<string> {
  const couple = await newUser();
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Shortlist QR Day', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id, source)
     VALUES ($1,'photographer','Shortlist QR Studio',$3::vendor_status,$2,$2,$4)`,
    [eventId, shop, status, source],
  );
  return eventId;
}

async function attribution(shop: string, eventId: string): Promise<string> {
  const r = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

test('1abf35b — the Shortlist QR is an import QR: as the first import on an event it books free, like the own invite', async () => {
  const shop = await newShop();
  const viaShortlistQr = await rowFor(shop, 'vendor_shortlist_qr', 'considering');
  const viaOwnInvite = await rowFor(shop, 'vendor_invite', 'considering');
  assert.equal(await attribution(shop, viaShortlistQr), 'import', 'the Shortlist QR is not an import QR');
  assert.equal(await attribution(shop, viaOwnInvite), 'import', 'the supplier’s own invite pays the fee as a first import');
});

test('a client the supplier brought in does not count toward Completed bookings; the supplier’s own count keeps them', async () => {
  const shop = await newShop();
  for (const s of ['host_marketplace_search', null, 'vendor_shortlist_qr']) await rowFor(shop, s, 'complete');
  for (const s of ['vendor_invite', 'vendor_locked_qr', 'reuse_accept']) await rowFor(shop, s, 'complete');

  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats`);
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats`);
  const r = await db.query<{ pub: number; full: number }>(
    `SELECT
       (SELECT public_completed_count FROM public.vendor_public_completed_events_stats WHERE vendor_profile_id=$1)::int AS pub,
       (SELECT full_completed_count FROM public.vendor_full_completed_events_stats WHERE vendor_profile_id=$1)::int AS full`,
    [shop],
  );
  assert.equal(r.rows[0]!.pub, 3, 'the Completed bookings badge counts a client the supplier brought in');
  assert.equal(r.rows[0]!.full, 6, 'the supplier’s own finished-jobs count lost a job');
});

test('the rebuilt badge count keeps its grants: read-only to the public, never writable', async () => {
  const r = await db.query<{ anon_sel: boolean; anon_ins: boolean; auth_sel: boolean }>(
    `SELECT has_table_privilege('anon','public.vendor_public_completed_events_stats','SELECT') AS anon_sel,
            has_table_privilege('anon','public.vendor_public_completed_events_stats','INSERT') AS anon_ins,
            has_table_privilege('authenticated','public.vendor_public_completed_events_stats','SELECT') AS auth_sel`,
  );
  assert.deepEqual(r.rows[0], { anon_sel: true, anon_ins: false, auth_sel: true });
  const f = await db.query<{ anon: boolean }>(
    `SELECT has_function_privilege('anon','public.booking_fee_attribution_for(uuid,uuid)','EXECUTE') AS anon`,
  );
  assert.equal(f.rows[0]!.anon, false, 'the public can ask who brought a couple');
});
