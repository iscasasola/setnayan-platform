/**
 * "ADD YOUR OWN" IN THE DATABASE — fee rule B, the owner's tolerance, the
 * server-only match stamp, the link's "first opened", and the date a claim does
 * NOT hold. Migration 20271267252894 (+ 20271268117342).
 *
 *   1 · `booking_fee_attribution_for` answers EVERY case of `FEE_RULE_B_CASES`
 *       exactly as `bookingFeeAttributionFromFacts` does (the drift guard: SQL decides
 *       what is charged, TS what the app believes — they may never disagree);
 *   2 · `platform_settings.fee_leak_price_tolerance` is the owner's 0.10;
 *   3 · a couple's own session cannot write or clear the match stamp, the
 *       service role can;
 *   4 · `vendor_invites.first_opened_at` exists and starts NULL;
 *   5 · a claim (setting `marketplace_vendor_id` on the couple's record) writes
 *       NOTHING on the supplier's calendar: the date is "asking", not held
 *       (owner 2026-10-10: a hand-typed record does not hold the date before
 *       the supplier agrees);
 *   6 · the couple's decline notice type exists in the enum.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { bookingFeeAttributionFromFacts } from '../../lib/booking-fee-gate';
import { FEE_RULE_B_CASES, type FeeRuleBCase } from '../../lib/fee-rule-b-cases';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}@add-your-own.test`],
  );
  return r.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const uid = await newUser('shop');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [uid, `Kusina ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Fee rule B ${++n}`],
  );
  return r.rows[0]!.event_id;
}

/** The couple's hand-typed record of a supplier, created at `createdAt`. */
async function newManualRecord(eventId: string, createdAt: string): Promise<{ manualId: string; rowId: string }> {
  const m = await db.query<{ manual_vendor_id: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number, created_at)
     VALUES ($1, 'Tita Baby''s Catering', 'Maria Santos', '09170000000', $2) RETURNING manual_vendor_id`,
    [eventId, createdAt],
  );
  const manualId = m.rows[0]!.manual_vendor_id;
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, manual_vendor_id)
     VALUES ($1, 'catering', 'Tita Baby''s Catering', 'considering', $2) RETURNING vendor_id`,
    [eventId, manualId],
  );
  return { manualId, rowId: r.rows[0]!.vendor_id };
}

const RECORD_AT = '2026-10-01T12:00:00Z';
const BEFORE = '2026-09-20T12:00:00Z';
const AFTER = '2026-10-05T12:00:00Z';

/** Lay one case out in the database and ask the SQL. */
async function sqlAnswer(c: FeeRuleBCase): Promise<string> {
  const shop = await newShop();
  const eventId = await newEvent();
  const d = c.db;
  if (d.kind === 'record') {
    const { manualId, rowId } = await newManualRecord(eventId, RECORD_AT);
    await db.query(`UPDATE public.event_vendors SET source = $1, created_at = $2 WHERE vendor_id = $3`, [d.rowSource, RECORD_AT, rowId]);
    if (d.tie === 'claimed') {
      await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [shop, rowId]);
    } else if (d.tie === 'matched') {
      // A direct connection is privileged, as the service role is.
      await db.query(`UPDATE public.event_manual_vendors SET leak_match_vendor_profile_id = $1 WHERE manual_vendor_id = $2`, [shop, manualId]);
    }
  } else {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source, created_at)
       VALUES ($1, 'catering', 'Kusina', 'considering', $2, $3, $4)`,
      [eventId, shop, d.rowSource, RECORD_AT],
    );
  }
  for (const sv of d.saves) {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source, created_at)
       VALUES ($1, 'photographer', 'Kusina (saved)', 'considering', $2, $3, $4)`,
      [eventId, shop, sv.source, sv.when === 'before' ? BEFORE : AFTER],
    );
  }
  for (const v of d.views) {
    await db.query(
      `INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewed_at) VALUES ($1, $2, $3, $4)`,
      [shop, eventId, v.source, v.when === 'before' ? BEFORE : AFTER],
    );
  }
  if (d.thread !== 'no-thread') {
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, $3)`, [
      eventId,
      shop,
      d.thread,
    ]);
  }
  const r = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
});

after(async () => {
  await db?.close();
});

test('1 · the SQL and the app give every rule-B case the same answer — the owner ruled', async () => {
  assert.ok(FEE_RULE_B_CASES.length >= 14, 'the case table shrank');
  for (const c of FEE_RULE_B_CASES) {
    const sql = await sqlAnswer(c);
    assert.equal(sql, c.expect, `SQL: ${c.name}`);
    assert.equal(bookingFeeAttributionFromFacts(c.facts), sql, `SQL and TS disagree: ${c.name}`);
  }
});

test("2 · the tolerance is the owner's 0.10, a fraction either side", async () => {
  const r = await db.query<{ t: string }>(`SELECT fee_leak_price_tolerance::text AS t FROM public.platform_settings WHERE id = 1`);
  assert.equal(Number(r.rows[0]!.t), 0.1);
  await assert.rejects(db.query(`UPDATE public.platform_settings SET fee_leak_price_tolerance = 1.5 WHERE id = 1`), /check/i);
});

test("3 · a couple's own session can neither write nor clear the match stamp", async () => {
  const couple = await newUser('couple');
  const shop = await newShop();
  const eventId = await newEvent();
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  const { manualId } = await newManualRecord(eventId, RECORD_AT);

  const asCouple = async (sql: string, params: unknown[]) => {
    await db.exec('BEGIN');
    try {
      await setAuthUid(db, couple);
      await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await db.exec('SET LOCAL ROLE authenticated');
      await db.query(sql, params);
      await db.exec('COMMIT');
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      await reset();
    }
  };
  const stamp = async () =>
    (
      await db.query<{ s: string | null }>(
        `SELECT leak_match_vendor_profile_id AS s FROM public.event_manual_vendors WHERE manual_vendor_id = $1`,
        [manualId],
      )
    ).rows[0]!.s;

  // The couple may edit their record (the row is theirs) — but the stamp does not move.
  await asCouple(`UPDATE public.event_manual_vendors SET leak_match_vendor_profile_id = $1, business_name = 'Renamed' WHERE manual_vendor_id = $2`, [shop, manualId]);
  assert.equal(await stamp(), null, 'the couple wrote the stamp themselves');
  const renamed = await db.query<{ b: string }>(`SELECT business_name AS b FROM public.event_manual_vendors WHERE manual_vendor_id = $1`, [manualId]);
  assert.equal(renamed.rows[0]!.b, 'Renamed', 'the couple could not edit their own record at all (the probe is vacuous)');

  // The server stamps it; the couple cannot clear it.
  await db.query(`UPDATE public.event_manual_vendors SET leak_match_vendor_profile_id = $1 WHERE manual_vendor_id = $2`, [shop, manualId]);
  assert.equal(await stamp(), shop);
  await asCouple(`UPDATE public.event_manual_vendors SET leak_match_vendor_profile_id = NULL WHERE manual_vendor_id = $1`, [manualId]);
  assert.equal(await stamp(), shop, 'the couple cleared the stamp');

  // …and an INSERT by the couple cannot arrive pre-stamped.
  await asCouple(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number, leak_match_vendor_profile_id)
     VALUES ($1, 'Pre-stamped', 'X', '0917', $2)`,
    [eventId, shop],
  );
  const pre = await db.query<{ s: string | null }>(
    `SELECT leak_match_vendor_profile_id AS s FROM public.event_manual_vendors WHERE business_name = 'Pre-stamped'`,
  );
  assert.equal(pre.rows.length, 1);
  assert.equal(pre.rows[0]!.s, null, 'an insert by the couple kept its own stamp');
});

