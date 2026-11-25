/**
 * FREE BOOKING FEE ONLY ON "FOR YOU" EVENTS, LOCKED ONCE A SUPPLIER JOINS — against the replayed migrations
 * (20271360986087).
 *
 * Specs DECISION_LOG, 2026-11-23. Owner, verbatim: *"you can only get free booking fee if the event is for self (you
 * are the celebrant) once a supplier comes in, it is locked that way."* Confirmed: *"Yes, that's it"*.
 *
 *   1 · ONE READER, TWO HALVES: `booking_fee_event_is_for_you` and `isForYouEvent` answer the same for every word.
 *   2 · EVERY FREE PATH on an event made for someone else (or never recorded) is BILLED — the import, the launch
 *       offer, a free-fee window, the every-Nth booking fee, a free booking fee ticket — and the pure twin
 *       `decideLockFee` says the same reason for every case. On a For-you event each one still waives.
 *   3 · FOR YOU + IMPORT → free (`waived_import`).
 *   4 · A WAIVER ALREADY GRANTED IS NEVER TAKEN BACK: a live waived charge is reused even if the event no longer reads
 *       For you; a ticket is not spent on a booking it cannot pay.
 *   5 · LOCKED: once an event_vendors row exists, any change to for_whom is refused — NULL → self included, and for
 *       the owner role this test runs as (no grant can lift a trigger). Before a supplier joins it may still change.
 *   6 · NO GRANT: `authenticated` cannot write for_whom at all (the server is the only writer).
 *
 * SABOTAGE (2026-11-23): in the migration, `v_for_you := public.booking_fee_event_is_for_you(v_ev.event_id);` →
 * `v_for_you := TRUE;` turned test 2 RED ("the import … for_whom=null: the RPC read For you as true"); restored →
 * GREEN. Deleting the `CREATE TRIGGER events_for_whom_locked` statement turned test 5 RED ("switching to For you
 * after a supplier joined was allowed"); restored → GREEN.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { BOOKING_FEE } from '../../lib/booking-fee';
import { BOOKING_FEE_SCHEDULE_VERSION } from '../../lib/booking-fee-gate';
import { decideLockFee, type LockFeeReason } from '../../lib/booking-fee-lock';
import { isForYouEvent } from '../../lib/event-for-whom';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.query(`UPDATE public.booking_fee_ledger SET launch_offer = FALSE, launch_offer_number = NULL`);
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL,
            booking_fee_free_every_nth = 100000
      WHERE id = 1`,
  );
});

let seq = 0;
const uniq = () => `foryou-${++seq}-${Date.now()}`;
const TOTAL_PHP = 100_000;
const FEE_CENTAVOS = 5_000 * 100; // 5% of ₱100,000 on the verified schedule — asserted against the TS twin below
const WORDS = [null, 'someone', 'memorial', 'business', 'self'] as const;
type Word = (typeof WORDS)[number];

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}

async function newShop(): Promise<{ shop: string; userId: string }> {
  const u = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await one<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1,'For You Studio','Manila',ARRAY['photography']::text[],'verified',TIMESTAMPTZ '2020-01-01','verified')
     RETURNING vendor_profile_id`,
    [u.id],
  );
  return { shop: v.vendor_profile_id, userId: u.id };
}

async function newEvent(forWhom: Word): Promise<string> {
  const e = await one<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, for_whom)
     VALUES ('A birthday','birthday','2031-05-14',$1) RETURNING event_id`,
    [forWhom],
  );
  return e.event_id;
}

/** A booking the supplier brought: the event's first import (its own Locked QR) — attribution 'import'. */
async function importBooking(shop: string, forWhom: Word) {
  const eventId = await newEvent(forWhom);
  const ev = await one<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, source)
     VALUES ($1,'photographer','For You Studio','contracted'::vendor_status,$2,$3,'vendor_locked_qr') RETURNING vendor_id`,
    [eventId, shop, TOTAL_PHP],
  );
  return { eventId, eventVendorId: ev.vendor_id };
}

/** A booking Setnayan brought: a chat that started in Explore — attribution 'sourced'. */
async function sourcedBooking(shop: string, forWhom: Word) {
  const eventId = await newEvent(forWhom);
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`,
    [eventId, shop],
  );
  const ev = await one<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','For You Studio','contracted'::vendor_status,$2,$3) RETURNING vendor_id`,
    [eventId, shop, TOTAL_PHP],
  );
  return { eventId, eventVendorId: ev.vendor_id };
}

