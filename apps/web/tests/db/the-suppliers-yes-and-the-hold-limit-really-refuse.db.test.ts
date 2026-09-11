/**
 * THE SUPPLIER'S YES AND THE SHOP'S HOLD LIMIT REALLY REFUSE — LOCK-PATH 2,
 * migration 20271223386305. Every refusal is proven as a REAL `authenticated`
 * session (SET ROLE + JWT claims), never as the superuser the replay otherwise
 * runs as; a count the server asks is asked as `service_role`, exactly as the
 * app asks it (createAdminClient().rpc(...)).
 *
 * GAP 1 · the supplier's `vendor_agree_to_lock` — the step that BOOKS under the
 *   lock handshake — checked time slots and never the card's "Bookings per day".
 *   Now it refuses with `daily_limit_reached`, counted by the SAME
 *   `service_card_bookings_on` the couple's ask and the bench search use. The
 *   NEUTRALISED test re-installs production's body (20271144481150) inside a
 *   rolled-back transaction and shows the same over-limit yes BOOKING — the
 *   door was real.
 *
 * GAP 2 · the shop's hold limit per date (`max_soft_holds_per_date`, Rule 3,
 *   owner 2026-05-24; every shop on its default 3) counted other couples' holds
 *   through the COUPLE'S session, which RLS limits to their own events — 0,
 *   always. Measured below first (META), then the gate step for step: inputs
 *   through the couple's session, the count through `vendor_soft_holds_on`.
 *
 * AND ONE THAT WAS NOT A GAP: the per-PLAN "customers per date" ceiling (Solo 3)
 *   lives in `enforce_vendor_whitelist_per_date`, a SECURITY DEFINER trigger on
 *   the supplier's own accept. Shown refusing a Solo supplier's 4th accept as a
 *   genuine `authenticated` session, so nobody re-opens it as "blind".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATIONS = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
/** The body production runs today (line-hash equal to the live object, 2026-09-11). */
const LIVE_AGREE_FILE = '20271144481150_agree_stamps_the_link.sql';

const LIMIT = 2; // the card's "Bookings per day"
const CARD_FULL = '2027-10-16'; // two other couples already booked the card
const CARD_ROOM = '2027-10-17'; // one other couple booked it
const CARD_FIRST = '2027-11-01'; // two MONTH-only bookings are stored here

const HOLD_FULL = '2027-12-04'; // three other couples hold the shop
const HOLD_ROOM = '2027-12-05'; // two other couples hold it (plus rows that are not holds)
const HOLD_FIRST = '2028-01-01'; // three MONTH-only holds are stored here

const PLAN_DAY = '2028-02-14'; // the per-plan whitelist ceiling, Solo = 3

const F = {
  couple: '',
  // GAP 1 shop: a Solo shop with one card whose limit is 2
  supplier: '',
  shop: '',
  card: '',
  // GAP 2 shop: a Solo shop on the default hold limit
  holdSupplier: '',
  holdShop: '',
  holdCard: '',
  // the per-plan ceiling shop
  planSupplier: '',
  planShop: '',
};

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
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
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
      [`${label}-${++seq}@lock-path-2.test`, type],
    )
  ).rows[0]!.id;
}

/** A verified Solo shop owned by a real supplier account. */
async function mkShop(label: string): Promise<{ uid: string; vpid: string }> {
  const uid = await mkUser(label, 'vendor');
  // account_type 'vendor' mints the profile (on_auth_user_created); user_id is UNIQUE.
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
            public_visibility = 'verified'::public.vendor_public_visibility,
            tier_state = 'solo'
      WHERE vendor_profile_id = $1`,
    [vpid, label],
  );
  return { uid, vpid };
}

/** A LIVE card: drafted first, then given a cover and one "what's included"
 *  line, then published — the order the H2 publish gate (20271222415682) asks. */
async function mkCard(vpid: string, dailyCapacity: number | null): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'photo_booth', 40000, 'Free extra hour', FALSE, 'vendor-media/lock-path-2/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET daily_capacity = $2, is_active = TRUE WHERE vendor_service_id = $1`, [
    s.rows[0]!.s,
    dailyCapacity,
  ]);
  return s.rows[0]!.s;
}

