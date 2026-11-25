/**
 * THE NEW-CLIENT FREE WINDOW IS A SETTING — specs DECISION_LOG 2026-11-16 "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR
 * ONE YEAR WITH THAT SUPPLIER…", 2026-11-20 "BILLING MUST FOLLOW THE RETIRED COPY" (2) and 2026-11-19 "PROMOTION
 * PAGES" (4).
 *
 *   · A NEW account that a shop imported (the import created the couple's account) books with THAT shop fee-free for
 *     12 months from the import.
 *   · An EXISTING account that a shop imports is free only for a first-import NEW event.
 *   · After 12 months, or with a different shop, the normal fee applies.
 *
 * RULE 0: the arm already shipped in `booking_fee_attribution_for` (20271352882666 → 20271353556136) with the window
 * TYPED as `INTERVAL '12 months'`. Migration 20271356623783 moves it to
 * `platform_settings.booking_fee_new_client_free_months`, read by `booking_fee_new_client_window_covers`. Test 1 and
 * test 4 fail on the typed interval (shown red before the migration was added — see the PR body); the rest pin the
 * behaviour the brief lists so a later edit cannot move it silently.
 *
 * Every fixture sets its own timestamps. The boundary cases run inside ONE transaction, so NOW() is a single instant
 * and "exactly 12 months" is exact.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';
import { BOOKING_FEE_SCHEDULE_VERSION } from '../../lib/booking-fee-gate';
import { newClientWindowCovers } from '../../lib/booking-fee-lock';

type Q = PGlite | Transaction;
let db: PGlite;
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  // Only the import rules decide: no launch offer, no promotion window, the ruled 12 months.
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL,
            booking_fee_new_client_free_months = 12
      WHERE id = 1`,
  );
});

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

async function newUser(q: Q, tag: string): Promise<string> {
  const r = await q.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}-${Date.now()}@window.test`],
  );
  return r.rows[0]!.id;
}

/** A verified shop, verified ~3 years ago, so every import in these fixtures lands after verification. */
async function newShop(q: Q = db): Promise<string> {
  const owner = await newUser(q, 'shop');
  const r = await q.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility, created_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW() - INTERVAL '1000 days', 'verified',
             NOW() - INTERVAL '1000 days')
     RETURNING vendor_profile_id`,
    [owner, `Window ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

