/**
 * LIVE FAULTS RUN AS THEIR CALLERS — two database faults from app_telemetry_logs (read 23 Nov 2026), each held by
 * running the function AS THE ROLE PRODUCTION RUNS IT AS (the service role), not as the replay's superuser.
 *
 *   1 · `POST rpc/booking_fee_attribution_for` → 42501 "permission denied for table users" (admin client). Its arm
 *       `booking_fee_import_created_account` (20271353556136, owner Q1) joins `auth.users` for the couple's account
 *       age, as SECURITY INVOKER; production's `service_role` holds no SELECT on `auth.users` — nor does the replay's
 *       (only USAGE on the schema), which is why every earlier fee test, run as the superuser, passed.
 *       Migration 20271361773239 makes that one function SECURITY DEFINER, still locked to service_role.
 *   2 · `POST rpc/detect_inquiry_concentration` → 23502 NOT NULL (admin). Group chats (20271340374819) have no
 *       supplier; the detector counted them as inquiries to vendor NULL and inserted a flag with a NULL
 *       `subject_vendor_id`, failing the whole run. 20271361773239 counts only threads to a supplier.
 *
 * Shown red before the migration was added (see the PR body): (1) "permission denied for table users", (2) "null value
 * in column \"subject_vendor_id\"".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';

let db: PGlite;
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL
      WHERE id = 1`,
  );
});
after(async () => {
  await db?.close();
});

type Q = PGlite | Transaction;

async function newUser(q: Q, tag: string): Promise<string> {
  const r = await q.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}-${Date.now()}@live-faults.test`],
  );
  return r.rows[0]!.id;
}

async function newShop(q: Q): Promise<string> {
  const owner = await newUser(q, 'shop');
  const r = await q.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility, created_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW() - INTERVAL '1000 days', 'verified',
             NOW() - INTERVAL '1000 days')
     RETURNING vendor_profile_id`,
    [owner, `Live faults ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newEvent(q: Q, couple: string): Promise<string> {
  const r = await q.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, created_at)
     VALUES ($1, 'birthday', '2031-02-14', NOW() - INTERVAL '3 days') RETURNING event_id`,
    [`Live faults ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await q.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  return eventId;
}

/** Run `fn` as production's service role — the role the admin client's RPCs run as. */
async function asServiceRole<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE service_role`);
    return fn(tx);
  });
}

test('1 · the booking-fee attribution answers for the service role on an imported client (it read auth.users and was refused)', async () => {
  const shop = await newShop(db);
  const couple = await newUser(db, 'imported');
  const eventId = await newEvent(db, couple);
  // The shop's import brought the client: the first shop row on the event, before any chat.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, marketplace_vendor_id, category, vendor_name, status, source, total_cost_php, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'contracted'::vendor_status, 'vendor_invite', 100000, NOW() - INTERVAL '2 days')`,
    [eventId, shop],
  );
  const asOwner = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);

  const asService = await asServiceRole(async (tx) => {
    const created = await tx.query<{ c: boolean }>(`SELECT public.booking_fee_import_created_account($1, $2) AS c`, [shop, eventId]);
    const a = await tx.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
    return { created: created.rows[0]!.c, attribution: a.rows[0]!.a };
  });
  assert.equal(typeof asService.created, 'boolean');
  assert.equal(asService.attribution, asOwner.rows[0]!.a, 'the service role must get the same answer the owner gets');

  // …and the arm is still closed to everyone else: making it DEFINER must not open it.
  const grants = await db.query<{ anon: boolean; authed: boolean; service: boolean; definer: boolean }>(
    `SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service,
            p.prosecdef AS definer
       FROM pg_proc p WHERE p.oid = 'public.booking_fee_import_created_account(uuid,uuid)'::regprocedure`,
  );
  assert.deepEqual(grants.rows[0], { anon: false, authed: false, service: true, definer: true });
});

test('2 · a linked cluster in GROUP chats raises nothing (no supplier), and its inquiries to one supplier still raise a flag', async () => {
  const shop = await newShop(db);
  const address = `live-faults-${Date.now()}-${++n} rizal st`;
  const couples: string[] = [];
  for (let i = 0; i < 3; i++) {
    const couple = await newUser(db, `linked-${i}`);
    couples.push(couple);
    // One household address links the three accounts (`user_identity_signals` 'address').
    await db.query(`UPDATE public.users SET address_normalized = $2 WHERE user_id = $1`, [couple, address]);
    const eventId = await newEvent(db, couple);
    // A group chat on the event — no supplier (20271340374819).
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, kind, group_kind, group_name)
       VALUES ($1, NULL, $2, 'group', 'made', 'Family')`,
      [eventId, couple],
    );
  }
  await db.query(`REFRESH MATERIALIZED VIEW public.identity_clusters`);

  const groupsOnly = await asServiceRole(async (tx) => {
    const r = await tx.query<{ n: number }>(`SELECT public.detect_inquiry_concentration() AS n`);
    return Number(r.rows[0]!.n);
  });
  assert.equal(groupsOnly, 0, 'group chats are not inquiries to a supplier');

  // Now the same three linked accounts each inquire to ONE supplier — the signature the detector exists for.
  for (const couple of couples) {
    const ev = await db.query<{ event_id: string }>(
      `SELECT event_id FROM public.event_members WHERE user_id = $1 AND member_type = 'couple' LIMIT 1`,
      [couple],
    );
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`, [
      ev.rows[0]!.event_id,
      shop,
    ]);
  }
  const raised = await asServiceRole(async (tx) => {
    const r = await tx.query<{ n: number }>(`SELECT public.detect_inquiry_concentration() AS n`);
    return Number(r.rows[0]!.n);
  });
  assert.equal(raised, 1, 'one flag for (this supplier, this cluster)');
  const flag = await db.query<{ v: string | null }>(
    `SELECT subject_vendor_id AS v FROM public.integrity_flags WHERE kind = 'inquiry_concentration' AND subject_vendor_id = $1`,
    [shop],
  );
  assert.equal(flag.rows.length, 1);
});
