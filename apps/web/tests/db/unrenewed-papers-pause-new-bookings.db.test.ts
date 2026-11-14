/**
 * AFTER 30 MARCH, AN UNRENEWED SHOP DROPS OUT OF SEARCH AND DISCOVER AND KEEPS
 * EVERYTHING ELSE — migration 20271345631375 (owner answer B on PR #7624,
 * corrected by DECISION_LOG 481b9b6b).
 *
 * Proves, on the replayed schema:
 *   1. an EXISTING booking keeps working after the lapse — a confirmed row can still
 *      move along (contracted → deposit_paid → delivered), and the shop is still
 *      readable through the public policy (verification_state was never touched);
 *   2. an ask made BEFORE the lapse may still be answered (considering → contracted);
 *   3. the booking trigger does NOT read the stamp (the inquired-before-lapse path is
 *      unconfirmed, so it stays as today);
 *   4. renewing (clearing the stamp) restores the shop to the lists:
 *      `papers_current` reads true;
 *   5. a shop cannot clear (or set) its own stamp;
 *   6. `papers_current` follows the stamp and the marketplace view carries it.
 *
 * Synthetic shops and events only.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function newShop(email: string): Promise<{ vendorId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Lapse Test Shop', 'Pasig', ARRAY['photography']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return { vendorId: v.rows[0]!.vendor_profile_id, userId: u.rows[0]!.id };
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Lapse Test Event', 'birthday') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}

async function ask(eventId: string, vendorId: string, status: string, createdAt?: string): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, created_at)
     VALUES ($1, 'photographer', 'Lapse Test Shop', $2::public.vendor_status, $3, COALESCE($4::timestamptz, NOW()))
     RETURNING vendor_id`,
    [eventId, status, vendorId, createdAt ?? null],
  );
  return r.rows[0]!.vendor_id;
}

async function setStatus(eventVendorId: string, status: string): Promise<string | null> {
  try {
    await db.query(`UPDATE public.event_vendors SET status = $2::public.vendor_status WHERE vendor_id = $1`, [
      eventVendorId,
      status,
    ]);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function lapse(vendorId: string, at: string): Promise<void> {
  await db.query(`UPDATE public.vendor_profiles SET papers_lapsed_at = $2::timestamptz WHERE vendor_profile_id = $1`, [
    vendorId,
    at,
  ]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
});

after(async () => {
  await db?.close();
});

test('1 · an EXISTING booking keeps working after the lapse, and the shop stays readable', async () => {
  const { vendorId } = await newShop('existing@lapse.test');
  const event = await newEvent();
  const booked = await ask(event, vendorId, 'contracted');
  await lapse(vendorId, new Date().toISOString());
  for (const next of ['deposit_paid', 'delivered']) {
    assert.equal(await setStatus(booked, next), null, `an existing booking must still move to ${next}`);
  }
  const state = await db.query<{ verification_state: string; public_visibility: string }>(
    `SELECT verification_state::text, public_visibility::text FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(state.rows[0]!.verification_state, 'verified', 'the lapse never changes verification_state');
  assert.equal(state.rows[0]!.public_visibility, 'verified');
  // …so the public read policy (which the couple's session reads through) still shows it.
  await db.query(`SET ROLE anon`);
  try {
    const seen = await db.query(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vendorId]);
    assert.equal(seen.rows.length, 1, 'the couple can still read the shop they booked');
  } finally {
    await db.query(`RESET ROLE`);
  }
});

test('2 · an ask made BEFORE the lapse may still be answered', async () => {
  const { vendorId } = await newShop('before@lapse.test');
  const event = await newEvent();
  const pending = await ask(event, vendorId, 'considering', '2027-03-20T00:00:00Z');
  await lapse(vendorId, '2027-03-30T16:00:00Z');
  assert.equal(await setStatus(pending, 'contracted'), null, 'the supplier’s yes to an older ask goes through');
});

test('3 · the booking trigger does NOT read the stamp — booking stays exactly as it is today (481b9b6b)', async () => {
  // Owner 2026-11-14 (DECISION_LOG 481b9b6b): a lapsed shop only drops out of search and Discover. Whether an event
  // that inquired before the lapse can still be booked after it is UNCONFIRMED, so that path is left as it is today:
  // the trigger does not read papers_lapsed_at at all — an ask before OR after the stamp books like any other.
  const { vendorId } = await newShop('new@lapse.test');
  await lapse(vendorId, '2027-03-30T16:00:00Z');
  const event = await newEvent();
  const later = await ask(event, vendorId, 'considering', '2027-04-02T00:00:00Z');
  assert.equal(await setStatus(later, 'contracted'), null, 'the trigger refused on the papers stamp');
  const src = await db.query<{ src: string }>(
    `SELECT prosrc AS src FROM pg_proc WHERE proname = 'enforce_booking_requires_verified_vendor'`,
  );
  assert.ok(!/papers_lapsed/.test(src.rows[0]!.src), 'the booking trigger reads the papers stamp');
});

test('4 · renewing restores the shop at once', async () => {
  const { vendorId } = await newShop('renew@lapse.test');
  await lapse(vendorId, '2027-03-30T16:00:00Z');
  const before = await db.query<{ papers_current: boolean }>(
    `SELECT papers_current FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(before.rows[0]!.papers_current, false);
  await db.query(`UPDATE public.vendor_profiles SET papers_lapsed_at = NULL WHERE vendor_profile_id = $1`, [vendorId]);
  const afterRow = await db.query<{ papers_current: boolean }>(
    `SELECT papers_current FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(afterRow.rows[0]!.papers_current, true);
  const event = await newEvent();
  await ask(event, vendorId, 'contracted'); // no throw: bookable again
});

test('5 · a shop cannot clear — or set — its own stamp', async () => {
  const { vendorId, userId } = await newShop('self@lapse.test');
  await lapse(vendorId, '2027-03-30T16:00:00Z');
  await setAuthUid(db, userId);
  await db.query(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`UPDATE public.vendor_profiles SET papers_lapsed_at = NULL WHERE vendor_profile_id = $1`, [vendorId]),
      /set by Setnayan only/,
    );
  } finally {
    await db.query(`RESET ROLE`);
    await setAuthUid(db, null);
  }
  const { vendorId: other, userId: otherUser } = await newShop('self2@lapse.test');
  await setAuthUid(db, otherUser);
  await db.query(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`UPDATE public.vendor_profiles SET papers_lapsed_at = NOW() WHERE vendor_profile_id = $1`, [other]),
      /set by Setnayan only/,
    );
  } finally {
    await db.query(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

test('6 · the marketplace view carries papers_current', async () => {
  const { vendorId } = await newShop('view@lapse.test');
  await lapse(vendorId, '2027-03-30T16:00:00Z');
  const r = await db.query<{ papers_current: boolean }>(
    `SELECT papers_current FROM public.vendor_market_stats WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(r.rows[0]!.papers_current, false);
});