/** An event the couple holds, created at `createdAtSql` (an SQL expression, so a transaction can pin it to NOW()). */
async function newEvent(q: Q, couple: string, createdAtSql: string): Promise<string> {
  const r = await q.query<{ event_id: string }>(
    `INSERT INTO public.events (for_whom, display_name, event_type, event_date, created_at)
     VALUES ('self', $1, 'birthday', '2031-02-14', ${createdAtSql}) RETURNING event_id`,
    [`Window ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await q.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  return eventId;
}

/** A booking row for `shop` on the event, by `source`, made at `atSql`. Contracted, so the lock can bill it. */
async function booking(q: Q, eventId: string, shop: string, source: string, atSql: string, totalPhp = 100_000): Promise<string> {
  const r = await q.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, marketplace_vendor_id, category, vendor_name, status, source, total_cost_php, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'contracted'::vendor_status, $3, $4, ${atSql}) RETURNING vendor_id`,
    [eventId, shop, source, totalPhp],
  );
  return r.rows[0]!.vendor_id;
}

async function fee(q: Q, shop: string, eventId: string): Promise<string> {
  const r = await q.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

type Open = { status?: string; amount_charged_centavos?: number; attribution?: string; skipped?: string };
async function lock(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1, $2) AS r`, [
    evId,
    BOOKING_FEE_SCHEDULE_VERSION,
  ]);
  return r.rows[0]!.r;
}

/**
 * The brief's shape for a NEW account: the couple's first event is made through `shop`'s import at `importAtSql`
 * (nothing on Setnayan before it), then a LATER event finds the same shop on Setnayan an hour ago.
 */
async function newClientThenLaterEvent(q: Q, shop: string, importAtSql: string) {
  const couple = await newUser(q, 'new-client');
  const first = await newEvent(q, couple, `(${importAtSql}) - INTERVAL '1 second'`);
  await booking(q, first, shop, 'vendor_invite', importAtSql);
  const later = await newEvent(q, couple, `NOW() - INTERVAL '2 hours'`);
  const laterBooking = await booking(q, later, shop, 'host_marketplace_search', `NOW() - INTERVAL '1 hour'`);
  return { couple, first, later, laterBooking };
}

test('1 · the window lives in platform_settings (12), and the attribution no longer types it', async () => {
  const s = await db.query<{ m: number }>(
    `SELECT booking_fee_new_client_free_months AS m FROM public.platform_settings WHERE id = 1`,
  );
  assert.equal(Number(s.rows[0]!.m), 12, 'the ruled 12 months');
  const def = await db.query<{ d: string }>(
    `SELECT pg_get_functiondef('public.booking_fee_attribution_for(uuid,uuid)'::regprocedure) AS d`,
  );
  assert.doesNotMatch(def.rows[0]!.d, /INTERVAL\s+'12 months'/i, 'the window is still typed into the attribution');
  assert.match(def.rows[0]!.d, /booking_fee_new_client_window_covers/, 'the attribution does not read the setting');
});

test('2 · a NEW imported account, inside 12 months, with the SAME shop → waived; with ANOTHER shop → billed', async () => {
  const shop = await newShop();
  const other = await newShop();
  const { later, laterBooking } = await newClientThenLaterEvent(db, shop, `NOW() - INTERVAL '300 days'`);
  assert.equal(await fee(db, shop, later), 'import', 'every booking with THAT shop is free inside the window');
  const r = await lock(laterBooking);
  assert.equal(r.status, 'waived_import', `the lock billed a new client inside the window: ${JSON.stringify(r)}`);
  assert.equal(Number(r.amount_charged_centavos ?? 0), 0);

  const otherBooking = await booking(db, later, other, 'host_marketplace_search', `NOW() - INTERVAL '30 minutes'`);
  assert.equal(await fee(db, other, later), 'sourced', 'another shop is not covered by somebody else’s import');
  const o = await lock(otherBooking);
  assert.equal(o.status, 'pending', `another shop was not billed: ${JSON.stringify(o)}`);
  assert.ok(Number(o.amount_charged_centavos) > 0);
});

test('3 · the boundary: just inside 12 months → waived; at exactly 12 months, and just after → billed', async () => {
  const cases: Array<[string, string, string]> = [
    ["NOW() - INTERVAL '12 months' + INTERVAL '1 second'", 'import', 'one second inside the window'],
    ["NOW() - INTERVAL '12 months'", 'sourced', 'at exactly 12 months the window is over'],
    ["NOW() - INTERVAL '12 months' - INTERVAL '1 second'", 'sourced', 'one second after the window'],
    ["NOW() - INTERVAL '12 months' - INTERVAL '1 day'", 'sourced', 'a day after the window'],
  ];
  for (const [importAt, want, why] of cases) {
    // One transaction: NOW() is the same instant for the fixture and for the attribution.
    const got = await db.transaction(async (tx) => {
      const shop = await newShop(tx);
      const { later } = await newClientThenLaterEvent(tx, shop, importAt);
      return fee(tx, shop, later);
    });
    assert.equal(got, want, why);
  }
});

test('4 · the setting decides, not code: 6 months closes a 300-day-old window, 12 opens it again', async () => {
  const shop = await newShop();
  const { later } = await newClientThenLaterEvent(db, shop, `NOW() - INTERVAL '300 days'`);
  assert.equal(await fee(db, shop, later), 'import');
  await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = 6 WHERE id = 1`);
  assert.equal(await fee(db, shop, later), 'sourced', 'a 6-month setting still freed a 300-day-old import');
  await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = 12 WHERE id = 1`);
  assert.equal(await fee(db, shop, later), 'import');
});

test('5 · an EXISTING account: the first-import NEW event → waived; its second event with the same shop → billed', async () => {
  const shop = await newShop();
  const couple = await newUser(db, 'existing');
  await newEvent(db, couple, `NOW() - INTERVAL '300 days'`); // on Setnayan before any import
  const fresh = await newEvent(db, couple, `NOW() - INTERVAL '40 days'`);
  const first = await booking(db, fresh, shop, 'vendor_locked_qr', `NOW() - INTERVAL '39 days'`);
  assert.equal(await fee(db, shop, fresh), 'import', 'the first import on a new event is free');
  const f = await lock(first);
  assert.equal(f.status, 'waived_import', JSON.stringify(f));

  // No free year for an existing account: the same shop on the couple's next event, found on Setnayan, pays.
  const next = await newEvent(db, couple, `NOW() - INTERVAL '10 days'`);
  const second = await booking(db, next, shop, 'host_marketplace_search', `NOW() - INTERVAL '9 days'`);
  assert.equal(await fee(db, shop, next), 'sourced');
  const s = await lock(second);
  assert.equal(s.status, 'pending', `an existing account’s second event was not billed: ${JSON.stringify(s)}`);
});

test('6 · an amendment keeps the basis it was locked on, both ways', async () => {
  // (a) Waived inside the window, then the window closes (setting → 1 month): the amendment stays waived.
  const shop = await newShop();
  const { later, laterBooking } = await newClientThenLaterEvent(db, shop, `NOW() - INTERVAL '100 days'`);
  const w = await lock(laterBooking);
  assert.equal(w.status, 'waived_import');
  await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = 1 WHERE id = 1`);
  assert.equal(await fee(db, shop, later), 'sourced', 'precondition: today the window no longer covers it');
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 150000 WHERE vendor_id = $1`, [laterBooking]);
  const rd = await db.query<{ r: { action: string } }>(`SELECT public.booking_fee_rederive_lock_fee($1) AS r`, [laterBooking]);
  assert.equal(rd.rows[0]!.r.action, 'import_noop', `an amended waived booking was re-billed: ${rd.rows[0]!.r.action}`);
  const again = await lock(laterBooking);
  assert.equal(again.status, 'waived_import', 'a second lock of a waived booking billed it');
  const billed = await db.query<{ c: string }>(
    `SELECT count(*) AS c FROM public.booking_fee_charges
      WHERE event_vendor_id = $1 AND amount_charged_centavos > 0`,
    [laterBooking],
  );
  assert.equal(Number(billed.rows[0]!.c), 0, 'a waiver already granted was taken back');

  // (b) Billed after the window, then the setting is widened again: the amendment still bills, on its locked basis.
  await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = 12 WHERE id = 1`);
  const shop2 = await newShop();
  const { later: later2, laterBooking: b2 } = await newClientThenLaterEvent(db, shop2, `NOW() - INTERVAL '400 days'`);
  const p = await lock(b2);
  assert.equal(p.status, 'pending', `past the window the lock did not bill: ${JSON.stringify(p)}`);
  await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = 24 WHERE id = 1`);
  assert.equal(await fee(db, shop2, later2), 'import', 'precondition: today a 24-month window would cover it');
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 101000 WHERE vendor_id = $1`, [b2]);
  const rd2 = await db.query<{ r: { action: string } }>(`SELECT public.booking_fee_rederive_lock_fee($1) AS r`, [b2]);
  assert.notEqual(rd2.rows[0]!.r.action, 'import_noop', 'a billed booking turned free when amended');
  const ledger = await db.query<{ a: string }>(
    `SELECT l.attribution AS a FROM public.booking_fee_ledger l
       JOIN public.booking_fee_charges c ON c.ledger_id = l.ledger_id
      WHERE c.event_vendor_id = $1 AND c.kind = 'primary'`,
    [b2],
  );
  assert.equal(ledger.rows[0]!.a, 'sourced', 'the ledger re-derived the attribution it froze at the yes');
});

