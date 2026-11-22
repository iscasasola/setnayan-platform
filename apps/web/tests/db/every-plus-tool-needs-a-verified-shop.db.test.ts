/**
 * EVERY ＋ TOOL NEEDS A VERIFIED SHOP — the database half (migration 20271357625672).
 *
 * ⚖ Owner 21 Nov 2026, the ＋ drawing's "Gates": *"every ＋ tool needs the shop at least Verified, with a server check on
 *   every send"*. Four ＋ tools write from the BROWSER under the person's own session — a poll, a decision, a plan /
 *   change ask, and a dropped offer — so the trigger is their server check.
 *
 * Measured as real `authenticated` sessions on the replayed schema:
 *   · the supplier of an UNVERIFIED shop is refused on all four, with PLUS_NEEDS_VERIFIED, and nothing is written;
 *   · the same supplier passes the moment the shop is verified;
 *   · the HOST passes on an unverified shop's thread (the gate is the shop's, never the couple's);
 *   · a server write (no signed-in caller) passes;
 *   · an ordinary chat line from an unverified shop still sends (only an offer drop is gated on chat_messages).
 *
 * Run (from apps/web): tsx --test tests/db/every-plus-tool-needs-a-verified-shop.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const FILE = '20271357625672_every_plus_tool_needs_a_verified_shop.sql';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(reset);

async function setClaimRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setClaimRole(null).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setClaimRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function attempt(uid: string, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await as(uid, fn);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
const one = async <T>(sql: string, args: unknown[] = []) => (await db.query<T>(sql, args)).rows[0]!;

let seq = 0;
const uniq = () => `pv-${++seq}`;
async function newUser(): Promise<string> {
  const r = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.id;
}

type World = { eventId: string; host: string; supplier: string; shop: string; threadId: string; offerId: number };
async function newWorld(state: 'verified' | 'unverified'): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const shop = (
    await one<{ v: string }>(
      state === 'verified'
        ? `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
           VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`
        : `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
           VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
      [supplier, `Shop ${uniq()}`],
    )
  ).v;
  const eventId = (
    await one<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2099-12-12', 'day') RETURNING event_id AS e`,
    )
  ).e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const threadId = (
    await one<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, host],
    )
  ).t;
  const offerId = (
    await one<{ id: number }>(`INSERT INTO public.vendor_offers (vendor_profile_id, name, pct_off) VALUES ($1, 'Weekday', 10) RETURNING id`, [shop])
  ).id;
  return { eventId, host, supplier, shop, threadId, offerId };
}

const poll = (w: World) => db.query(`SELECT public.chat_poll_open($1, 'Where?', ARRAY['Garden','Chapel']::text[])`, [w.threadId]);
const decision = (w: World) => db.query(`SELECT public.chat_decision_open($1, 'Venue')`, [w.threadId]);
const dropOffer = (w: World) =>
  db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, vendor_offer_id, offer_good_until)
     VALUES ($1, $2, $3, '🏷 Offer', $4, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7)`,
    [w.threadId, w.eventId, w.shop, w.offerId],
  );
const line = (w: World) =>
  db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, 'Hello')`, [w.threadId, w.eventId, w.shop]);
const count = async (table: string, w: World) => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table} WHERE thread_id = $1`, [w.threadId])).n;

test('the migration is applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((x) => x.file === FILE), `${FILE} was skipped during replay`);
});

test('the four triggers are on their tables', async () => {
  const r = await db.query<{ tgname: string }>(
    `SELECT tgname FROM pg_trigger WHERE tgfoid = 'public.tg_chat_plus_needs_a_verified_shop()'::regprocedure ORDER BY tgname`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.tgname),
    [
      'booking_change_asks_plus_needs_a_verified_shop',
      'chat_decision_topics_plus_needs_a_verified_shop',
      'chat_messages_offer_needs_a_verified_shop',
      'chat_polls_plus_needs_a_verified_shop',
    ],
  );
});

test('an UNVERIFIED shop: its supplier is refused a poll, a decision and an offer drop — and nothing is written', async () => {
  const w = await newWorld('unverified');
  for (const fn of [poll, decision, dropOffer]) {
    const err = await attempt(w.supplier, () => fn(w));
    assert.match(err ?? '', /PLUS_NEEDS_VERIFIED/, `${fn === poll ? 'poll' : fn === decision ? 'decision' : 'offer'} was not refused`);
  }
  assert.equal(await count('chat_polls', w), 0);
  assert.equal(await count('chat_decision_topics', w), 0);
  const offers = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE thread_id = $1 AND vendor_offer_id IS NOT NULL`, [w.threadId]);
  assert.equal(offers.n, 0);
});

test('an UNVERIFIED shop: a plain chat line still sends (only the offer drop is gated on chat_messages)', async () => {
  const w = await newWorld('unverified');
  assert.equal(await attempt(w.supplier, () => line(w)), null);
});

test('a VERIFIED shop: the same supplier opens a poll, a decision and drops an offer', async () => {
  const w = await newWorld('verified');
  for (const fn of [poll, decision, dropOffer]) assert.equal(await attempt(w.supplier, () => fn(w)), null);
  assert.equal(await count('chat_polls', w), 1);
  assert.equal(await count('chat_decision_topics', w), 1);
});

test('verifying the shop opens the tools at once', async () => {
  const w = await newWorld('unverified');
  assert.match((await attempt(w.supplier, () => poll(w))) ?? '', /PLUS_NEEDS_VERIFIED/);
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW() WHERE vendor_profile_id = $1`, [w.shop]);
  assert.equal(await attempt(w.supplier, () => poll(w)), null);
});

test('the HOST is never gated by the shop — poll and decision pass on an unverified shop’s thread', async () => {
  const w = await newWorld('unverified');
  assert.equal(await attempt(w.host, () => poll(w)), null);
  assert.equal(await attempt(w.host, () => decision(w)), null);
});

test('a server write (no signed-in caller) passes', async () => {
  const w = await newWorld('unverified');
  await db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, vendor_offer_id, offer_good_until, sender_role)
     VALUES ($1, $2, $3, '🏷 Offer', $4, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, 'vendor')`,
    [w.threadId, w.eventId, w.shop, w.offerId],
  );
  const offers = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE thread_id = $1 AND vendor_offer_id IS NOT NULL`, [w.threadId]);
  assert.equal(offers.n, 1);
});

const row = (s: number, amount: number, auto = false) => ({
  seq: s, label: auto ? 'Final balance' : `Payment ${s + 1}`, kind: auto ? 'auto' : 'fixed', amount_centavos: amount, raw_centavos: amount,
  percent_bps: null, due: 'on_lock', offset_days: 0, is_downpayment: s === 0, is_auto_balance: auto, credit_applied_centavos: 0,
});
/** A sent quote written as the database owner (₱60,000: ₱20,000 now · ₱40,000 final). */
async function quote(w: World): Promise<string> {
  const rows = [row(0, 2_000_000), row(1, 4_000_000, true)];
  const plan = { version: 1, base_centavos: 6_000_000, credit_centavos: 0, total_centavos: 6_000_000, balances: true, over_by_centavos: 0, credit_over_centavos: 0, installments: rows };
  return (
    await one<{ p: string }>(
      `INSERT INTO public.vendor_proposals
         (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until, payment_schedule)
       VALUES ($1, $2, 'Full-day coverage', 'sent', 6000000, NOW(),
               jsonb_build_array(jsonb_build_object('label','Coverage','detail',NULL,'amount_centavos',6000000)),
               '{}'::jsonb, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, $3::jsonb)
       RETURNING proposal_id AS p`,
      [w.eventId, w.shop, JSON.stringify(plan)],
    )
  ).p;
}
const proposePlan = (w: World, p: string) =>
  db.query(`SELECT public.ask_for_a_change($1, 'plan', '', $2, NULL, NULL, NULL, $3::jsonb, NULL, NULL)`, [
    w.threadId,
    p,
    JSON.stringify({ installments: [row(0, 3_000_000), row(1, 3_000_000, true)] }),
  ]);

test('a payment-plan ask: refused for an unverified shop’s supplier, sent once the shop is verified', async () => {
  const unverified = await newWorld('unverified');
  const p1 = await quote(unverified);
  assert.match((await attempt(unverified.supplier, () => proposePlan(unverified, p1))) ?? '', /PLUS_NEEDS_VERIFIED/);
  assert.equal(await count('booking_change_asks', unverified), 0);

  const verified = await newWorld('verified');
  const p2 = await quote(verified);
  assert.equal(await attempt(verified.supplier, () => proposePlan(verified, p2)), null);
  assert.equal(await count('booking_change_asks', verified), 1);
});
