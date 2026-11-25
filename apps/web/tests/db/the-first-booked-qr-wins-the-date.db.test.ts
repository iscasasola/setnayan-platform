/**
 * THE FIRST REGISTERED BOOKED QR WINS THE DATE — A6-71 · LAUNCH L9 (owner ruling 25 Nov, LAUNCH-GATE.md L9;
 * migration first_registered_booked_qr_wins_the_date).
 *
 * Two booked (Locked) QR codes for one supplier date used to BOTH book it: the date was checked only when a code was
 * made, and the claim took its seat after writing the booking, degrading open. `vendor_claim_locked_qr` now decides the
 * date in step (0), in ONE transaction, before the token flips or anything is written.
 *
 * Proven against the replayed migrations:
 *   0. META — the claim takes the shop's schedule row FOR UPDATE, and does so BEFORE the single-use token flip, so a
 *      second claim on the same schedule waits for the first and then counts its seat.
 *   1. Two couples claim two codes for one single-place date at once → exactly one books; the other is told
 *      'date_full', books nothing, and its code stays pending (the supplier sees both and can move the second).
 *   2. A schedule that takes two a day books two claims and refuses the third.
 *   3. The code's service card limit is honoured — the card's own number per date (`service_card_daily_limit`; since
 *      18 Nov no plan ceiling sits over it, so the old "+1 booking per date" add-on raises nothing) — and the booking
 *      now carries its card (`service_id`) so the count sees it.
 *   4. An event that already holds the shop is not counted against itself (a re-claim of the same couple's booking).
 *   5. A booking that holds NO seat still takes the date: on a blocked day the first claim books seatless (its seat
 *      step degrades open) and the second claim for that date is refused.
 *   6. Only a COUPLE of the event may claim: a guest member is 'not_your_event' and nothing is written.
 *   7. An Always available card takes no seat and has no limit: two claims on one single-place date both book.
 *   8. OWNER RULING ADD 37 — "full" follows the claimed card's availability style, one case per style: day, order and
 *      night by the card's own number; piece by the pieces left; hour and time never full by the date; none never;
 *      no style set → today's shop schedule.
 *
 * Concurrency note: PGlite serves one connection, so the two claims in case 1 are sent together and run one after the
 * other. The FOR UPDATE asserted in case 0 is what makes the same outcome hold with two real connections in Postgres
 * (READ COMMITTED: the waiting claim counts again on a fresh statement after the lock is released).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;

let seq = 0;
type Shop = { uid: string; vpid: string; serviceId: string };
type Claim = { status: string; event_vendor_id?: string };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db.close();
});

async function mkUser(label: string, type: 'customer' | 'vendor'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [`${label}-${++seq}@first-wins.test`, type],
    )
  ).rows[0]!.id;
}

async function mkShop(label: string): Promise<Shop> {
  const uid = await mkUser(label, 'vendor');
  // A vendor account gets its shop row on sign-up; fill that one in (the house fixture shape), else make it.
  const existing = (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]))
    .rows[0]?.v;
  const vpid =
    existing ??
    (await db.query<{ v: string }>(`INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id AS v`, [uid, label]))
      .rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = $2, location_city = 'Manila', services = ARRAY['photography']::text[],
            verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'
      WHERE vendor_profile_id = $1`,
    [vpid, label],
  );
  // The card the codes name. `resolve_schedule_pool` only creates a pool for a category the shop really sells.
  const serviceId = (
    await db.query<{ id: string }>(
      `WITH s AS (
         INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
         VALUES ($1, 'photographer', 40000, 'Free extra hour', '${FIXTURE_COVER}')
         RETURNING vendor_service_id, vendor_profile_id
       ), i AS (
         INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
         SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
       )
       SELECT vendor_service_id AS id FROM s`,
      [vpid],
    )
  ).rows[0]!.id;
  return { uid, vpid, serviceId };
}

async function mkCoupleEvent(label: string): Promise<{ uid: string; eventId: string }> {
  const uid = await mkUser(label, 'customer');
  const eventId = (
    await db.query<{ id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
       VALUES ($1, 'wedding', 'catholic', 'garden') RETURNING event_id AS id`,
      [label],
    )
  ).rows[0]!.id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, uid]);
  return { uid, eventId };
}

async function mkToken(shop: Shop, day: string, withCard = true): Promise<string> {
  return (
    await db.query<{ token: string }>(
      `INSERT INTO public.vendor_locked_qr_tokens (
         vendor_profile_id, created_by_user_id, event_type, category, vendor_service_id,
         service_description, event_date, total_php, initial_paid_php, schedule_json
       ) VALUES ($1, $2, 'wedding', 'photographer', $3, 'Full-day coverage', $4, 80000, 0, '[]'::jsonb)
       RETURNING token`,
      [shop.vpid, shop.uid, withCard ? shop.serviceId : null, day],
    )
  ).rows[0]!.token;
}

async function claim(coupleUid: string, token: string, eventId: string): Promise<Claim> {
  // Who is asking and the claim, in ONE statement: two claims sent together share PGlite's one connection, so a
  // separate "set the user" call would interleave with the other claim's.
  return (
    await db.query<{ out: Claim }>(
      `SELECT public.vendor_claim_locked_qr($1, $2) AS out
         FROM (SELECT set_config('request.jwt.claim.sub', $3, true)) AS who`,
      [token, eventId, coupleUid],
    )
  ).rows[0]!.out;
}

async function tokenStatus(token: string): Promise<string> {
  return (await db.query<{ s: string }>(`SELECT status AS s FROM public.vendor_locked_qr_tokens WHERE token = $1`, [token]))
    .rows[0]!.s;
}

async function bookingsOn(eventId: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendors WHERE event_id = $1`, [eventId]))
    .rows[0]!.n;
}

async function liveSeats(vpid: string, day: string): Promise<number> {
  return (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings
        WHERE vendor_profile_id = $1 AND booked_date = $2::date AND released_at IS NULL`,
      [vpid, day],
    )
  ).rows[0]!.n;
}

async function setPoolCapacity(vpid: string, cap: number): Promise<void> {
  await db.query(
    `UPDATE public.vendor_schedule_pools SET daily_booking_capacity = $2
      WHERE pool_id IN (SELECT pool_id FROM public.vendor_schedule_pool_categories
                         WHERE vendor_profile_id = $1 AND category_key = 'photographer')`,
    [vpid, cap],
  );
}

/* ── 0. META ────────────────────────────────────────────────────────────────────────────────────────────────────*/