/** Another couple's event with one booking row for `shop` (and `card`) on it. */
async function otherCouple(opts: {
  shop: string;
  card: string | null;
  day: string;
  precision?: 'day' | 'month';
  status?: string;
  archived?: boolean;
}): Promise<string> {
  const ev = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Another couple', 'birthday', $1::date, $2) RETURNING event_id AS e`,
    [opts.day, opts.precision ?? 'day'],
  );
  await addRow(ev.rows[0]!.e, opts);
  return ev.rows[0]!.e;
}
async function addRow(
  eventId: string,
  opts: { shop: string; card: string | null; status?: string; archived?: boolean; covered?: boolean },
): Promise<void> {
  // One marketplace shop per event (event_vendors_unique_marketplace_pick_per_event);
  // a second row of the same shop on one event is a package's COVERED line.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, archived_at, package_role)
     VALUES ($1, 'misc', 'Lock Path Studio', $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END, CASE WHEN $6 THEN 'covered' END)`,
    [eventId, opts.status ?? 'contracted', opts.shop, opts.card, opts.archived ?? false, opts.covered ?? false],
  );
}

/** Two other couples booked on the limit-2 card that day — the card is full. */
async function fillCard(day: string): Promise<void> {
  await otherCouple({ shop: F.shop, card: F.card, day, status: 'deposit_paid' });
  await otherCouple({ shop: F.shop, card: F.card, day, status: 'contracted' });
}

/** OUR couple's event on `day`, with `shop`'s card on it. */
async function ourEvent(day: string, precision: 'day' | 'month' = 'day'): Promise<string> {
  const ev = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Our wedding', 'birthday', $1::date, $2) RETURNING event_id AS e`,
    [day, precision],
  );
  const eventId = ev.rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    F.couple,
  ]);
  return eventId;
}

/** A pending ask, exactly as the couple's Lock writes one under the handshake. */
async function ourAsk(day: string, opts: { shop?: string; card?: string; precision?: 'day' | 'month'; status?: string } = {}): Promise<string> {
  const eventId = await ourEvent(day, opts.precision ?? 'day');
  const r = await db.query<{ v: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, lock_request_state, lock_requested_at)
     VALUES ($1, 'misc', 'Lock Path Studio', $2, $3, $4, 'pending', NOW())
     RETURNING vendor_id AS v`,
    [eventId, opts.status ?? 'considering', opts.shop ?? F.shop, opts.card ?? F.card],
  );
  return r.rows[0]!.v;
}

/** The supplier presses Agree — as themselves. */
async function agree(uid: string, rowId: string): Promise<{ status: string; daily_limit?: number }> {
  return asUser(uid, async () => {
    const r = await db.query<{ r: { status: string; daily_limit?: number } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId]);
    return r.rows[0]!.r;
  });
}

async function rowState(rowId: string): Promise<{ status: string; lock_request_state: string | null }> {
  return (
    await db.query<{ status: string; lock_request_state: string | null }>(
      `SELECT status::text AS status, lock_request_state FROM public.event_vendors WHERE vendor_id = $1`,
      [rowId],
    )
  ).rows[0]!;
}

/**
 * The shop's hold-limit gate, step for step as finalizeVendor runs it: the shop,
 * its limit and the date through the COUPLE'S session; the count through the
 * SERVICE ROLE, scoped by what the session read. Returns the refusal, or null.
 */
async function holdGate(eventId: string): Promise<{ limit: number; held: number } | null> {
  const read = await asUser(F.couple, async () => {
    const row = await db.query<{ mvid: string }>(
      `SELECT marketplace_vendor_id AS mvid FROM public.event_vendors WHERE event_id = $1 AND marketplace_vendor_id = $2`,
      [eventId, F.holdShop],
    );
    assert.equal(row.rows.length, 1, 'the couple cannot read their own booking row — the gate would never run');
    const vp = await db.query<{ lim: number }>(
      `SELECT max_soft_holds_per_date AS lim FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [row.rows[0]!.mvid],
    );
    assert.equal(vp.rows.length, 1, 'the couple cannot read the shop’s hold limit — the gate would degrade open and prove nothing');
    const ev = await db.query<{ event_date: string | null; event_date_precision: string }>(
      `SELECT event_date::text AS event_date, event_date_precision FROM public.events WHERE event_id = $1`,
      [eventId],
    );
    return { mvid: row.rows[0]!.mvid, limit: vp.rows[0]!.lim, ...ev.rows[0]! };
  });
  if (!read.event_date || read.event_date_precision !== 'day' || typeof read.limit !== 'number') return null;
  const held = await asService(
    async () =>
      (
        await db.query<{ n: number }>(`SELECT public.vendor_soft_holds_on($1, $2::date, $3) AS n`, [
          read.mvid,
          read.event_date,
          eventId,
        ])
      ).rows[0]!.n,
  );
  return held >= read.limit ? { limit: read.limit, held } : null;
}

