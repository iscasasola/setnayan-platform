/**
 * 🤝 TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER — asserted against the DATABASE
 * (migration 20271361607663: `booking_counts_for_trust` · the narrowed `vendor_served_together_rows` · `shop_trust` ·
 * `shop_trust_counts` · `platform_settings.trust_search_step`).
 *
 * Owner, 21 Nov 2026 (specs DECISION_LOG):
 *   · "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER" — *"we need the both of you to be in the
 *     same event."* One shop's booking elsewhere does not count. Refunded, cancelled, internal and test never count.
 *   · Drawing v7 + the controller's call: a NEW shop made through the link is trusted at once, and counts for search
 *     only after its first completed, paid booking.
 *   · "TRUSTED SHOPS RANK HIGHER IN SEARCH" — verified, published shops only; own branches never; each shop once;
 *     diminishing returns from an admin number left blank for the owner.
 *
 *   1 · a partner with no event together waits — not trusted, not counted;
 *   2 · two shops that served one event, both completed and paid, trust each other (mutual) and count;
 *   3 · each shop's own completed, paid booking on DIFFERENT events is not "together";
 *   4 · refunded · cancelled · unpaid · not arm's length · internal couple — on either side — keep them waiting;
 *   5 · a new shop made through the link is trusted at once and counts only after its first completed, paid booking;
 *       an existing shop that joined through the link waits like any other;
 *   6 · a same-business shop and an unverified shop can be trusted, but never count;
 *   7 · each shop once; the counts and the search step (blank → 0; 2 → 1·2·4; 3 → 1·3);
 *   8 · the narrowed rule reaches the propose trigger: an unpaid shared event no longer lets two shops link;
 *   9 · none of it is callable by a signed-in supplier.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { completedAndPaid } from './counts-for-trust';
import { foundOnSetnayan } from './found-on-setnayan';

let replay: ReplayResult;
let db: ReplayResult['db'];
let seq = 0;

type Shop = { uid: string; vp: string };

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function mkUser(email: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
}

async function mkShop(name: string, opts: { verified?: boolean; phone?: string } = {}): Promise<Shop> {
  const n = ++seq;
  const uid = await mkUser(`trust-shop-${n}@example.test`);
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,$3,'Manila',ARRAY['florist']::text[],'verified', NOW() - INTERVAL '365 days') RETURNING vendor_profile_id`,
      [uid, name, `trust-shop-${n}`],
    )
  ).rows[0]!.vendor_profile_id;
  if (opts.verified === false) {
    await db.query(
      `UPDATE public.vendor_profiles SET verification_state = 'unverified', public_visibility = 'hidden' WHERE vendor_profile_id = $1`,
      [vp],
    );
  } else {
    await db.query(`UPDATE public.vendor_profiles SET public_visibility = 'verified' WHERE vendor_profile_id = $1`, [vp]);
  }
  if (opts.phone) await db.query(`UPDATE public.vendor_profiles SET contact_phone = $2 WHERE vendor_profile_id = $1`, [vp, opts.phone]);
  return { uid, vp };
}

/** A past event with its own couple. */
async function mkEvent(opts: { internalCouple?: boolean } = {}): Promise<string> {
  const n = ++seq;
  const couple = await mkUser(`trust-couple-${n}@example.test`);
  if (opts.internalCouple) await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [couple]);
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ($1, 'wedding', 'catholic', 'banquet_hall', '2024-03-15'::date, 'day') RETURNING event_id`,
      [`Trust event ${n}`],
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  return eventId;
}

type Spoil = 'refunded' | 'cancelled' | 'unpaid' | 'not_found_here';

/** `shop` booked on `eventId` — completed and paid through Setnayan unless a `spoil` says otherwise. */
async function served(eventId: string, shop: Shop, spoil: Spoil | null = null): Promise<string> {
  const bookingId = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, source)
       VALUES ($1,'florist','x','delivered',10000,$2,$3) RETURNING vendor_id`,
      // A client the supplier brought in (its own invite) is not found on Setnayan; a marketplace search is.
      [eventId, shop.vp, spoil === 'not_found_here' ? 'vendor_invite' : 'host_marketplace_search'],
    )
  ).rows[0]!.vendor_id;
  if (spoil !== 'unpaid') {
    await db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, paid_at, vendor_confirmed_at)
       VALUES ($1,$2,5000,'GCash',NOW(),NOW())`,
      [eventId, bookingId],
    );
  }
  if (spoil !== 'not_found_here') await foundOnSetnayan(db, shop.vp, eventId);
  if (spoil === 'refunded') {
    await db.query(
      `INSERT INTO public.event_vendor_refunds (event_id, event_vendor_id, vendor_profile_id, amount_php, refunded_on, reason)
       VALUES ($1,$2,$3,5000,'2024-03-20','Refund')`,
      [eventId, bookingId, shop.vp],
    );
  }
  if (spoil === 'cancelled') {
    await db.query(`UPDATE public.event_vendors SET delete_request_state = 'agreed' WHERE vendor_id = $1`, [bookingId]);
  }
  return bookingId;
}

/** A live partnership — an accepted, active row. `added` by hand unless an invite says otherwise. */
async function link(a: Shop, b: Shop, o: { origin?: 'added' | 'invited'; newShop?: boolean; kind?: string } = {}): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_partnerships
       (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, accepted_at, origin, brought_new_shop)
     VALUES ($1,$2,$3,'accepted',true,NOW(),$4,$5)`,
    [a.vp, b.vp, o.kind ?? 'general', o.origin ?? 'added', !!o.newShop],
  );
}

