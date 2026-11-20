/**
 * 🤝 TRUST SHOWS ONLY AFTER A COMPLETED, PAID BOOKING — asserted against the DATABASE
 * (migration 20271356577600, `shop_qualified_trust` · `shop_qualified_trust_counts` ·
 * `shop_completed_paid_booking_counts`).
 *
 * Owner, 21 Nov 2026 (specs DECISION_LOG):
 *   · "A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE COMPLETED, PAID BOOKING" — the link is made at once; the
 *     trust shows (Trusted by · Partners as trusted · the search count) only once THAT shop has a booking delivered
 *     with its payment received, through Setnayan. Refunded, cancelled, internal or test bookings never count. Each
 *     side follows the same rule.
 *   · "TRUSTED SHOPS RANK HIGHER IN SEARCH" (3) — only a live two-way partnership with a VERIFIED, published shop
 *     that is not internal or test counts; a shop's own branches never count; each shop counts once.
 *
 *   1 · a WAITING shop (linked, verified, no completed paid booking) is not shown and not counted;
 *   2 · a QUALIFIED shop is shown and counted;
 *   3 · refunded · cancelled · test · internal · unpaid · supplier-brought bookings do not qualify;
 *   4 · a shop's own branch (the same business) never counts;
 *   5 · mutual: each side follows the same rule, independently;
 *   6 · each shop counts once, however many partnership kinds the pair holds;
 *   7 · the other shop must be verified, not demo, and not internal; a pending link does not count;
 *   8 · the three readers are not callable by a signed-in supplier.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

type Shop = { uid: string; vp: string };
let seq = 0;

async function mkUser(email: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
}

async function mkShop(
  name: string,
  opts: { verified?: boolean; demo?: boolean; internal?: boolean; phone?: string } = {},
): Promise<Shop> {
  const n = ++seq;
  const uid = await mkUser(`trust-shop-${n}@example.test`);
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,$3,'Manila',ARRAY['florist']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
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
  if (opts.demo) await db.query(`UPDATE public.vendor_profiles SET is_demo = TRUE WHERE vendor_profile_id = $1`, [vp]);
  if (opts.phone) await db.query(`UPDATE public.vendor_profiles SET contact_phone = $2 WHERE vendor_profile_id = $1`, [vp, opts.phone]);
  if (opts.internal) await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [uid]);
  return { uid, vp };
}

type BookingOpts = {
  status?: 'contracted' | 'delivered' | 'complete';
  paid?: boolean;
  refunded?: boolean;
  cancelled?: boolean;
  sample?: boolean;
  internalCouple?: boolean;
  source?: string;
};

/** One booking of `shop` on a fresh event with its own couple. Defaults: delivered, paid and confirmed. */
async function book(shop: Shop, o: BookingOpts = {}): Promise<void> {
  const n = ++seq;
  const couple = await mkUser(`trust-couple-${n}@example.test`);
  if (o.internalCouple) await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [couple]);
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ($1, 'wedding', 'catholic', 'banquet_hall', '2026-06-01'::date, 'day') RETURNING event_id`,
      [`Trust event ${n}`],
    )
  ).rows[0]!.event_id;
  if (o.sample) await db.query(`UPDATE public.events SET is_sample = TRUE WHERE event_id = $1`, [eventId]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  const bookingId = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, source)
       VALUES ($1,'florist','x',$2,10000,$3,$4) RETURNING vendor_id`,
      [eventId, o.status ?? 'delivered', shop.vp, o.source ?? 'host_marketplace_search'],
    )
  ).rows[0]!.vendor_id;
  if (o.paid !== false) {
    await db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, paid_at, vendor_confirmed_at)
       VALUES ($1,$2,5000,'GCash',NOW(),NOW())`,
      [eventId, bookingId],
    );
  }
  if (o.refunded) {
    await db.query(
      `INSERT INTO public.event_vendor_refunds (event_id, event_vendor_id, vendor_profile_id, amount_php, refunded_on, reason)
       VALUES ($1,$2,$3,5000,'2026-06-10','Refund')`,
      [eventId, bookingId, shop.vp],
    );
  }
  if (o.cancelled) {
    await db.query(`UPDATE public.event_vendors SET delete_request_state = 'agreed' WHERE vendor_id = $1`, [bookingId]);
  }
}

/** A live two-way partnership (an accepted, active row — written as an invite join is). */
async function link(a: Shop, b: Shop, kind = 'general', status: 'accepted' | 'proposed' = 'accepted'): Promise<void> {
  const origin = status === 'accepted' ? 'invited' : 'added';
  await db.query(
    `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, accepted_at, origin)
     VALUES ($1,$2,$3,$4,true,$5,$6)`,
    [a.vp, b.vp, kind, status, status === 'accepted' ? new Date().toISOString() : null, origin],
  );
}

async function trustedBy(shop: Shop): Promise<string[]> {
  return (
    await db.query<{ trusting_vendor_profile_id: string }>(
      `SELECT trusting_vendor_profile_id FROM public.shop_qualified_trust(ARRAY[$1]::uuid[]) ORDER BY 1`,
      [shop.vp],
    )
  ).rows.map((r) => r.trusting_vendor_profile_id);
}

async function count(shop: Shop): Promise<number> {
  const r = await db.query<{ trusted_by: number }>(
    `SELECT trusted_by FROM public.shop_qualified_trust_counts(ARRAY[$1]::uuid[])`,
    [shop.vp],
  );
  return r.rows[0]?.trusted_by ?? 0;
}

async function paidBookings(shop: Shop): Promise<number> {
  const r = await db.query<{ bookings: number }>(
    `SELECT bookings FROM public.shop_completed_paid_booking_counts(ARRAY[$1]::uuid[])`,
    [shop.vp],
  );
  return r.rows[0]?.bookings ?? 0;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
});

after(async () => {
  await db?.close();
});

test('1 · a waiting shop — linked, verified, no completed paid booking — is not shown and not counted', async () => {
  const me = await mkShop('Me waiting');
  const waiting = await mkShop('Waiting florist');
  await link(me, waiting);
  await book(waiting, { status: 'contracted' }); // booked, not delivered yet
  assert.deepEqual(await trustedBy(me), []);
  assert.equal(await count(me), 0);
});

test('2 · a qualified shop is shown and counted', async () => {
  const me = await mkShop('Me qualified');
  const good = await mkShop('Good florist');
  await link(me, good);
  await book(good);
  assert.equal(await paidBookings(good), 1);
  assert.deepEqual(await trustedBy(me), [good.vp]);
  assert.equal(await count(me), 1);
});

test('3 · refunded, cancelled, internal, unpaid and supplier-brought bookings do not qualify (test: see 7)', async () => {
  const cases: Array<[string, BookingOpts]> = [
    ['refunded', { refunded: true }],
    ['cancelled', { cancelled: true }],
    ['internal couple', { internalCouple: true }],
    ['unpaid', { paid: false }],
    ['supplier-brought client', { source: 'vendor_invite' }],
  ];
  for (const [label, opts] of cases) {
    const me = await mkShop(`Me ${label}`);
    const other = await mkShop(`Other ${label}`);
    await link(me, other);
    await book(other, opts);
    assert.equal(await paidBookings(other), 0, `${label}: not a completed paid booking`);
    assert.deepEqual(await trustedBy(me), [], `${label}: not shown`);
    assert.equal(await count(me), 0, `${label}: not counted`);
  }
});

test('3b · a refused payment is not money received', async () => {
  const me = await mkShop('Me refused');
  const other = await mkShop('Other refused');
  await link(me, other);
  await book(other, { paid: false });
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, paid_at, vendor_confirmed_at, payment_refused_at)
     SELECT ev.event_id, ev.vendor_id, 5000, 'GCash', NOW(), NULL, NOW() FROM public.event_vendors ev WHERE ev.marketplace_vendor_id = $1`,
    [other.vp],
  );
  assert.equal(await paidBookings(other), 0);
  assert.equal(await count(me), 0);
});