/** A couple's event on the hold shop, shortlisted — the row they lock. */
async function ourHoldLock(day: string, precision: 'day' | 'month' = 'day'): Promise<string> {
  const eventId = await ourEvent(day, precision);
  await addRow(eventId, { shop: F.holdShop, card: F.holdCard, status: 'shortlisted' });
  return eventId;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.couple = await mkUser('couple', 'customer');

  ({ uid: F.supplier, vpid: F.shop } = await mkShop('Daily Limit Studio'));
  F.card = await mkCard(F.shop, LIMIT);
  // CARD_FULL: two other couples booked — the card is full. Plus two rows that are not bookings.
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FULL, status: 'deposit_paid' });
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FULL, status: 'contracted' });
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FULL, status: 'contracted', archived: true });
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FULL, status: 'shortlisted' });
  // CARD_ROOM: one other couple — room for one more.
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_ROOM, status: 'complete' });
  // CARD_FIRST: two MONTH-only bookings stored as the 1st — neither is on the 1st.
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FIRST, precision: 'month', status: 'deposit_paid' });
  await otherCouple({ shop: F.shop, card: F.card, day: CARD_FIRST, precision: 'month', status: 'contracted' });

  ({ uid: F.holdSupplier, vpid: F.holdShop } = await mkShop('Hold Limit Studio'));
  F.holdCard = await mkCard(F.holdShop, null);
  // HOLD_FULL: three other couples hold the shop (contracted = agreed, not yet paid).
  for (let i = 0; i < 3; i += 1) await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_FULL });
  // HOLD_ROOM: two other couples hold it — one of them through a PACKAGE (an
  // anchor + a covered line, both contracted: one couple, one hold)…
  const packageCouple = await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_ROOM });
  await addRow(packageCouple, { shop: F.holdShop, card: null, covered: true });
  await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_ROOM });
  // …and three rows that are NOT holds: paid, archived, only shortlisted.
  await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_ROOM, status: 'deposit_paid' });
  await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_ROOM, archived: true });
  await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_ROOM, status: 'shortlisted' });
  // HOLD_FIRST: three MONTH-only holds stored as the 1st.
  for (let i = 0; i < 3; i += 1) {
    await otherCouple({ shop: F.holdShop, card: F.holdCard, day: HOLD_FIRST, precision: 'month' });
  }

  ({ uid: F.planSupplier, vpid: F.planShop } = await mkShop('Plan Ceiling Studio'));
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the probing role is authenticated, not the owner, and has no BYPASSRLS', async () => {
  const r = await asUser(F.supplier, () =>
    db.query<{ me: string; owner: string; bypass: boolean; super: boolean }>(
      `SELECT current_user AS me,
              pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
         FROM pg_class c WHERE c.oid = 'public.event_vendors'::regclass`,
    ),
  );
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
  assert.equal(r.rows[0]!.super, false, 'the probing role is a superuser');
});

