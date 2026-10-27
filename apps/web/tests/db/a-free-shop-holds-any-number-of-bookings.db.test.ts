/**
 * A FREE SHOP HOLDS ANY NUMBER OF BOOKINGS — migration 20271293507816.
 *
 * ⚖ OWNER 2026-10-28 (DECISION_LOG, money rule), verbatim: "Remove the limit."
 * The free-tier cap (`enforce_free_tier_booking_cap`, 20271001120000) refused a
 * free/verified shop's 4th concurrent booking — contracted · deposit_paid ·
 * delivered, one per event — behind `platform_settings.free_tier_booking_cap_enabled`.
 * It contradicted the 2026-10-23 ruling (free gets every work tool; paid is
 * reach · scale · time), so the trigger, the function, the switch and the
 * supplier's 'fully_booked' answer are gone.
 *
 * The PROPERTY, proven as the real booking path: a free shop already holding
 * three live bookings presses Agree on a fourth — as a genuine `authenticated`
 * supplier session — and it BOOKS; a fifth booked straight on the row books too.
 *
 * NEUTRALISED: the old trigger re-installed inside a rolled-back transaction,
 * switch on, refuses the same fixture's next booking — so this file's fixture
 * really sits AT the old cap and the green above is not vacuous.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { LOCK_AGREE_STATUSES } from '../../lib/lock-answer-notice';

let replay: ReplayResult;
let db: PGlite;

const MIGRATIONS = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
/** The migration that created the cap — re-installed only inside a ROLLBACK. */
const CAP_FILE = '20271001120000_free_tier_booking_cap_trigger.sql';
/** The old cap counted these, one per event. */
const LIVE = ['contracted', 'deposit_paid', 'delivered'] as const;

const F = { couple: '', supplier: '', shop: '', card: '' };

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
      [`${label}-${++seq}@no-booking-cap.test`, type],
    )
  ).rows[0]!.id;
}

/** A verified shop on the FREE plan, owned by a real supplier account. */
async function mkFreeShop(label: string): Promise<{ uid: string; vpid: string }> {
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
            public_visibility = 'verified'::public.vendor_public_visibility,
            tier_state = 'free'
      WHERE vendor_profile_id = $1`,
    [vpid, label],
  );
  return { uid, vpid };
}

/** A LIVE card with no "Bookings per day" limit (drafted, given a cover + one line, then published). */
async function mkCard(vpid: string): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'photo_booth', 40000, 'Free extra hour', FALSE, 'vendor-media/no-booking-cap/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = TRUE WHERE vendor_service_id = $1`, [s.rows[0]!.s]);
  return s.rows[0]!.s;
}

/** A couple's event on `day` (each booking on its own date, so no per-date rule is in play). */
async function mkEvent(day: string): Promise<string> {
  const eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A couple', 'birthday', $1::date, 'day') RETURNING event_id AS e`,
      [day],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    F.couple,
  ]);
  return eventId;
}