test('META: the claim locks the schedule row FOR UPDATE and refuses a full date BEFORE the token flips', async () => {
  const def = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;
  const lockAt = def.search(/FROM public\.vendor_schedule_pools[\s\S]{0,120}FOR UPDATE/);
  const fullAt = def.indexOf("'date_full'");
  const flipAt = def.indexOf("SET status             = 'claimed'");
  assert.ok(lockAt > -1, 'the claim must take the schedule row FOR UPDATE');
  assert.ok(fullAt > -1, "the claim must answer 'date_full'");
  assert.ok(flipAt > -1, 'the single-use flip must still exist');
  assert.ok(lockAt < flipAt && fullAt < flipAt, 'the date is decided BEFORE the token flips — never read-then-write after it');
  assert.match(def, /service_card_daily_limit\(t\.vendor_service_id\)/, 'the card’s own limit per date is read');
  // House lock order (review 25 Nov): the shop's count lock BEFORE the schedule row, as acquire_schedule_pools takes them.
  const shopLockAt = def.indexOf('lock_shop_day_counts(t.vendor_service_id)');
  assert.ok(shopLockAt > -1 && shopLockAt < lockAt, 'the shop count lock is taken before the schedule row — never the reverse (deadlock)');
  assert.match(def, /current_couple_event_ids\(\)/, 'only a couple of the event may claim');
  assert.doesNotMatch(def, /current_event_ids\(\)/, 'never the any-member check (a guest could claim)');
});

/* ── 1. THE RULING ──────────────────────────────────────────────────────────────────────────────────────────────*/

test('two couples claim one single-place date at once → exactly one books, the other is told and books nothing', async () => {
  const day = '2028-02-12';
  const shop = await mkShop('One Place Studio');
  const a = await mkCoupleEvent('Couple A');
  const b = await mkCoupleEvent('Couple B');
  const ta = await mkToken(shop, day);
  const tb = await mkToken(shop, day);

  const [ra, rb] = await Promise.all([claim(a.uid, ta, a.eventId), claim(b.uid, tb, b.eventId)]);
  const statuses = [ra.status, rb.status].sort();
  assert.deepEqual(statuses, ['date_full', 'ok'], 'exactly one claim wins the date');

  const [winner, loser] = ra.status === 'ok' ? [{ r: ra, ev: a.eventId, t: ta }, { ev: b.eventId, t: tb }] : [{ r: rb, ev: b.eventId, t: tb }, { ev: a.eventId, t: ta }];
  assert.equal(await bookingsOn(winner.ev), 1);
  assert.equal(await bookingsOn(loser.ev), 0, 'the second claimant books nothing');
  assert.equal(await tokenStatus(loser.t), 'pending', 'the second code stays pending — the supplier sees it and can move it');
  assert.equal(await tokenStatus(winner.t), 'claimed');
  assert.equal(await liveSeats(shop.vpid, day), 1, 'one seat taken on the date, never two');
});

/* ── 2. CAPACITY ────────────────────────────────────────────────────────────────────────────────────────────────*/

