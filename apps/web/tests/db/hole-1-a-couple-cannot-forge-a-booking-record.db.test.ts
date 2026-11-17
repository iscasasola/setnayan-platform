/**
 * HOLE 1 · A COUPLE CANNOT FORGE A BOOKING RECORD — CLOSED (controller sweep 2026-11-16; proof was #7841's
 * `hole-1-a-couple-can-forge-a-booking-record.db.test.ts`, every HOLE OPEN assertion flipped here to CLOSED).
 *
 * The fix is `guard_event_vendor_provenance` (migration 20271349022603): for an ordinary signed-in writer, `source`
 * is never a supplier-brought value and is only filled, never rewritten; `marketplace_vendor_id` never moves;
 * `linked_vendor_profile_id` is NULL or the row's own shop; a shop row is never born delivered/complete and never
 * written complete directly.
 *
 * And the couple's REAL flows still work (the second half of this file) — a guard that also refuses booking is not a
 * fix. Remove the trigger and every CLOSED test goes red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid } from './replay-migrations';

let db: PGlite;
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
  await reset();
});
after(async () => {
  await db?.close();
});

async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

async function asCouple(uid: string): Promise<void> {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
}

async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}@hole-1.test`],
  );
  return r.rows[0]!.id;
}

/** A live, verified, publicly listed shop owned by somebody else. */
async function newShop(): Promise<string> {
  const owner = await newUser('shop');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [owner, `Kusina ni Juan ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newCoupleEvent(couple: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Hole 1 ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    couple,
  ]);
  return eventId;
}

async function publicCompleted(shop: string): Promise<number> {
  await reset();
  await db.exec('REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats');
  const r = await db.query<{ c: number }>(
    `SELECT public_completed_count AS c FROM public.vendor_public_completed_events_stats WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]?.c ?? 0;
}

async function loopCount(shop: string): Promise<number> {
  await reset();
  const r = await db.query<{ c: number }>(`SELECT public.shop_booked_loop_count($1) AS c`, [shop]);
  return r.rows[0]!.c;
}

async function refused(p: Promise<unknown>): Promise<string> {
  return p.then(() => 'written').catch((e: Error & { code?: string }) => e.code ?? e.message);
}

test('CLOSED · 1a — a couple cannot INSERT a finished booking with another shop, and nothing is counted', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const events = [await newCoupleEvent(couple), await newCoupleEvent(couple)];

  for (const eventId of events) {
    for (const status of ['complete', 'delivered']) {
      await asCouple(couple);
      const out = await refused(
        db.query(
          `INSERT INTO public.event_vendors
             (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id, source)
           VALUES ($1, 'catering', 'Kusina ni Juan', $3, $2, $2, 'host_marketplace_search')`,
          [eventId, shop, status],
        ),
      );
      await reset();
      assert.equal(out, '42501', `a ${status} booking with a shop was written by the couple`);
    }
  }
  assert.equal(await publicCompleted(shop), 0, 'vendor_public_completed_events_stats counts nothing forged');
  assert.equal(await loopCount(shop), 0, 'shop_booked_loop_count counts nothing forged');
});

test('CLOSED · 1b — a couple cannot UPDATE their own plain row into another shop\'s delivered booking', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const eventId = await newCoupleEvent(couple);
  const before = await publicCompleted(shop);

  await asCouple(couple);
  const ins = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1, 'catering', 'Just a name I typed', 'considering') RETURNING vendor_id`,
    [eventId],
  );
  const rowId = ins.rows[0]!.vendor_id;
  const out = await refused(
    db.query(
      `UPDATE public.event_vendors
          SET marketplace_vendor_id = $2, linked_vendor_profile_id = $2,
              source = 'host_marketplace_search', status = 'delivered'
        WHERE vendor_id = $1`,
      [rowId, shop],
    ),
  );
  // Each half on its own is refused too: the repoint, and a link to a shop the row was not saved from.
  const repoint = await refused(db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $2 WHERE vendor_id = $1`, [rowId, shop]));
  const link = await refused(db.query(`UPDATE public.event_vendors SET linked_vendor_profile_id = $2 WHERE vendor_id = $1`, [rowId, shop]));
  await reset();

  assert.equal(out, '42501', 'the repoint + delivered update was written');
  assert.equal(repoint, '42501', 'marketplace_vendor_id was moved');
  assert.equal(link, '42501', 'the row was linked to a shop it was not saved from');
  const r = await db.query<{ m: string | null; l: string | null }>(
    `SELECT marketplace_vendor_id AS m, linked_vendor_profile_id AS l FROM public.event_vendors WHERE vendor_id = $1`,
    [rowId],
  );
  assert.deepEqual(r.rows[0], { m: null, l: null });
  assert.equal(await publicCompleted(shop), before, 'nothing was added to the shop\'s finished jobs');
});