/** A pending ask, exactly as the couple's Lock writes one under the handshake. */
async function ask(day: string): Promise<string> {
  const eventId = await mkEvent(day);
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, lock_request_state, lock_requested_at)
       VALUES ($1, 'misc', 'Free Shop Studio', 'considering', $2, $3, 'pending', NOW())
       RETURNING vendor_id AS v`,
      [eventId, F.shop, F.card],
    )
  ).rows[0]!.v;
}

/** The supplier presses Agree — as themselves. */
async function agree(rowId: string): Promise<{ status: string }> {
  return asUser(F.supplier, async () => {
    const r = await db.query<{ r: { status: string } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId]);
    return r.rows[0]!.r;
  });
}

async function rowStatus(rowId: string): Promise<string> {
  return (
    await db.query<{ s: string }>(`SELECT status::text AS s FROM public.event_vendors WHERE vendor_id = $1`, [rowId])
  ).rows[0]!.s;
}

/** Live bookings (one per event) the free shop holds — the number the old cap counted. */
async function liveEvents(): Promise<number> {
  return (
    await db.query<{ n: number }>(
      `SELECT count(DISTINCT event_id)::int AS n FROM public.event_vendors
        WHERE marketplace_vendor_id = $1 AND status = ANY($2::public.vendor_status[])`,
      [F.shop, [...LIVE]],
    )
  ).rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.couple = await mkUser('couple', 'customer');
  ({ uid: F.supplier, vpid: F.shop } = await mkFreeShop('Free Shop Studio'));
  F.card = await mkCard(F.shop);
  // Three live bookings already held — one in each status the old cap counted.
  for (const [i, status] of LIVE.entries()) {
    const eventId = await mkEvent(`2028-03-0${i + 1}`);
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, 'misc', 'Free Shop Studio', $2::public.vendor_status, $3, $4)`,
      [eventId, status, F.shop, F.card],
    );
  }
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the cap is gone from the schema: no trigger, no function, no switch', async () => {
  const trg = await db.query(
    `SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.event_vendors'::regclass AND tgname = 'enforce_free_tier_booking_cap_trg'`,
  );
  assert.equal(trg.rows.length, 0, 'the free-tier booking cap trigger is still on event_vendors');
  const fn = await db.query<{ p: string | null }>(`SELECT to_regprocedure('public.enforce_free_tier_booking_cap()')::text AS p`);
  assert.equal(fn.rows[0]!.p, null, 'enforce_free_tier_booking_cap() still exists');
  const col = await db.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'free_tier_booking_cap_enabled'`,
  );
  assert.equal(col.rows.length, 0, 'the switch that turns the cap on still exists');
});

test('the supplier’s yes can no longer answer "fully booked", and the app has no sentence for it', async () => {
  const def = (
    await db.query<{ def: string }>(`SELECT pg_get_functiondef('public.vendor_agree_to_lock(uuid)'::regprocedure) AS def`)
  ).rows[0]!.def;
  assert.ok(def.includes("'status', 'not_verified'"), 'the scan found no statuses — the body moved, re-read this test');
  assert.ok(!def.includes("'fully_booked'"), 'vendor_agree_to_lock still answers fully_booked');
  assert.ok(!def.includes('free_tier_booking_cap'), 'vendor_agree_to_lock still listens for the cap’s message');
  assert.ok(!LOCK_AGREE_STATUSES.includes('fully_booked'), 'lib/lock-answer-notice.ts still words the free-tier limit');
});

test('a FREE shop holding three live bookings agrees to a fourth, and it books', async () => {
  assert.equal(await liveEvents(), 3, 'the fixture does not hold three live bookings — the test would prove nothing');
  const fourth = await ask('2028-03-10');
  const r = await agree(fourth);
  assert.equal(r.status, 'ok', `the free shop’s 4th yes answered ${JSON.stringify(r)}`);
  assert.equal(await rowStatus(fourth), 'contracted', 'the 4th booking did not book');
  assert.equal(await liveEvents(), 4);
});

test('…and a fifth, written straight onto the booking row, books too', async () => {
  const fifth = await ask('2028-03-11');
  await db.query(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [fifth]);
  assert.equal(await rowStatus(fifth), 'deposit_paid');
  assert.equal(await liveEvents(), 5);
});

test('NEUTRALISED: with the old cap re-installed and switched on, the same shop’s next yes is refused', async () => {
  const sql = readFileSync(join(MIGRATIONS, CAP_FILE), 'utf8');
  await db.exec('BEGIN');
  try {
    await db.exec(sql);
    await db.exec(`UPDATE public.platform_settings SET free_tier_booking_cap_enabled = TRUE WHERE id = 1`);
    const next = await ask('2028-03-12');
    await assert.rejects(
      agree(next),
      /free_tier_booking_cap/,
      'the re-installed cap did not refuse — this fixture is not at the old limit, so the green above proves nothing',
    );
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
  const trg = await db.query(
    `SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.event_vendors'::regclass AND tgname = 'enforce_free_tier_booking_cap_trg'`,
  );
  assert.equal(trg.rows.length, 0, 'the rollback did not remove the re-installed trigger');
});
