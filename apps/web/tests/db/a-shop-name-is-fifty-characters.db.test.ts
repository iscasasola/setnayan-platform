/**
 * A SHOP NAME IS 50 CHARACTERS — migration 20271320245383, against the REPLAYED schema.
 *
 * Owner ruling 2026-11-06: "50 characters". The boxes and the server writers refuse past `SHOP_NAME_MAX`
 * (lib/business-slug.ts — held by app/open-shop/the-shop-name-is-fifty-characters.test.ts); this file proves the
 * floor under them:
 *
 *   1 · the database itself refuses a 51-character shop name, on INSERT and on UPDATE, and keeps a 50;
 *   2 · the couple's own record of a supplier stays FREE TEXT (`event_manual_vendors` takes 70);
 *   3 · a supplier claiming from the couple's link where the couple typed 70 characters is NOT refused — the claim
 *       (`claim_ready_the_shop`) clips the name to the first 50 and the shop opens;
 *   4 · the same for Setnayan's own invite (`claim_ready_the_invited_shop`) when nothing was staged.
 *
 * 🛡 Sabotaged, each red then restored (2026-11-06):
 *   • the CHECK removed from the migration                                → test 1 red;
 *   • the `left(…, 50)` removed from `claim_ready_the_shop`              → test 3 red (the claim fails on the CHECK);
 *   • the `left(…, 50)` removed from `claim_ready_the_invited_shop`      → test 4 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { SHOP_NAME_MAX } from '../../lib/business-slug';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

const SEVENTY = 'Tita Lorna’s Home-Cooked Kakanin, Lechon and Catering Services of Bulacan';

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asServer(): Promise<void> {
  await asOwner();
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
}

async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function shopName(shop: string): Promise<string | null> {
  await asOwner();
  const r = await db.query<{ b: string | null }>(
    `SELECT business_name AS b FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]?.b ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the TS constant and the CHECK agree: 50', () => {
  assert.equal(SHOP_NAME_MAX, 50);
  assert.ok(SEVENTY.length > SHOP_NAME_MAX, 'the fixture must be longer than the cap to prove anything');
});

test('the database refuses a 51-character shop name and keeps a 50', async () => {
  await asOwner();
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_profiles (user_id, business_name) VALUES (NULL, $1)`, ['x'.repeat(51)]),
    /vendor_profiles_business_name_max_50/,
  );
  const ok = await db.query<{ v: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES (NULL, $1) RETURNING vendor_profile_id AS v`,
    ['x'.repeat(50)],
  );
  const id = ok.rows[0]!.v;
  assert.equal((await shopName(id))?.length, 50);
  await assert.rejects(
    db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [id, 'y'.repeat(51)]),
    /vendor_profiles_business_name_max_50/,
  );
  assert.equal(await shopName(id), 'x'.repeat(50), 'a refused rename changed the name');
});

test('the couple’s own record stays free text — only SHOPS are 50', async () => {
  await asOwner();
  const e = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
     VALUES ('Free Text Wedding', 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
  );
  const r = await db.query<{ b: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number)
     VALUES ($1, $2, 'Tita Lorna', '09170000000') RETURNING business_name AS b`,
    [e.rows[0]!.e, SEVENTY],
  );
  assert.equal(r.rows[0]!.b, SEVENTY);
});

test('a claim from the couple’s link with a 70-character name is NOT refused — it is clipped to 50', async () => {
  const host = await signUp('host-long@example.ph', 'customer');
  await asOwner();
  const e = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
     VALUES ('Long Name Wedding', 'wedding', 'catholic', 'banquet_hall', DATE '2027-03-14') RETURNING event_id AS e`,
  );
  const eventId = e.rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    host,
  ]);
  const row = await db.query<{ id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, source)
     VALUES ($1, 'catering', $2, 'considering', 'host_manual') RETURNING vendor_id AS id`,
    [eventId, SEVENTY],
  );
  const token = `long-claim-${++n}`;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
     VALUES ($1, $2, NULL, $3, 'catering', $4, 'pending', 'auto_share_link', now() + interval '90 days')`,
    [row.rows[0]!.id, host, SEVENTY, token],
  );

  // The vendor sign-up's trigger opens an EMPTY shop first — the usual case the claim fills.
  const supplier = await signUp('long-supplier@example.ph', 'vendor');
  await asServer();
  const shop = (
    await db.query<{ s: string }>(`SELECT public.claim_ready_the_shop($1, $2) AS s`, [supplier, token])
  ).rows[0]!.s;
  assert.equal(await shopName(shop), SEVENTY.slice(0, 50).trim());
});

test('Setnayan’s own invite with a long name (nothing staged) opens the shop with the first 50', async () => {
  const admin = await signUp('ops-long@setnayan.test', 'customer');
  const token = `long-admin-${++n}`;
  await asOwner();
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
     VALUES (NULL, $1, 'long-admin-invitee@example.ph', $2, 'catering', $3, 'pending', 'admin', now() + interval '90 days')`,
    [admin, SEVENTY, token],
  );
  // Arrived as a customer: no shop at all, nothing staged → the invite's own name opens one.
  const claimant = await signUp('long-admin-invitee@example.ph', 'customer');
  await asServer();
  const shop = (
    await db.query<{ s: string }>(`SELECT public.claim_ready_the_invited_shop($1, $2) AS s`, [claimant, token])
  ).rows[0]!.s;
  assert.equal(await shopName(shop), SEVENTY.slice(0, 50).trim());
});