type TrustRow = { other_vendor_profile_id: string; trusted: boolean; counts: boolean; events_together: number };

async function trustOf(shop: Shop, other: Shop): Promise<TrustRow | null> {
  const r = await db.query<TrustRow>(
    `SELECT other_vendor_profile_id, trusted, counts, events_together
       FROM public.shop_trust(ARRAY[$1]::uuid[]) WHERE other_vendor_profile_id = $2`,
    [shop.vp, other.vp],
  );
  return r.rows[0] ?? null;
}

type Counts = { trusted: number; waiting: number; counted: number; search_step: number };
async function countsOf(shop: Shop): Promise<Counts> {
  const r = await db.query<Counts>(
    `SELECT trusted, waiting, counted, search_step FROM public.shop_trust_counts(ARRAY[$1]::uuid[])`,
    [shop.vp],
  );
  return r.rows[0] ?? { trusted: 0, waiting: 0, counted: 0, search_step: 0 };
}

async function setStep(base: number | null): Promise<void> {
  await db.query(`UPDATE public.platform_settings SET trust_search_step = $1 WHERE id = 1`, [base]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
});

after(async () => {
  await db?.close();
});

test('1 · a partner with no event together waits — not trusted, not counted', async () => {
  const me = await mkShop('Me waiting');
  const other = await mkShop('Partner waiting');
  await link(me, other);
  const row = await trustOf(me, other);
  assert.ok(row, 'the partner is listed');
  assert.equal(row.trusted, false);
  assert.equal(row.counts, false);
  assert.deepEqual(await countsOf(me), { trusted: 0, waiting: 1, counted: 0, search_step: 0 });
});

test('2 · one event served together, both completed and paid — trusted both ways, and counted', async () => {
  const me = await mkShop('Me together');
  const other = await mkShop('Partner together');
  await link(me, other);
  const ev = await mkEvent();
  await served(ev, me);
  await served(ev, other);
  for (const [a, b] of [[me, other], [other, me]] as const) {
    const row = await trustOf(a, b);
    assert.ok(row);
    assert.equal(row.trusted, true, 'trust is mutual');
    assert.equal(row.counts, true);
    assert.equal(row.events_together, 1);
  }
});

test('3 · each shop paid on a DIFFERENT event is not "together"', async () => {
  const me = await mkShop('Me apart');
  const other = await mkShop('Partner apart');
  await link(me, other);
  await served(await mkEvent(), me);
  await served(await mkEvent(), other);
  const row = await trustOf(me, other);
  assert.equal(row?.trusted, false, "one shop's booking elsewhere does not count");
  assert.equal(row?.counts, false);
});

test('4 · refunded, cancelled, unpaid, not arm\'s length, internal couple — on either side — keep them waiting', async () => {
  for (const spoil of ['refunded', 'cancelled', 'unpaid', 'not_found_here'] as const) {
    for (const side of ['mine', 'theirs'] as const) {
      const me = await mkShop(`Me ${spoil} ${side}`);
      const other = await mkShop(`Partner ${spoil} ${side}`);
      await link(me, other);
      const ev = await mkEvent();
      await served(ev, me, side === 'mine' ? spoil : null);
      await served(ev, other, side === 'theirs' ? spoil : null);
      assert.equal((await trustOf(me, other))?.trusted, false, `${spoil} on ${side} side`);
    }
  }
  const me = await mkShop('Me internal');
  const other = await mkShop('Partner internal');
  await link(me, other);
  const ev = await mkEvent({ internalCouple: true });
  await served(ev, me);
  await served(ev, other);
  assert.equal((await trustOf(me, other))?.trusted, false, 'an internal couple is not a real event');
});