test('META: RLS really bites — the OLD hold count, through the couple’s session, sees 0 of 3 holds', async () => {
  // This is the bug, measured: the gate's two-step count exactly as it read.
  const eventId = await ourHoldLock(HOLD_FULL);
  const seen = await asUser(F.couple, async () => {
    const same = await db.query<{ event_id: string }>(`SELECT event_id FROM public.events WHERE event_date = $1::date`, [HOLD_FULL]);
    const others = same.rows.map((r) => r.event_id).filter((id) => id !== eventId);
    if (others.length === 0) return 0;
    const c = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.event_vendors
        WHERE marketplace_vendor_id = $1 AND status = 'contracted' AND archived_at IS NULL AND event_id = ANY($2::uuid[])`,
      [F.holdShop, others],
    );
    return c.rows[0]!.n;
  });
  const real = (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.event_vendors ev JOIN public.events e USING (event_id)
        WHERE ev.marketplace_vendor_id = $1 AND ev.status = 'contracted' AND e.event_date = $2::date`,
      [F.holdShop, HOLD_FULL],
    )
  ).rows[0]!.n;
  assert.equal(real, 3, 'the fixture does not hold three couples on the date');
  assert.equal(seen, 0, 'the couple’s session saw other couples’ holds — the premise of this fix is gone, re-measure');
});

test('META: both counts are definer, read-only, pinned, and callable by the server alone; the yes keeps its grants', async () => {
  const r = await db.query<{ proname: string; prosecdef: boolean; vol: string; cfg: string[] | null; anon: boolean; auth: boolean; svc: boolean }>(
    `SELECT p.proname, p.prosecdef, p.provolatile::text AS vol, p.proconfig AS cfg,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname IN ('vendor_soft_holds_on', 'service_card_bookings_on', 'vendor_agree_to_lock')`,
  );
  const by = new Map(r.rows.map((x) => [x.proname, x]));
  for (const name of ['vendor_soft_holds_on', 'service_card_bookings_on']) {
    const f = by.get(name);
    assert.ok(f, `${name} did not replay`);
    assert.equal(f.prosecdef, true, `${name} must be SECURITY DEFINER or it counts only the caller’s own rows`);
    assert.equal(f.vol, 's', `${name} must be STABLE`);
    assert.ok((f.cfg ?? []).some((c) => c.startsWith('search_path=')), `${name} has no pinned search_path`);
    assert.deepEqual([f.anon, f.auth, f.svc], [false, false, true], `${name}: only the server may count`);
  }
  const yes = by.get('vendor_agree_to_lock')!;
  assert.equal(yes.prosecdef, true);
  assert.deepEqual([yes.anon, yes.auth, yes.svc], [false, true, true], 'the supplier’s yes changed who may call it');
  // A signed-in browser really cannot ask the count directly.
  await assert.rejects(
    asUser(F.couple, () => db.query(`SELECT public.vendor_soft_holds_on($1, $2::date)`, [F.holdShop, HOLD_FULL])),
    /permission denied/,
  );
});

/* ── GAP 1 · THE SUPPLIER'S YES ─────────────────────────────────────────── */

test('GAP 1 · the count the yes asks is the card’s bookings on day-precise events (anti-vacuity)', async () => {
  const at = (day: string) =>
    asService(async () => (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [F.card, day])).rows[0]!.n);
  assert.equal(await at(CARD_FULL), 2, 'archived and shortlisted rows must not count; the two booked ones must');
  assert.equal(await at(CARD_ROOM), 1);
  assert.equal(await at(CARD_FIRST), 0, 'a month-only event is not a booking on the 1st');
});