test("4 · a shop's own branch (the same business) never counts", async () => {
  const me = await mkShop('Me main', { phone: '0917 555 0101' });
  const branch = await mkShop('Me branch', { phone: '+63 917 555 0101' });
  await link(me, branch);
  await book(branch);
  assert.equal(await paidBookings(branch), 1, 'the branch has a real booking');
  assert.deepEqual(await trustedBy(me), [], 'yet it never trusts its own business');
  assert.equal(await count(me), 0);
  // …and a team member's own shop is the same people.
  const me2 = await mkShop('Me with team');
  const mate = await mkShop('Team mate shop');
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1,$2,'admin')`, [
    me2.vp,
    mate.uid,
  ]);
  await link(me2, mate);
  await book(mate);
  assert.equal(await count(me2), 0);
});

test('5 · mutual: each side follows the same rule, independently', async () => {
  const a = await mkShop('Mutual A');
  const b = await mkShop('Mutual B');
  await link(a, b);
  await book(b);
  // B qualifies, A does not yet: B shows on A's page; A is still waiting on B's.
  assert.deepEqual(await trustedBy(a), [b.vp]);
  assert.deepEqual(await trustedBy(b), []);
  await book(a);
  assert.deepEqual(await trustedBy(b), [a.vp], 'once A qualifies, A shows on B');
  // Asked together, each side is answered by the same rule.
  const both = (
    await db.query<{ vendor_profile_id: string; trusted_by: number }>(
      `SELECT vendor_profile_id, trusted_by FROM public.shop_qualified_trust_counts(ARRAY[$1,$2]::uuid[])`,
      [a.vp, b.vp],
    )
  ).rows;
  assert.deepEqual(
    new Map(both.map((r) => [r.vendor_profile_id, r.trusted_by])),
    new Map([
      [a.vp, 1],
      [b.vp, 1],
    ]),
  );
});

test('6 · each shop counts once, however many kinds the pair holds and however many bookings it has', async () => {
  const me = await mkShop('Me once');
  const other = await mkShop('Other once');
  await link(me, other, 'general');
  await link(me, other, 'accredited');
  await book(other);
  await book(other);
  assert.equal(await paidBookings(other), 2);
  assert.equal(await count(me), 1);
  const row = (
    await db.query<{ relationship_types: string[]; made_by_this_shop: boolean }>(
      `SELECT relationship_types, made_by_this_shop FROM public.shop_qualified_trust(ARRAY[$1]::uuid[])`,
      [me.vp],
    )
  ).rows;
  assert.equal(row.length, 1);
  assert.deepEqual([...row[0]!.relationship_types].sort(), ['accredited', 'general']);
  assert.equal(row[0]!.made_by_this_shop, true);
});

test('7 · unverified, demo and internal shops never count; a pending link does not count', async () => {
  for (const [label, opts] of [
    ['unverified', { verified: false }],
    ['demo', { demo: true }],
    ['internal', { internal: true }],
  ] as const) {
    const me = await mkShop(`Me vs ${label}`);
    const other = await mkShop(`Other ${label}`, opts);
    await link(me, other);
    // A demo shop can only be booked on a sample (test) event — the database refuses a cross booking — so its
    // booking is a TEST booking and never counts either.
    await book(other, { sample: label === 'demo' });
    if (label === 'demo') assert.equal(await paidBookings(other), 0, 'a test booking is not a completed paid booking');
    assert.equal(await count(me), 0, `${label} shop does not count`);
  }
  const me = await mkShop('Me pending');
  const other = await mkShop('Other pending');
  await link(me, other, 'general', 'proposed');
  await book(other);
  assert.equal(await count(me), 0, 'a pending "+ Add" is a link, not trust');
});

test('8 · the readers are not callable by a signed-in supplier or anon', async () => {
  const me = await mkShop('Me signed in');
  for (const role of ['authenticated', 'anon'] as const) {
    await setAuthUid(db, role === 'authenticated' ? me.uid : null);
    await db.exec(`SET ROLE ${role}`);
    for (const fn of ['shop_qualified_trust', 'shop_qualified_trust_counts', 'shop_completed_paid_booking_counts']) {
      await assert.rejects(
        db.query(`SELECT * FROM public.${fn}(ARRAY[$1]::uuid[])`, [me.vp]),
        /permission denied/,
        `${role} cannot call ${fn}`,
      );
    }
    await asOwner();
  }
});