test('5 · a NEW shop from the link is trusted at once, and counts only after its first completed, paid booking', async () => {
  const inviter = await mkShop('Inviter');
  const fresh = await mkShop('New through the link');
  await link(inviter, fresh, { origin: 'invited', newShop: true });
  for (const [a, b] of [[inviter, fresh], [fresh, inviter]] as const) {
    const row = await trustOf(a, b);
    assert.equal(row?.trusted, true, 'trusted at once, both ways');
    assert.equal(row?.counts, false, 'no search lift yet');
  }
  // Its first completed, paid booking — on any event, with anyone.
  const ev = await mkEvent();
  await served(ev, fresh);
  assert.equal((await trustOf(inviter, fresh))?.counts, true);
  assert.equal((await trustOf(fresh, inviter))?.counts, true);
  const r = await db.query<{ brought_new_shop: boolean }>(
    `SELECT brought_new_shop FROM public.shop_trust(ARRAY[$1]::uuid[]) WHERE other_vendor_profile_id = $2`,
    [inviter.vp, fresh.vp],
  );
  assert.equal(r.rows[0]?.brought_new_shop, true, 'the inviter brought the new shop');

  // An EXISTING shop that joined through the link waits like any other partner.
  const existing = await mkShop('Already here');
  await link(inviter, existing, { origin: 'invited', newShop: false });
  assert.equal((await trustOf(inviter, existing))?.trusted, false);
});

test('6 · a same-business shop and an unverified shop can be trusted, but never count', async () => {
  const me = await mkShop('Me branchy', { phone: '+639170000001' });
  const sister = await mkShop('Sister shop', { phone: '+639170000001' });
  await link(me, sister);
  const ev = await mkEvent();
  await served(ev, me);
  await served(ev, sister);
  const s = await trustOf(me, sister);
  assert.equal(s?.trusted, true);
  assert.equal(s?.counts, false, "a shop's own branches never count");

  const inviter = await mkShop('Inviter of unverified');
  const unverified = await mkShop('Not verified yet', { verified: false });
  await link(inviter, unverified, { origin: 'invited', newShop: true });
  const u = await trustOf(inviter, unverified);
  assert.equal(u?.trusted, true);
  assert.equal(u?.counts, false, 'an unverified shop never counts');
});

test('7 · each shop once; the counts and the search step from the admin number', async () => {
  const me = await mkShop('Me popular');
  const others = [await mkShop('P1'), await mkShop('P2'), await mkShop('P3'), await mkShop('P4')];
  const ev = await mkEvent();
  await served(ev, me);
  for (const o of others) {
    await served(ev, o);
    await link(me, o);
  }
  // A second kind for one pair is still one shop.
  await link(others[0]!, me, { kind: 'accredited' });
  const waiter = await mkShop('P waiting');
  await link(me, waiter);

  await setStep(null);
  assert.deepEqual(await countsOf(me), { trusted: 4, waiting: 1, counted: 4, search_step: 0 }, 'blank → trust lifts nobody');
  await setStep(2);
  assert.equal((await countsOf(me)).search_step, 3, '4 reaches 1 · 2 · 4');
  await setStep(3);
  assert.equal((await countsOf(me)).search_step, 2, '4 reaches 1 · 3');
  await assert.rejects(setStep(1), /trust_search_step_range/);
  await setStep(null);
});

test('8 · the propose trigger reads the narrowed rule: an unpaid shared event no longer lets two shops link', async () => {
  const a = await mkShop('Proposer');
  const b = await mkShop('Unpaid partner');
  const c = await mkShop('Paid partner');
  const ev = await mkEvent();
  await served(ev, a);
  await served(ev, b, 'unpaid');
  await served(ev, c);
  await asUser(a.uid);
  try {
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active)
         VALUES ($1,$2,'general','proposed',true)`,
        [a.vp, b.vp],
      ),
      /NOT_SERVED_TOGETHER/,
    );
    await db.query(
      `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active)
       VALUES ($1,$2,'general','proposed',true)`,
      [a.vp, c.vp],
    );
  } finally {
    await asOwner();
  }
});

test('9 · none of it is callable by a signed-in supplier', async () => {
  const me = await mkShop('Me signed in');
  await asUser(me.uid);
  try {
    for (const sql of [
      `SELECT * FROM public.shop_trust(ARRAY[$1]::uuid[])`,
      `SELECT * FROM public.shop_trust_counts(ARRAY[$1]::uuid[])`,
      `SELECT public.booking_counts_for_trust($1)`,
      `SELECT * FROM public.vendor_served_together_rows($1)`,
    ]) {
      await assert.rejects(db.query(sql, [me.vp]), /permission denied/, sql);
    }
  } finally {
    await asOwner();
  }
});