test('a schedule that takes two a day books two claims and refuses the third', async () => {
  const day = '2028-02-13';
  const shop = await mkShop('Two A Day Studio');
  const first = await mkCoupleEvent('Two A Day 1');
  // The first claim creates the pool; raise it to two, then two more claims arrive.
  assert.equal((await claim(first.uid, await mkToken(shop, day, false), first.eventId)).status, 'ok');
  await setPoolCapacity(shop.vpid, 2);
  const second = await mkCoupleEvent('Two A Day 2');
  const third = await mkCoupleEvent('Two A Day 3');
  assert.equal((await claim(second.uid, await mkToken(shop, day, false), second.eventId)).status, 'ok');
  assert.equal((await claim(third.uid, await mkToken(shop, day, false), third.eventId)).status, 'date_full');
  assert.equal(await liveSeats(shop.vpid, day), 2);
});

/* ── 3. THE CARD'S OWN NUMBER PER DATE ─────────────────────────────────────────────────────────────────────────*/

test('the code’s card limit is honoured — the card’s own number per date, raised when the shop raises it', async () => {
  // Since 18 Nov (simpler plans, ruling 17) a card's limit per date is the card's OWN number (`daily_capacity`) —
  // no plan ceiling over it, so the old "+1 booking per date" add-on has no cap left to raise (lib/vendor-ultra-addons.ts).
  const day = '2028-02-14';
  const shop = await mkShop('Card Limit Studio');
  await db.query(`UPDATE public.vendor_services SET daily_capacity = 1 WHERE vendor_service_id = $1`, [shop.serviceId]);
  const c1 = await mkCoupleEvent('Card 1');
  assert.equal((await claim(c1.uid, await mkToken(shop, day), c1.eventId)).status, 'ok');
  // Room on the schedule, so only the CARD can refuse the next one.
  await setPoolCapacity(shop.vpid, 10);
  const booked = await db.query<{ s: string | null }>(`SELECT service_id AS s FROM public.event_vendors WHERE event_id = $1`, [c1.eventId]);
  assert.equal(booked.rows[0]!.s, shop.serviceId, 'the booking carries the code’s card, so the card count sees it');

  const c2 = await mkCoupleEvent('Card 2');
  const t2 = await mkToken(shop, day);
  assert.equal((await claim(c2.uid, t2, c2.eventId)).status, 'date_full', 'the card is full for the day');

  await db.query(`UPDATE public.vendor_services SET daily_capacity = 2 WHERE vendor_service_id = $1`, [shop.serviceId]);
  assert.equal((await claim(c2.uid, t2, c2.eventId)).status, 'ok', 'the same code books once the shop makes room');
});

/* ── 4. NOT COUNTED AGAINST ITSELF ──────────────────────────────────────────────────────────────────────────────*/

test('an event that already holds the shop is not counted against itself', async () => {
  const day = '2028-02-15';
  const shop = await mkShop('Same Couple Studio');
  const c = await mkCoupleEvent('Same Couple');
  assert.equal((await claim(c.uid, await mkToken(shop, day), c.eventId)).status, 'ok');
  // A second code for the SAME couple's event (a re-issued quote) on the same full day still books: it is their seat.
  assert.equal((await claim(c.uid, await mkToken(shop, day), c.eventId)).status, 'ok');
  assert.equal(await bookingsOn(c.eventId), 1, 'still one booking for the couple');
  assert.equal(await liveSeats(shop.vpid, day), 1);
});

/* ── 5. A BOOKING WITH NO SEAT STILL TAKES THE DATE ─────────────────────────────────────────────────────────────*/

test('a blocked day: the first claim books with no seat, and the second claim for that date is refused', async () => {
  const day = '2028-02-16';
  const shop = await mkShop('Blocked Day Studio');
  // The pool exists (an earlier claim on another day made it) and takes one a day.
  const warm = await mkCoupleEvent('Blocked Warm');
  assert.equal((await claim(warm.uid, await mkToken(shop, '2028-03-01', false), warm.eventId)).status, 'ok');
  await setPoolCapacity(shop.vpid, 1);
  await db.query(
    `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source)
     VALUES ($1, NULL, ($2::date)::timestamptz, ($2::date + 1)::timestamptz, 'Closed', 'manual')`,
    [shop.vpid, day],
  );
  const a = await mkCoupleEvent('Blocked A');
  const b = await mkCoupleEvent('Blocked B');
  assert.equal((await claim(a.uid, await mkToken(shop, day, false), a.eventId)).status, 'ok', 'the supplier’s own code still books');
  assert.equal(await liveSeats(shop.vpid, day), 0, 'the blocked day gave the first booking no seat');
  const tb = await mkToken(shop, day, false);
  assert.equal((await claim(b.uid, tb, b.eventId)).status, 'date_full', 'a seatless booking still took the date');
  assert.equal(await bookingsOn(b.eventId), 0);
  assert.equal(await tokenStatus(tb), 'pending');
});