test('GAP 1 · over the limit: the supplier’s yes is REFUSED with daily_limit_reached, and nothing is booked', async () => {
  const ask = await ourAsk(CARD_FULL);
  const r = await agree(F.supplier, ask);
  assert.equal(r.status, 'daily_limit_reached', `the yes answered ${JSON.stringify(r)}`);
  assert.equal(r.daily_limit, LIMIT);
  assert.deepEqual(await rowState(ask), { status: 'considering', lock_request_state: 'pending' }, 'a refused yes booked anyway');
});

test('GAP 1 · NEUTRALISED: on production’s body today, the same over-limit yes BOOKS (the door was real)', async () => {
  const sql = readFileSync(join(MIGRATIONS, LIVE_AGREE_FILE), 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(');
  const end = sql.lastIndexOf('$$');
  assert.ok(start >= 0 && end > start, `${LIVE_AGREE_FILE}: could not find the live body`);
  await db.exec('BEGIN');
  try {
    await db.exec(sql.slice(start, end + 2));
    // A fresh full day: the refused ask above is still pending on CARD_FULL, and
    // a second ask there would meet resolve_others_first, not the limit.
    await fillCard('2027-10-18');
    const ask = await ourAsk('2027-10-18');
    const r = await agree(F.supplier, ask);
    assert.equal(r.status, 'ok', `production’s body refused (${JSON.stringify(r)}) — the gap is not what this file says`);
    assert.equal((await rowState(ask)).status, 'contracted', 'production’s body did not book the third couple');
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
  const still = await db.query<{ def: string }>(`SELECT pg_get_functiondef('public.vendor_agree_to_lock(uuid)'::regprocedure) AS def`);
  assert.match(still.rows[0]!.def, /daily_limit_reached/, 'the rollback did not restore the fixed body');
});

test('GAP 1 · under the limit: the yes books', async () => {
  const ask = await ourAsk(CARD_ROOM);
  const r = await agree(F.supplier, ask);
  assert.equal(r.status, 'ok', `the yes answered ${JSON.stringify(r)}`);
  assert.deepEqual(await rowState(ask), { status: 'contracted', lock_request_state: 'agreed' });
});

test('GAP 1 · month-only bookings stored on the 1st do not fill the 1st', async () => {
  const ask = await ourAsk(CARD_FIRST);
  const r = await agree(F.supplier, ask);
  assert.equal(r.status, 'ok', `two month-only bookings refused a real day: ${JSON.stringify(r)}`);
});

test('GAP 1 · a row that is ALREADY booked is not a new booking — its yes is never refused by the limit', async () => {
  // The Locked-QR shape: (contracted, pending). Agreeing adds no booking. The
  // day is full WITHOUT this row, so only the "already booked" rule lets it by.
  await fillCard('2027-10-19');
  const ask = await ourAsk('2027-10-19', { status: 'contracted' });
  const r = await agree(F.supplier, ask);
  assert.equal(r.status, 'ok', `a booked row’s yes was refused as if it added a booking: ${JSON.stringify(r)}`);
});

test('GAP 1 · a card with no limit is never refused by it', async () => {
  const open = await mkCard(F.shop, null);
  await otherCouple({ shop: F.shop, card: open, day: '2027-10-20' });
  await otherCouple({ shop: F.shop, card: open, day: '2027-10-20' });
  const ask = await ourAsk('2027-10-20', { card: open });
  assert.equal((await agree(F.supplier, ask)).status, 'ok');
});

test('GAP 1 · a stranger still cannot answer for the shop (the gate before the limit is intact)', async () => {
  const ask = await ourAsk('2027-10-21');
  await assert.rejects(agree(F.holdSupplier, ask), /not_your_booking/);
});

/* ── GAP 2 · THE SHOP'S HOLD LIMIT PER DATE ─────────────────────────────── */

test('GAP 2 · a shop on the default limit of 3: the 4th couple on a date is REFUSED', async () => {
  const eventId = await ourHoldLock(HOLD_FULL);
  assert.deepEqual(await holdGate(eventId), { limit: 3, held: 3 });
});

test('GAP 2 · the 3rd couple is accepted — paid, archived and shortlisted rows are not holds, and a package couple is one hold', async () => {
  const eventId = await ourHoldLock(HOLD_ROOM);
  assert.equal(await holdGate(eventId), null);
  const held = await asService(
    async () =>
      (await db.query<{ n: number }>(`SELECT public.vendor_soft_holds_on($1, $2::date, $3) AS n`, [F.holdShop, HOLD_ROOM, eventId]))
        .rows[0]!.n,
  );
  assert.equal(held, 2, 'the hold count is not "other couples at contracted, not archived"');
});

test('GAP 2 · month-only holds stored on the 1st do not fill the 1st', async () => {
  const eventId = await ourHoldLock(HOLD_FIRST);
  assert.equal(await holdGate(eventId), null);
});

test('GAP 2 · a month-only couple is not gated by a per-date limit at all', async () => {
  const eventId = await ourHoldLock(HOLD_FULL, 'month');
  assert.equal(await holdGate(eventId), null);
});

test('GAP 2 · the asking couple’s own event never counts against them', async () => {
  const eventId = await ourHoldLock(HOLD_ROOM);
  await addRow(eventId, { shop: F.holdShop, card: null, status: 'contracted', covered: true }); // a line of theirs already booked
  const held = await asService(
    async () =>
      (await db.query<{ n: number }>(`SELECT public.vendor_soft_holds_on($1, $2::date, $3) AS n`, [F.holdShop, HOLD_ROOM, eventId]))
        .rows[0]!.n,
  );
  assert.equal(held, 2);
});

/* ── NOT A GAP · the per-plan customers-per-date ceiling ────────────────── */

test('NOT A GAP · the per-PLAN ceiling is a SECURITY DEFINER trigger — a Solo supplier’s 4th accept on a date is refused, the 3rd is not', async () => {
  await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1`);
  const trig = await db.query<{ prosecdef: boolean }>(
    `SELECT p.prosecdef FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = 'public.chat_threads'::regclass AND t.tgname = 'chat_threads_whitelist_per_date'`,
  );
  assert.deepEqual(trig.rows, [{ prosecdef: true }], 'the ceiling is not a definer trigger on chat_threads any more');
  const lim = await db.query<{ n: number }>(`SELECT public.vendor_tier_limit('solo', 'whitelist_per_date') AS n`);
  assert.equal(lim.rows[0]!.n, 3);

  const thread = async () => {
    const e = await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A couple asking', 'birthday', $1::date, 'day') RETURNING event_id AS e`,
      [PLAN_DAY],
    );
    return (
      await db.query<{ t: string }>(`INSERT INTO public.chat_threads (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING thread_id AS t`, [
        e.rows[0]!.e,
        F.planShop,
      ])
    ).rows[0]!.t;
  };
  // Two couples already being chased for the date — accepted by the server, not by this session.
  for (let i = 0; i < 2; i += 1) {
    await db.query(`UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status WHERE thread_id = $1`, [
      await thread(),
    ]);
  }
  const acceptAsSupplier = async (t: string) =>
    asUser(F.planSupplier, async () => {
      const r = await db.query(
        `UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status, accepted_at = NOW()
          WHERE thread_id = $1 RETURNING thread_id`,
        [t],
      );
      return r.rows.length;
    });
  // The supplier cannot see another couple's thread — yet the ceiling counts it.
  const visible = await asUser(F.planSupplier, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.events WHERE event_date = $1::date`, [PLAN_DAY])).rows[0]!.n,
  );
  assert.equal(visible, 0, 'the supplier session sees the couples’ events — this proof would be vacuous');
  assert.equal(await acceptAsSupplier(await thread()), 1, 'the 3rd accept did not land (RLS refused the supplier’s own thread?)');
  await assert.rejects(acceptAsSupplier(await thread()), /WHITELIST_DATE_LIMIT/, 'a Solo supplier’s 4th accept on one date landed');
});