test('CLOSED · 1c — a couple cannot relabel a Setnayan-sourced booking as the supplier\'s own; the fee stays sourced', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const eventId = await newCoupleEvent(couple);

  await asCouple(couple);
  const ins = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'catering', 'Kusina ni Juan', 'considering', $2, 'host_marketplace_search') RETURNING vendor_id`,
    [eventId, shop],
  );
  const rowId = ins.rows[0]!.vendor_id;
  await reset();
  const attr = async () =>
    (await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId])).rows[0]!.a;
  assert.equal(await attr(), 'sourced', 'precondition: a save from Find is Setnayan-sourced');

  await asCouple(couple);
  const rewrite = await refused(db.query(`UPDATE public.event_vendors SET source = 'vendor_invite' WHERE vendor_id = $1`, [rowId]));
  const other = await refused(db.query(`UPDATE public.event_vendors SET source = 'host_manual' WHERE vendor_id = $1`, [rowId]));
  const born = await refused(
    db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
       VALUES ($1, 'catering', 'Kusina ni Juan', 'considering', $2, 'vendor_locked_qr')`,
      [eventId, shop],
    ),
  );
  await reset();

  assert.equal(rewrite, '42501', 'source was rewritten to the supplier\'s invite');
  assert.equal(other, '42501', 'source was rewritten at all');
  assert.equal(born, '42501', 'a row was born with a supplier-brought source');
  assert.equal(await attr(), 'sourced', 'booking_fee_attribution_for still reads Setnayan-sourced');
});

/* ── the couple's real flows still work ── */

test('STILL WORKS · save from Find → book it yourself → hand-over → revert', async () => {
  const shop = await newShop();
  const second = await newShop();
  const couple = await newUser('couple');
  const eventId = await newCoupleEvent(couple);

  await asCouple(couple);
  try {
  // attachMarketplaceVendorToCategory / inquiry: a shop saved from Find, source chosen by the surface.
  const ins = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'catering', 'Kusina ni Juan', 'considering', $2, 'host_marketplace_search') RETURNING vendor_id`,
    [eventId, shop],
  );
  const id = ins.rows[0]!.vendor_id;
  // finalizeVendor / chat "book" (lock handshake flag off): contracted + linked to its own shop.
  await db.query(`UPDATE public.event_vendors SET status = 'contracted', linked_vendor_profile_id = $2 WHERE vendor_id = $1`, [id, shop]);
  // acknowledgeHandover → delivered.
  await db.query(`UPDATE public.event_vendors SET status = 'delivered' WHERE vendor_id = $1`, [id]);
  // revertVendorToConsidering: clears the link.
  await db.query(`UPDATE public.event_vendors SET status = 'considering', linked_vendor_profile_id = NULL WHERE vendor_id = $1`, [id]);
  // the wizard / lockPackage: a shop row INSERTed straight to contracted.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'photographer', 'Liwanag Studio', 'contracted', $2, 'host_marketplace_search')`,
    [eventId, second],
  );
  // a typed supplier the couple paid themselves: contracted, no shop.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, source) VALUES ($1, 'florist', 'Tita Baby', 'contracted', 'host_manual')`,
    [eventId],
  );
  } finally {
    await reset();
  }
});

test('STILL WORKS · an inquiry fills an EMPTY source from the thread', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const eventId = await newCoupleEvent(couple);
  await asCouple(couple);
  const ins = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering', 'Kusina ni Juan', 'considering', $2) RETURNING vendor_id`,
    [eventId, shop],
  );
  await db.query(`UPDATE public.event_vendors SET source = 'shop_page' WHERE vendor_id = $1`, [ins.rows[0]!.vendor_id]);
  await reset();
  const r = await db.query<{ s: string }>(`SELECT source AS s FROM public.event_vendors WHERE vendor_id = $1`, [ins.rows[0]!.vendor_id]);
  assert.equal(r.rows[0]!.s, 'shop_page');
});

test('STILL WORKS · the server (service role / definer RPCs) is not held by the couple guard', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const eventId = await newCoupleEvent(couple);
  await reset(); // as the owner, like a SECURITY DEFINER RPC or the admin client
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id, source)
     VALUES ($1, 'catering', 'Kusina ni Juan', 'shortlisted', $2, $2, 'vendor_locked_qr')`,
    [eventId, shop],
  );
});