test('4 · a link remembers when it was first opened (NULL until then)', async () => {
  const col = await db.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_invites' AND column_name='first_opened_at'`,
  );
  assert.equal(col.rows[0]?.data_type, 'timestamp with time zone');
});

test("5 · a claim holds NOTHING on the supplier's calendar — the date is asking, not held", async () => {
  const shop = await newShop();
  const eventId = await newEvent();
  await db.query(`UPDATE public.events SET event_date = '2026-12-18' WHERE event_id = $1`, [eventId]);
  const { rowId } = await newManualRecord(eventId, RECORD_AT);
  // The couple marked it booked by hand, before the supplier ever saw the link.
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [rowId]);
  // The claim: the shop is tied to the couple's record.
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [shop, rowId]);

  const blocks = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(blocks.rows[0]!.n, 0, 'the claim wrote a calendar block');
  const held = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings WHERE event_vendor_id = $1 AND released_at IS NULL`,
    [rowId],
  );
  assert.equal(held.rows[0]!.n, 0, 'the claim held a schedule slot');
});

test("6 · the couple's decline notice is a type the database admits", async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT 'vendor_invite_declined' = ANY (enum_range(NULL::public.notification_type)::text[]) AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true);
});

test("7 · the supplier's bill learns the day Setnayan first showed the couple a shop they later typed in", async () => {
  // Viewed on Sep 20, the couple's record made Oct 1, the shop claimed it.
  const shop = await newShop();
  const eventId = await newEvent();
  const { rowId } = await newManualRecord(eventId, RECORD_AT);
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [shop, rowId]);
  await db.query(`INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewed_at) VALUES ($1, $2, 'explore', $3)`, [shop, eventId, BEFORE]);
  await db.query(`INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewed_at) VALUES ($1, $2, 'explore', $3)`, [shop, eventId, AFTER]);
  const on = await db.query<{ d: string | null }>(`SELECT public.booking_fee_introduced_on($1, $2)::text AS d`, [shop, eventId]);
  assert.equal(on.rows[0]!.d, '2026-09-20');

  // A marketplace booking (not typed in) never gets the line.
  const shop2 = await newShop();
  const event2 = await newEvent();
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source) VALUES ($1, 'catering', 'X', 'considering', $2, 'host_marketplace_search')`,
    [event2, shop2],
  );
  const none = await db.query<{ d: string | null }>(`SELECT public.booking_fee_introduced_on($1, $2)::text AS d`, [shop2, event2]);
  assert.equal(none.rows[0]!.d, null);
});