/* ── 6. ONLY THE COUPLE ─────────────────────────────────────────────────────────────────────────────────────────*/

test('a guest member cannot claim a code onto the host’s event — not_your_event, nothing written', async () => {
  const day = '2028-02-17';
  const shop = await mkShop('Guest Claim Studio');
  const host = await mkCoupleEvent('Guest Claim Host');
  const guestUid = await mkUser('guest-claimer', 'customer');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [host.eventId, guestUid]);
  const t = await mkToken(shop, day);
  assert.equal((await claim(guestUid, t, host.eventId)).status, 'not_your_event');
  assert.equal(await bookingsOn(host.eventId), 0);
  assert.equal(await tokenStatus(t), 'pending');
  const ev = await db.query<{ d: string | null }>(`SELECT event_date::text AS d FROM public.events WHERE event_id = $1`, [host.eventId]);
  assert.notEqual(ev.rows[0]!.d, day, 'the host’s date was not rewritten');
});

/* ── 7. ALWAYS AVAILABLE (also AV-NONE of Add 37) ────────────────────────────────────────────────────────────────────────────────────────*/

test('an Always available card is never counted: two claims on one single-place date both book', async () => {
  const day = '2028-02-18';
  const shop = await mkShop('Always Open Studio');
  await db.query(`UPDATE public.vendor_services SET availability_style = 'none' WHERE vendor_service_id = $1`, [shop.serviceId]);
  const a = await mkCoupleEvent('Always A');
  const b = await mkCoupleEvent('Always B');
  assert.equal((await claim(a.uid, await mkToken(shop, day), a.eventId)).status, 'ok');
  await setPoolCapacity(shop.vpid, 1);
  assert.equal((await claim(b.uid, await mkToken(shop, day), b.eventId)).status, 'ok', 'an Always available card takes no seat');
});

/* ── 8. ADD 37 · ONE CASE PER AVAILABILITY STYLE ────────────────────────────────────────────────────────────────*/

/** A shop whose code names a card of `style` with its own number `cap`; the schedule is opened wide (10) or left at `poolCap`. */
async function styledClaims(style: string | null, cap: number | null, poolCap: number, n: number): Promise<string[]> {
  const day = `2028-04-${String(10 + ++seq % 18).padStart(2, '0')}`;
  const shop = await mkShop(`Style ${style ?? 'unset'} ${seq}`);
  await db.query(`UPDATE public.vendor_services SET availability_style = $2, daily_capacity = $3 WHERE vendor_service_id = $1`, [
    shop.serviceId,
    style,
    cap,
  ]);
  // The schedule exists before the claims under test (a claim on another day makes it), at the number the case needs.
  const warm = await mkCoupleEvent(`Warm ${seq}`);
  assert.equal((await claim(warm.uid, await mkToken(shop, '2028-05-30'), warm.eventId)).status, 'ok');
  await setPoolCapacity(shop.vpid, poolCap);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = await mkCoupleEvent(`Styled ${seq}-${i}`);
    out.push((await claim(c.uid, await mkToken(shop, day), c.eventId)).status);
  }
  return out;
}

test('Add 37 · AV-DAY: full when the date’s bookings reach the card’s number (the schedule does not decide)', async () => {
  assert.deepEqual(await styledClaims('day', 1, 10, 2), ['ok', 'date_full']);
});

test('Add 37 · AV-ORDER: full when the date’s orders reach the card’s number', async () => {
  assert.deepEqual(await styledClaims('order', 2, 10, 3), ['ok', 'ok', 'date_full']);
});

test('Add 37 · AV-NIGHT: full when no room is left that night', async () => {
  assert.deepEqual(await styledClaims('night', 2, 10, 3), ['ok', 'ok', 'date_full']);
});

test('Add 37 · AV-PIECE: full only when the pieces asked for exceed the pieces left (a code asks for one)', async () => {
  // A one-place schedule does not refuse pieces: only the card's pieces do.
  assert.deepEqual(await styledClaims('piece', 2, 1, 3), ['ok', 'ok', 'date_full']);
});

test('Add 37 · AV-HOUR: never full by the date — a code carries no hours, the yes judges them', async () => {
  assert.deepEqual(await styledClaims('hour', 1, 1, 2), ['ok', 'ok']);
});

test('Add 37 · AV-TIME: never full by the date — a code carries no slot, the yes judges it', async () => {
  assert.deepEqual(await styledClaims('time', 1, 1, 2), ['ok', 'ok']);
});

test('Add 37 · AV-NONE: never full by date', async () => {
  assert.deepEqual(await styledClaims('none', null, 1, 2), ['ok', 'ok']);
});

test('Add 37 · no style set: today’s shop schedule decides', async () => {
  assert.deepEqual(await styledClaims(null, null, 1, 2), ['ok', 'date_full']);
});
