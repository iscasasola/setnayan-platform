/**
 * 👥 THE SUPPLIER'S YES SEES A FULL SCHEDULE: supplier-ready walk 22 Nov 2026, migration 20271359089802.
 *
 * Before this, a supplier could say yes on a day their TEAM schedule was already full. Only the couple's deposit
 * (`acquire_schedule_pools`) counted the schedule, so the couple was refused at payment for a booking the supplier
 * had agreed to. `vendor_card_schedules_on` answers, before the yes, which of the booking's team schedules are full.
 *
 * 🔑 ONE COUNT, ONE REFUSAL: every "full" here is asked of the deposit gate too, as the same real supplier session.
 * The yes's check and the deposit must agree: full ⇔ the deposit says `full`.
 *
 * Fails if:
 *   · a full team schedule is not named;
 *   · an open one is named (another day, room left, a released seat, a month-only event);
 *   · a row already booked, an Always-available card or a by-the-piece card is refused here;
 *   · a hall is answered here (it belongs to `vendor_card_halls_on`, which names the free halls);
 *   · another shop's pool can be probed;
 *   · a stranger or anon can ask.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DAY = '2027-12-18';
const OTHER_DAY = '2027-12-19';

const F = { supplier: '', shop: '', card: '', crew: '', crew2: '', hall: '', otherShopPool: '', stranger: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

let seq = 0;
async function mkUser(label: string, type: 'customer' | 'vendor'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [`${label}-${++seq}@full-schedule.test`, type],
    )
  ).rows[0]!.id;
}

async function mkShop(label: string): Promise<{ uid: string; vpid: string }> {
  const uid = await mkUser(label, 'vendor');
  const vpid =
    (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]))
      .rows[0]?.v ??
    (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id AS v`,
        [uid, label],
      )
    ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = $2, location_city = 'Manila', services = ARRAY['photography']::text[],
            verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility, tier_state = 'pro'
      WHERE vendor_profile_id = $1`,
    [vpid, label],
  );
  return { uid, vpid };
}

async function mkCard(vpid: string, style: string | null): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'photography', 40000, 'Free extra hour', FALSE, 'vendor-media/full-schedule/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = TRUE, availability_style = $2 WHERE vendor_service_id = $1`, [
    s.rows[0]!.s,
    style,
  ]);
  return s.rows[0]!.s;
}

async function mkPool(vpid: string, label: string, cap: number, isHall = false): Promise<string> {
  return (
    await db.query<{ p: string }>(
      `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, calendar_name, daily_booking_capacity, is_active, is_hall)
       VALUES ($1, $2, $2, $3, TRUE, $4) RETURNING pool_id AS p`,
      [vpid, label, cap, isHall],
    )
  ).rows[0]!.p;
}

async function mkEvent(name: string, day: string, precision: 'day' | 'month' = 'day'): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ($1, 'birthday', $2::date, $3) RETURNING event_id AS e`,
      [name, day, precision],
    )
  ).rows[0]!.e;
}

/** A booking row of the shop on its event; `pending` = an ask waiting on the supplier's yes. */
async function mkRow(eventId: string, card: string, status: string, pending: boolean): Promise<string> {
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, lock_request_state, lock_requested_at)
       VALUES ($1, 'misc', 'Full Schedule Studio', $2, $3, $4, CASE WHEN $5 THEN 'pending' END, CASE WHEN $5 THEN NOW() END)
       RETURNING vendor_id AS v`,
      [eventId, status, F.shop, card, pending],
    )
  ).rows[0]!.v;
}

/** A deposit-held seat on `pool` for `row` (what acquire_schedule_pools writes). */
async function seat(pool: string, row: string, eventId: string, day: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO public.vendor_schedule_pool_bookings (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
       VALUES ($1, $2, $3, $4, $5::date) RETURNING event_vendor_id AS id`,
      [pool, F.shop, row, eventId, day],
    )
  ).rows[0]!.id;
}

/** A couple asking on `day`: the row the supplier is about to say yes to. */
async function ask(name: string, day: string, opts: { card?: string; precision?: 'day' | 'month'; status?: string } = {}) {
  const ev = await mkEvent(name, day, opts.precision ?? 'day');
  const row = await mkRow(ev, opts.card ?? F.card, opts.status ?? 'considering', true);
  return { ev, row };
}