test('7 · SQL and TypeScript draw the window on the same instants (calendar months, month ends clamp)', async () => {
  const pairs: Array<[string, string, number]> = [
    ['2026-02-28T00:00:00Z', '2027-02-28T00:00:00Z', 12],
    ['2026-02-28T00:00:01Z', '2027-02-28T00:00:00Z', 12],
    ['2024-02-29T12:00:00Z', '2025-02-28T12:00:00Z', 12],
    ['2024-02-29T12:00:01Z', '2025-02-28T12:00:00Z', 12],
    ['2026-03-31T09:00:00Z', '2026-09-30T09:00:00Z', 6],
    ['2026-03-30T09:00:00Z', '2026-09-30T09:00:00Z', 6],
    ['2026-02-28T00:00:00Z', '2026-08-31T00:00:00Z', 6],
    ['2026-03-01T00:00:00Z', '2026-08-31T00:00:00Z', 6],
    ['2026-01-31T23:59:59Z', '2027-01-31T23:59:59Z', 12],
    ['2026-11-20T08:00:00Z', '2027-11-20T07:59:59Z', 12],
    ['2025-12-31T00:00:00Z', '2026-01-30T00:00:00Z', 1],
  ];
  for (const [importAt, at, months] of pairs) {
    await db.query(`UPDATE public.platform_settings SET booking_fee_new_client_free_months = $1 WHERE id = 1`, [months]);
    const r = await db.query<{ c: boolean }>(
      `SELECT public.booking_fee_new_client_window_covers($1::timestamptz, $2::timestamptz) AS c`,
      [importAt, at],
    );
    assert.equal(newClientWindowCovers(importAt, at, months), r.rows[0]!.c, `${importAt} → ${at} (${months} mo)`);
  }
  // Fails toward the fee: no import time, or no readable months.
  const nul = await db.query<{ c: boolean }>(`SELECT public.booking_fee_new_client_window_covers(NULL, NOW()) AS c`);
  assert.equal(nul.rows[0]!.c, false);
  assert.equal(newClientWindowCovers(null, ago(0), 12), false);
  assert.equal(newClientWindowCovers(ago(1), ago(0), null), false);
});