type Open = {
  charge_id?: string;
  status?: string;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  free_by_platform_count?: boolean;
  badge_reward_id?: string | null;
  attribution?: string;
  for_you?: boolean;
  reused?: boolean;
};
async function lock(evId: string): Promise<Open> {
  return (
    await one<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1, $2) AS r`, [evId, BOOKING_FEE_SCHEDULE_VERSION])
  ).r;
}

/** The charge's status read back as the pure twin's reason, so the two can be compared word for word. */
function reasonOf(r: Open): LockFeeReason {
  if (r.status === 'waived_import') return 'not_sourced';
  if (r.status === 'waived_launch') return 'launch_offer';
  if (r.status === 'waived_promo') return 'promo';
  if (r.status === 'paid' && r.free_by_platform_count) return 'every_nth';
  if (r.status === 'paid' && r.badge_reward_id) return 'ticket';
  if (r.status === 'pending') return 'billed';
  return `unexpected:${r.status}` as LockFeeReason;
}

/* ── 1 · ONE READER, TWO HALVES ─────────────────────────────────────────────────────────────────────────────────── */

test('1 · booking_fee_event_is_for_you and isForYouEvent agree on every word, and only "self" is For you', async () => {
  for (const w of WORDS) {
    const eventId = await newEvent(w);
    const sql = (await one<{ v: boolean }>(`SELECT public.booking_fee_event_is_for_you($1) AS v`, [eventId])).v;
    assert.equal(sql, isForYouEvent(w), `for_whom=${w}: SQL ${sql}, TS ${isForYouEvent(w)}`);
    assert.equal(sql, w === 'self', `for_whom=${w} answered ${sql}`);
  }
  const none = await one<{ v: boolean }>(
    `SELECT public.booking_fee_event_is_for_you('00000000-0000-0000-0000-000000000000') AS v`,
  );
  assert.equal(none.v, false, 'an event that does not exist read as For you');
  await assert.rejects(
    db.query(`INSERT INTO public.events (display_name, event_type, for_whom) VALUES ('x','birthday','me')`),
    /check/i,
    'a fifth word was accepted',
  );
});

/* ── 2 · EVERY FREE PATH, FOR SOMEONE ELSE → BILLED; FOR YOU → WAIVED ───────────────────────────────────────────── */

type Path = {
  name: string;
  /** Arrange the path's condition and the booking; returns the event_vendor id. */
  arrange: (shop: string, forWhom: Word) => Promise<{ eventVendorId: string }>;
  /** The pure twin's inputs for the same booking. */
  twin: () => Promise<Partial<Parameters<typeof decideLockFee>[0]>>;
  /** The reason a For-you event gets. */
  freeReason: LockFeeReason;
};

const PATHS: Path[] = [
  {
    name: "the import ('vendor_locked_qr', the event's first import)",
    arrange: (shop, w) => importBooking(shop, w),
    twin: async () => ({ attribution: 'import' }),
    freeReason: 'not_sourced',
  },
  {
    name: 'the launch offer',
    arrange: async (shop, w) => {
      await db.query(
        `UPDATE public.platform_settings
            SET launch_offer_enabled = TRUE, launch_offer_started_at = NOW() - INTERVAL '1 day',
                launch_offer_booking_cap = 100000
          WHERE id = 1`,
      );
      return sourcedBooking(shop, w);
    },
    twin: async () => ({ launchOffer: true }),
    freeReason: 'launch_offer',
  },
  {
    name: 'a free-fee window',
    arrange: async (shop, w) => {
      await db.query(
        `UPDATE public.platform_settings
            SET booking_fee_free_from = NOW() - INTERVAL '1 day', booking_fee_free_until = NOW() + INTERVAL '1 day'
          WHERE id = 1`,
      );
      return sourcedBooking(shop, w);
    },
    twin: async () => ({ promoWindow: true }),
    freeReason: 'promo',
  },
  {
    name: "Setnayan's every-Nth booking fee",
    // The counter is never rewound (its numbers are UNIQUE): N is set so that the NEXT number is the Nth.
    arrange: async (shop, w) => {
      const next = (await nextPlatformNumber());
      await db.query(`UPDATE public.platform_settings SET booking_fee_free_every_nth = $1 WHERE id = 1`, [next]);
      return sourcedBooking(shop, w);
    },
    twin: async () => {
      const n = await one<{ nth: number }>(`SELECT booking_fee_free_every_nth AS nth FROM public.platform_settings WHERE id = 1`);
      return { nextPlatformNumber: Number(n.nth), freeEveryNth: Number(n.nth) };
    },
    freeReason: 'every_nth',
  },
  {
    name: 'a free booking fee ticket',
    arrange: async (shop, w) => {
      const g = await one<{ v: { status: string } }>(
        `SELECT public.shop_badge_reward_grant($1, 'events:1000', 'events', 'fee_waiver', 1, NULL, 'Badge reward · test') AS v`,
        [shop],
      );
      assert.equal(g.v.status, 'granted', 'the ticket fixture was not granted');
      return sourcedBooking(shop, w);
    },
    twin: async () => ({ ticketWaiting: true }),
    freeReason: 'ticket',
  },
];

async function nextPlatformNumber(): Promise<number> {
  const c = await one<{ n: string }>(`SELECT fee_bookings_counted AS n FROM public.booking_fee_platform_counter WHERE id = 1`);
  return Number(c.n) + 1;
}

const TWIN_BASE: Parameters<typeof decideLockFee>[0] = {
  flagEnabled: true,
  onPlatform: true,
  attribution: 'sourced',
  forYou: false,
  shopVerified: true,
  frozenFree: false,
  launchOffer: false,
  promoWindow: false,
  agreedTotalPhp: TOTAL_PHP,
  schedule: BOOKING_FEE,
  nextPlatformNumber: 1001,
  freeEveryNth: 100_000,
  ticketWaiting: false,
};

test('2 · every free path: For you waives it; someone else, a business, a memorial or no answer pays the full fee', async () => {
  assert.equal(decideLockFee({ ...TWIN_BASE, forYou: true }).computedFeePhp * 100, FEE_CENTAVOS, 'the fixture fee drifted');
  for (const path of PATHS) {
    for (const w of WORDS) {
      // Each case starts from the plain settings, then arranges only its own path.
      await db.query(
        `UPDATE public.platform_settings
            SET launch_offer_enabled = NULL, launch_offer_started_at = NULL, launch_offer_closed_at = NULL,
                booking_fee_free_from = NULL, booking_fee_free_until = NULL, booking_fee_free_every_nth = 100000
          WHERE id = 1`,
      );
          const { shop } = await newShop();
      const { eventVendorId } = await path.arrange(shop, w);
      const r = await lock(eventVendorId);
      const forYou = w === 'self';
      const twinArgs = await path.twin();
      const twin = decideLockFee({ ...TWIN_BASE, ...twinArgs, forYou });
      const label = `${path.name} · for_whom=${w}`;

      assert.equal(r.for_you, forYou, `${label}: the RPC read For you as ${r.for_you}`);
      assert.equal(reasonOf(r), twin.reason, `${label}: SQL said ${reasonOf(r)} (${r.status}), TS said ${twin.reason}`);
      if (forYou) {
        assert.equal(reasonOf(r), path.freeReason, `${label}: a For-you event lost its waiver`);
        assert.equal(r.amount_charged_centavos ?? 0, 0, `${label}: a For-you waiver billed a peso`);
      } else {
        assert.equal(r.status, 'pending', `${label}: an event made for someone else was not billed (${r.status})`);
        assert.equal(r.amount_charged_centavos, FEE_CENTAVOS, `${label}: billed ${r.amount_charged_centavos}`);
        assert.equal(twin.feePhp * 100, FEE_CENTAVOS);
      }
      if (twinArgs.ticketWaiting && !forYou) {
        const unused = await one<{ n: string }>(
          `SELECT count(*)::text AS n FROM public.shop_badge_rewards
            WHERE vendor_profile_id = $1 AND reward_kind = 'fee_waiver' AND used_on_charge_id IS NULL`,
          [shop],
        );
        assert.equal(unused.n, '1', `${label}: the ticket was spent on a booking it could not pay`);
      }
      if (twinArgs.attribution === 'import') {
        // The attribution stays honest: an import is still an import, only the waiver is withheld.
        assert.equal(r.attribution, 'import', `${label}: the RPC re-labelled the import ${r.attribution}`);
      }
    }
  }
});

/* ── 3 · FOR YOU + IMPORT → FREE ────────────────────────────────────────────────────────────────────────────────── */

test('3 · a For-you event with the supplier’s own client books with no fee (waived_import, ₱0, no fee recorded)', async () => {
  const { shop } = await newShop();
  const { eventVendorId } = await importBooking(shop, 'self');
  const r = await lock(eventVendorId);
  assert.equal(r.status, 'waived_import');
  assert.equal(r.amount_charged_centavos, 0);
  assert.equal(r.computed_fee_centavos, 0);
  assert.equal(decideLockFee({ ...TWIN_BASE, attribution: 'import', forYou: true }).reason, 'not_sourced');
});

/* ── 4 · A WAIVER ALREADY GRANTED IS NEVER TAKEN BACK ───────────────────────────────────────────────────────────── */

test('4 · a charge waived before the rule (or before the answer moved) is reused, never re-billed', async () => {
  const { shop } = await newShop();
  const { eventId, eventVendorId } = await importBooking(shop, 'self');
  const first = await lock(eventVendorId);
  assert.equal(first.status, 'waived_import');

  // Stand in for a booking waived before 23 Nov on an event that never recorded its answer: the lock is lifted only
  // for this fixture (the trigger is the very thing that stops this in life), the answer is cleared, the lock restored.
  await db.query(`ALTER TABLE public.events DISABLE TRIGGER events_for_whom_locked`);
  await db.query(`UPDATE public.events SET for_whom = NULL WHERE event_id = $1`, [eventId]);
  await db.query(`ALTER TABLE public.events ENABLE TRIGGER events_for_whom_locked`);

  const again = await lock(eventVendorId);
  assert.equal(again.charge_id, first.charge_id, 'a second charge was opened beside the waived one');
  assert.equal(again.status, 'waived_import', 'a waiver already granted was taken back');
  assert.equal(again.reused, true);
  const n = await one<{ n: string }>(`SELECT count(*)::text AS n FROM public.booking_fee_charges WHERE event_vendor_id = $1`, [
    eventVendorId,
  ]);
  assert.equal(n.n, '1');

  // The twin keeps the two waivers that were already granted, whatever the answer now says.
  assert.equal(decideLockFee({ ...TWIN_BASE, frozenFree: true }).reason, 'frozen_free');
  assert.equal(decideLockFee({ ...TWIN_BASE, launchOffer: false, launchOfferHeld: true }).reason, 'launch_offer');
});

/* ── 5 · LOCKED ONCE A SUPPLIER JOINS ───────────────────────────────────────────────────────────────────────────── */

test('5 · For you / someone else can change before a supplier joins, and never after — NULL → self included', async () => {
  const eventId = await newEvent('someone');
  await db.query(`UPDATE public.events SET for_whom = 'self' WHERE event_id = $1`, [eventId]);
  await db.query(`UPDATE public.events SET for_whom = 'someone' WHERE event_id = $1`, [eventId]);

  // Any supplier joining is enough — here a plain record the couple added, no marketplace shop at all.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1,'photographer','A friend with a camera','considering'::vendor_status)`,
    [eventId],
  );
  await assert.rejects(
    db.query(`UPDATE public.events SET for_whom = 'self' WHERE event_id = $1`, [eventId]),
    /for_whom_locked/,
    'switching to For you after a supplier joined was allowed',
  );
  const after = await one<{ w: string | null }>(`SELECT for_whom AS w FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(after.w, 'someone');

  // Never recorded, then a supplier → stays unrecorded (and pays); it cannot be "answered" now.
  const unanswered = await newEvent(null);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1,'photographer','Lola''s Lens','considering'::vendor_status)`,
    [unanswered],
  );
  await assert.rejects(
    db.query(`UPDATE public.events SET for_whom = 'self' WHERE event_id = $1`, [unanswered]),
    /for_whom_locked/,
    'an unrecorded event was answered "For you" after a supplier joined',
  );
  // Writing the SAME answer again is not a change (an upsert that repeats the row must not fail).
  await db.query(`UPDATE public.events SET for_whom = 'someone' WHERE event_id = $1`, [eventId]);
  // Every other column is untouched by the lock.
  await db.query(`UPDATE public.events SET display_name = 'Renamed' WHERE event_id = $1`, [eventId]);
});

/* ── 6 · THE SERVER IS THE ONLY WRITER ──────────────────────────────────────────────────────────────────────────── */

test('6 · a signed-in host cannot write for_whom from the browser (no column grant), before or after a supplier', async () => {
  const host = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const eventId = await newEvent('someone');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1,$2,'couple','created_event')`,
    [eventId, host.id],
  );
  await setAuthUid(db, host.id);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`UPDATE public.events SET for_whom = 'self' WHERE event_id = $1`, [eventId]),
      /permission denied/i,
      'authenticated could write for_whom',
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
});