async function schedulesOn(row: string, pools: string[], uid = F.supplier): Promise<{ status: string; full?: string[] }> {
  return asUser(uid, async () =>
    (await db.query<{ r: { status: string; full?: string[] } }>(`SELECT public.vendor_card_schedules_on($1, $2::uuid[]) AS r`, [row, pools]))
      .rows[0]!.r,
  );
}
async function deposit(ev: string, row: string, pools: string[]): Promise<string> {
  return asUser(F.supplier, async () =>
    (await db.query<{ r: { status: string } }>(`SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS r`, [ev, row, pools])).rows[0]!.r
      .status,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const shop = await mkShop('Full Schedule Studio');
  F.supplier = shop.uid;
  F.shop = shop.vpid;
  F.card = await mkCard(F.shop, null);
  F.crew = await mkPool(F.shop, 'Crew A', 1);
  F.crew2 = await mkPool(F.shop, 'Crew B', 2);
  F.hall = await mkPool(F.shop, 'Hall A', 1, true);
  const other = await mkShop('Another Studio');
  F.otherShopPool = await mkPool(other.vpid, 'Their Crew', 1);
  F.stranger = await mkUser('stranger', 'customer');

  // One couple is booked and holds a seat on Crew A, Crew B, Hall A and the other shop's crew on DAY.
  const booked = await mkEvent('Booked couple', DAY);
  const bookedRow = await mkRow(booked, F.card, 'deposit_paid', false);
  for (const p of [F.crew, F.crew2, F.hall]) await seat(p, bookedRow, booked, DAY);
  await db.query(
    `INSERT INTO public.vendor_schedule_pool_bookings (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
     SELECT $1, vendor_profile_id, $2, $3, $4::date FROM public.vendor_schedule_pools WHERE pool_id = $1`,
    [F.otherShopPool, bookedRow, booked, DAY],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('1 · a full team schedule is named, and the deposit gate refuses the same day', async () => {
  const a = await ask('Asking couple', DAY);
  const r = await schedulesOn(a.row, [F.crew]);
  assert.equal(r.status, 'schedule_full');
  assert.deepEqual(r.full, ['Crew A']);
  assert.equal(await deposit(a.ev, a.row, [F.crew]), 'full', 'the yes and the deposit refuse the same day');
});

test('2 · room left, another day or a released seat: not named, and the deposit takes it', async () => {
  const roomy = await ask('Roomy couple', DAY);
  const r = await schedulesOn(roomy.row, [F.crew2]);
  assert.equal(r.status, 'ok', 'two a day, one taken');
  assert.deepEqual(r.full, []);

  const later = await ask('Later couple', OTHER_DAY);
  assert.equal((await schedulesOn(later.row, [F.crew])).status, 'ok');
  assert.equal(await deposit(later.ev, later.row, [F.crew]), 'ok', 'an open day is open at the deposit too');

  // Crew A and Crew B together: only the full one is named.
  const both = await ask('Both crews couple', DAY);
  assert.deepEqual((await schedulesOn(both.row, [F.crew, F.crew2])).full, ['Crew A']);
});

test('3 · a released seat frees the day', async () => {
  const ev = await mkEvent('Released couple', '2027-12-22');
  const held = await mkRow(ev, F.card, 'deposit_paid', false);
  await seat(F.crew, held, ev, '2027-12-22');
  const a = await ask('After release', '2027-12-22');
  assert.equal((await schedulesOn(a.row, [F.crew])).status, 'schedule_full');
  await db.query(`UPDATE public.vendor_schedule_pool_bookings SET released_at = NOW() WHERE event_vendor_id = $1`, [held]);
  assert.equal((await schedulesOn(a.row, [F.crew])).status, 'ok');
});

test('4 · nothing to refuse: a month-only event, a booked row, Always available, by the piece', async () => {
  const month = await ask('Month-only couple', '2027-12-01', { precision: 'month' });
  const firstEv = await mkEvent('Booked on the 1st', '2027-12-01');
  await seat(F.crew, await mkRow(firstEv, F.card, 'deposit_paid', false), firstEv, '2027-12-01');
  assert.equal((await schedulesOn(month.row, [F.crew])).status, 'ok', 'a placeholder 1st is not a day');

  const already = await ask('Already booked', DAY, { status: 'contracted' });
  assert.equal((await schedulesOn(already.row, [F.crew])).status, 'ok', 'a booked row is not a new booking');

  const none = await ask('Always available', DAY, { card: await mkCard(F.shop, 'none') });
  assert.equal((await schedulesOn(none.row, [F.crew])).status, 'ok', 'Always available takes no seat');

  const piece = await ask('By the piece', DAY, { card: await mkCard(F.shop, 'piece') });
  assert.equal((await schedulesOn(piece.row, [F.crew])).status, 'ok', 'pieces are judged by their card');
});

test('5 · halls are left to vendor_card_halls_on; another shop’s pool is never read', async () => {
  const a = await ask('Hall couple', DAY);
  assert.equal((await schedulesOn(a.row, [F.hall])).status, 'ok', 'a full hall is answered by the hall check');
  assert.equal((await schedulesOn(a.row, [F.otherShopPool])).status, 'ok', 'a pool of another shop is not this shop’s to read');
});

test('6 · only the asked shop (or admin) may ask; anon cannot execute', async () => {
  const a = await ask('Private couple', DAY);
  assert.equal((await schedulesOn(a.row, [F.crew], F.stranger)).status, 'not_authorized');
  const anon = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', 'public.vendor_card_schedules_on(uuid, uuid[])', 'EXECUTE') AS ok`,
  );
  assert.equal(anon.rows[0]!.ok, false);
});
