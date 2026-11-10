/**
 * THE SAYSAY DEMO SHOP IS DELETED — and nothing else is.
 * Migration 20271336539756_delete_saysay_demo_shop (owner, 2026-11-11:
 * "Delete permanently").
 *
 * The replay has already applied the migration once, against a database where
 * the shop never existed — so the first property (a no-op on a fresh replay) is
 * proven before any test runs. Each test below then seeds rows and re-executes
 * the migration file verbatim.
 *
 *   1. A NON-demo row with this uuid makes the migration RAISE and survive.
 *   2. With the shop flagged demo and carrying children, the shop and every row
 *      that exists only because of it are gone — while the owner's account, the
 *      couple's event, the booking ON that event with its logged payment
 *      (unlinked, not deleted — SUP-67), and a second, real shop are untouched.
 *   3. A re-run after the delete changes nothing and does not fail.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

const SHOP = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310';
const MIGRATION = readFileSync(
  path.join(MIGRATIONS_DIR, '20271336539756_delete_saysay_demo_shop.sql'),
  'utf8',
);

let replay: ReplayResult;
let db: PGlite;

const F = {
  owner: '',
  couple: '',
  otherOwner: '',
  eventId: '',
  otherShop: '',
  otherCard: '',
  shopCard: '',
  bookingOnEvent: '',
  bookingNoEvent: '',
  otherBooking: '',
  threadId: '',
  dependentId: '',
};

let seq = 0;
const uniq = () => `saysay-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return u.rows[0]!.id;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) x`, params);
  return r.rows[0]!.n;
}

async function setDemo(id: string, isDemo: boolean): Promise<void> {
  await db.exec('SET session_replication_role = replica');
  await db.query(`UPDATE public.vendor_profiles SET is_demo = $2 WHERE vendor_profile_id = $1`, [id, isDemo]);
  await db.exec('SET session_replication_role = DEFAULT');
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.owner = await newUser(); // the testnayan2 stand-in
  F.couple = await newUser();
  F.otherOwner = await newUser();

  // The shop, at its real uuid — NOT a demo yet (test 1 needs that).
  await db.query(
    `INSERT INTO public.vendor_profiles (vendor_profile_id, user_id, business_name)
     VALUES ($1, $2, 'Saysay Host and Band')`,
    [SHOP, F.owner],
  );
  // A second, real shop that must survive.
  F.otherShop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Someone Else Band')
       RETURNING vendor_profile_id`,
      [F.otherOwner],
    )
  ).rows[0]!.vendor_profile_id;

  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
       VALUES ('Ana & Miguel', 'wedding', 'civil', 'garden') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  F.shopCard = await insertLiveCard(db, { vendor_profile_id: SHOP, category: 'photographer', starting_price_php: 35000 });
  F.otherCard = await insertLiveCard(db, { vendor_profile_id: F.otherShop, category: 'photographer', starting_price_php: 30000 });
});

after(async () => {
  await db?.close();
});

test('a NON-demo row with this uuid makes the migration refuse — and survive', async () => {
  await setDemo(SHOP, false);
  await assert.rejects(() => db.exec(MIGRATION), /NOT a demo shop/);
  assert.equal(await count(`SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [SHOP]), 1);
  assert.equal(await count(`SELECT 1 FROM public.vendor_services WHERE vendor_service_id = $1`, [F.shopCard]), 1);
});

test('the demo shop and its own rows go; shared parents and the other shop stay', async () => {
  await setDemo(SHOP, true);

  // Children seeded as the table owner with triggers off — the prod rows were
  // written before today's demo-pairing guards, so they would refuse a re-insert.
  await db.exec('SET session_replication_role = replica');
  await db.query(`INSERT INTO public.vendor_follows (follower_user_id, vendor_profile_id) VALUES ($1, $2), ($1, $3)`, [
    F.couple,
    SHOP,
    F.otherShop,
  ]);
  F.threadId = (
    await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
      [F.eventId, SHOP, F.couple],
    )
  ).rows[0]!.thread_id;
  await db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
     VALUES ($1, $2, $3, $4, 'couple', 'Hello po')`,
    [F.threadId, F.eventId, SHOP, F.couple],
  );
  // The booking ON the couple's event, with a logged payment (must survive, unlinked).
  F.bookingOnEvent = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors
         (event_id, vendor_name, category, status, source, marketplace_vendor_id, linked_vendor_profile_id, service_id)
       VALUES ($1, 'Saysay Host and Band', 'band_dj', 'contracted', 'host_manual', $2, $2, $3)
       RETURNING vendor_id`,
      [F.eventId, SHOP, F.shopCard],
    )
  ).rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 5000, 'GCash')`,
    [F.eventId, F.bookingOnEvent],
  );
  // The booking row that belongs to no event (must go).
  F.bookingNoEvent = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
       VALUES (NULL, 'Saysay Live Band (SONGDESK TEST)', 'band_dj', 'contracted', $1) RETURNING vendor_id`,
      [SHOP],
    )
  ).rows[0]!.vendor_id;
  // The other shop's booking on the same event (must stay linked).
  F.otherBooking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, source, marketplace_vendor_id)
       VALUES ($1, 'Someone Else Band', 'band_dj', 'contracted', 'host_manual', $2) RETURNING vendor_id`,
      [F.eventId, F.otherShop],
    )
  ).rows[0]!.vendor_id;
  F.dependentId = (
    await db.query<{ dependent_id: string }>(
      `INSERT INTO public.dependents (owner_user_id, name, dependent_kind, vendor_profile_id)
       VALUES ($1, 'Saysay Host and Band', 'business', $2) RETURNING dependent_id`,
      [F.owner, SHOP],
    )
  ).rows[0]!.dependent_id;
  await db.query(
    `INSERT INTO public.vendor_service_price_history (vendor_profile_id, vendor_service_id, category, old_price_php, new_price_php)
     VALUES ($1, $2, 'photographer', 30000, 35000), ($3, $4, 'photographer', 25000, 30000)`,
    [SHOP, F.shopCard, F.otherShop, F.otherCard],
  );
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [SHOP, F.owner],
  );
  await db.exec('SET session_replication_role = DEFAULT');

  await db.exec(MIGRATION);

  // ── gone ──
  assert.equal(await count(`SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [SHOP]), 0, 'shop');
  assert.equal(await count(`SELECT 1 FROM public.vendor_services WHERE vendor_profile_id = $1`, [SHOP]), 0, 'its cards');
  assert.equal(await count(`SELECT 1 FROM public.vendor_service_inclusions WHERE vendor_service_id = $1`, [F.shopCard]), 0, 'its card inclusions');
  assert.equal(await count(`SELECT 1 FROM public.vendor_team_members WHERE vendor_profile_id = $1`, [SHOP]), 0, 'its seat');
  assert.equal(await count(`SELECT 1 FROM public.vendor_follows WHERE vendor_profile_id = $1`, [SHOP]), 0, 'its follows');
  assert.equal(await count(`SELECT 1 FROM public.chat_threads WHERE thread_id = $1`, [F.threadId]), 0, 'its thread');
  assert.equal(await count(`SELECT 1 FROM public.chat_messages WHERE thread_id = $1`, [F.threadId]), 0, 'its messages');
  assert.equal(await count(`SELECT 1 FROM public.event_vendors WHERE vendor_id = $1`, [F.bookingNoEvent]), 0, 'event-less booking');
  assert.equal(await count(`SELECT 1 FROM public.dependents WHERE dependent_id = $1`, [F.dependentId]), 0, 'business dependent');
  assert.equal(await count(`SELECT 1 FROM public.vendor_service_price_history WHERE vendor_profile_id = $1`, [SHOP]), 0, 'price history');

  // ── stays ──
  assert.equal(await count(`SELECT 1 FROM auth.users WHERE id = $1`, [F.owner]), 1, 'owner account');
  assert.equal(await count(`SELECT 1 FROM public.users WHERE user_id = $1`, [F.owner]), 1, 'owner profile');
  assert.equal(await count(`SELECT 1 FROM public.events WHERE event_id = $1`, [F.eventId]), 1, 'the couple event');
  const kept = await db.query<{ marketplace_vendor_id: string | null; linked_vendor_profile_id: string | null; service_id: string | null; vendor_name: string }>(
    `SELECT marketplace_vendor_id, linked_vendor_profile_id, service_id, vendor_name FROM public.event_vendors WHERE vendor_id = $1`,
    [F.bookingOnEvent],
  );
  assert.equal(kept.rows.length, 1, 'the booking on the event is kept');
  assert.equal(kept.rows[0]!.marketplace_vendor_id, null);
  assert.equal(kept.rows[0]!.linked_vendor_profile_id, null);
  assert.equal(kept.rows[0]!.service_id, null);
  assert.equal(kept.rows[0]!.vendor_name, 'Saysay Host and Band');
  assert.equal(await count(`SELECT 1 FROM public.event_vendor_payments WHERE vendor_id = $1`, [F.bookingOnEvent]), 1, 'the logged payment');

  assert.equal(await count(`SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.otherShop]), 1, 'other shop');
  assert.equal(await count(`SELECT 1 FROM public.vendor_services WHERE vendor_service_id = $1`, [F.otherCard]), 1, 'other card');
  assert.equal(await count(`SELECT 1 FROM public.vendor_follows WHERE vendor_profile_id = $1`, [F.otherShop]), 1, 'other follow');
  assert.equal(
    await count(`SELECT 1 FROM public.event_vendors WHERE vendor_id = $1 AND marketplace_vendor_id = $2`, [F.otherBooking, F.otherShop]),
    1,
    'other booking still linked',
  );
  assert.equal(await count(`SELECT 1 FROM public.vendor_service_price_history WHERE vendor_profile_id = $1`, [F.otherShop]), 1, 'other price history');
});

test('a re-run after the delete is a no-op', async () => {
  await db.exec(MIGRATION);
  assert.equal(await count(`SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [SHOP]), 0);
  assert.equal(await count(`SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.otherShop]), 1);
});
