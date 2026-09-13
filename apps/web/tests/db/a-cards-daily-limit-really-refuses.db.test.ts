/**
 * A CARD'S DAILY LIMIT REALLY REFUSES — LOCK-PATH CAPACITY, migration
 * 20271222330608. The couple's half is proven as a REAL `authenticated` session
 * (SET ROLE + JWT claims); the count as `service_role`, exactly as the lock asks
 * it (vendors/actions.ts finalizeVendor "#2" → createAdminClient().rpc(...)).
 *
 * THE BUG, measured below before anything else: the #2 gate counted a card's
 * bookings on the couple's date by reading `events` + `event_vendors` through
 * the COUPLE'S session — and RLS shows a couple only their own events, so with
 * two other couples already booked on a card whose limit is 2, it counted 0 and
 * let a third couple lock.
 *
 * NOW: the gate reads its inputs through the couple's session (their own event's
 * date and precision, their own booking row's card) and asks ONE server-only
 * definer count, `service_card_bookings_on`, which sees every couple's booking
 * but answers only a number. The bench search asks the same count
 * (a-full-card-leaves-bench-search.db.test.ts); the TypeScript half of the gate
 * is pinned by lib/h6-mirrors-the-booking-path.test.ts.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271222330608_a_cards_daily_limit_really_refuses.sql';
const LIMIT = 2;
const DAY = '2027-10-16'; // two other couples already booked the card
const QUIET = '2027-10-17'; // one other couple booked it
const FIRST = '2027-11-01'; // two MONTH-only events are stored here — no bookings on the 1st

const F = {
  couple: '',
  vendorId: '',
  card: '',
  // the couple's own events and their (not yet confirmed) booking rows
  onDay: { eventId: '', rowId: '' },
  onQuiet: { eventId: '', rowId: '' },
  onFirst: { eventId: '', rowId: '' },
  monthOnly: { eventId: '', rowId: '' },
};

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asCouple<T>(fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, F.couple);
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

/** Another couple's event with one booking of `serviceId` on it. */
async function otherCouplesBooking(opts: {
  day: string;
  serviceId?: string;
  precision?: 'day' | 'month';
  status?: string;
  archived?: boolean;
}): Promise<void> {
  const ev = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Another couple', 'birthday', $1::date, $2) RETURNING event_id AS e`,
    [opts.day, opts.precision ?? 'day'],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, archived_at)
     VALUES ($1, 'misc', 'Daily Limit Studio', $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END)`,
    [ev.rows[0]!.e, opts.status ?? 'deposit_paid', F.vendorId, opts.serviceId ?? F.card, opts.archived ?? false],
  );
}

/** One of OUR couple's events, with the card shortlisted on it (the row they lock). */
async function ourEvent(day: string, precision: 'day' | 'month', serviceId = F.card): Promise<{ eventId: string; rowId: string }> {
  const ev = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Our wedding', 'birthday', $1::date, $2) RETURNING event_id AS e`,
    [day, precision],
  );
  const eventId = ev.rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, F.couple]);
  const row = await db.query<{ v: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'misc', 'Daily Limit Studio', 'shortlisted', $2, $3) RETURNING vendor_id AS v`,
    [eventId, F.vendorId, serviceId],
  );
  return { eventId, rowId: row.rows[0]!.v };
}

/**
 * The #2 gate, step for step as finalizeVendor runs it: the limit and the date
 * through the COUPLE'S session, the count through the SERVICE ROLE, scoped by
 * what the session read. Returns the refusal, or null when the lock may go on.
 */
async function gate(own: { eventId: string; rowId: string }): Promise<{ limit: number; booked: number } | null> {
  const read = await asCouple(async () => {
    const row = await db.query<{ service_id: string }>(
      `SELECT service_id FROM public.event_vendors WHERE vendor_id = $1 AND event_id = $2`,
      [own.rowId, own.eventId],
    );
    assert.equal(row.rows.length, 1, 'the couple cannot read their own booking row — the gate would never run');
    const svc = await db.query<{ daily_capacity: number | null }>(
      `SELECT daily_capacity FROM public.vendor_services WHERE vendor_service_id = $1`,
      [row.rows[0]!.service_id],
    );
    assert.equal(svc.rows.length, 1, 'the couple cannot read the card’s limit — the gate would degrade open and prove nothing');
    const ev = await db.query<{ event_date: string | null; event_date_precision: string }>(
      `SELECT event_date::text AS event_date, event_date_precision FROM public.events WHERE event_id = $1`,
      [own.eventId],
    );
    assert.equal(ev.rows.length, 1, 'the couple cannot read their own event');
    return { serviceId: row.rows[0]!.service_id, limit: svc.rows[0]?.daily_capacity ?? null, ...ev.rows[0]! };
  });
  if (typeof read.limit !== 'number' || read.limit <= 0) return null;
  if (!read.event_date || read.event_date_precision !== 'day') return null;
  const booked = await asService(async () =>
    (
      await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date, $3) AS n`, [
        read.serviceId,
        read.event_date,
        own.rowId,
      ])
    ).rows[0]!.n,
  );
  return booked >= read.limit ? { limit: read.limit, booked } : null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('limit-couple@capacity.test', 'customer');
  const shopUser = await mkUser('limit-shop@capacity.test', 'vendor');
  F.vendorId = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Daily Limit Studio')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [shopUser],
    )
  ).rows[0]!.v;
  // A booked card needs a verified shop (enforce_booking_requires_verified_vendor).
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility
      WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  const mkCard = async () =>
    (
      await db.query<{ s: string }>(
        // Drafted with a cover, then given a "what's included" line below, so
        // the H2 publish gate (20271222415682) lets it go live.
        `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
         VALUES ($1, 'photo_booth', 40000, 'Free extra hour', FALSE, 'vendor-media/daily-limit/cover.jpg') RETURNING vendor_service_id AS s`,
        [F.vendorId],
      )
    ).rows[0]!.s;
  F.card = await mkCard();
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [F.card, F.vendorId],
  );
  // Active, on a public verified shop — the card the couple's session can read
  // its limit from, exactly as the gate reads it.
  await db.query(`UPDATE public.vendor_services SET daily_capacity = $2, is_active = TRUE WHERE vendor_service_id = $1`, [F.card, LIMIT]);

  // DAY: two other couples booked — the card is full.
  await otherCouplesBooking({ day: DAY, status: 'deposit_paid' });
  await otherCouplesBooking({ day: DAY, status: 'contracted' });
  // …and three rows that are NOT bookings: archived, only shortlisted, month-only elsewhere.
  await otherCouplesBooking({ day: DAY, archived: true });
  await otherCouplesBooking({ day: DAY, status: 'shortlisted' });
  // QUIET: one other couple — room for one more.
  await otherCouplesBooking({ day: QUIET, status: 'complete' });
  // FIRST: two MONTH-only events, stored as the 1st. Neither is a booking on the 1st.
  await otherCouplesBooking({ day: FIRST, precision: 'month', status: 'deposit_paid' });
  await otherCouplesBooking({ day: FIRST, precision: 'month', status: 'contracted' });

  F.onDay = await ourEvent(DAY, 'day');
  F.onQuiet = await ourEvent(QUIET, 'day');
  F.onFirst = await ourEvent(FIRST, 'day');
  F.monthOnly = await ourEvent(DAY, 'month'); // our own month-only event, stored on DAY
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · anti-vacuity ─────────────────────────────────────────────────────── */

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('META: the couple’s session is authenticated, not the owner, not a superuser, no BYPASSRLS', async () => {
  const r = await asCouple(() =>
    db.query<{ me: string; owner: string; bypass: boolean; super: boolean }>(
      `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
         FROM pg_class c WHERE c.oid = 'public.event_vendors'::regclass`,
    ),
  );
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
  assert.equal(r.rows[0]!.super, false);
});

/* ── 1 · the bug, measured ─────────────────────────────────────────────────── */

test('THE BUG: through the couple’s own session, the old count saw none of the other couples’ bookings', async () => {
  // The old gate: every event on the date, then the card's confirmed rows on them.
  const seen = await asCouple(async () => {
    const events = await db.query<{ event_id: string }>(`SELECT event_id FROM public.events WHERE event_date = $1::date`, [DAY]);
    const ids = events.rows.map((r) => r.event_id);
    const rows = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.event_vendors
        WHERE service_id = $1 AND status IN ('contracted','deposit_paid','delivered','complete')
          AND archived_at IS NULL AND event_id = ANY($2::uuid[]) AND vendor_id <> $3`,
      [F.card, ids, F.onDay.rowId],
    );
    return { events: ids.length, booked: rows.rows[0]!.n };
  });
  const truth = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors ev JOIN public.events e ON e.event_id = ev.event_id
      WHERE ev.service_id = $1 AND e.event_date = $2::date AND ev.status IN ('contracted','deposit_paid') AND ev.archived_at IS NULL`,
    [F.card, DAY],
  );
  assert.equal(truth.rows[0]!.n, LIMIT, 'fixture: two other couples booked the card that day');
  assert.equal(seen.booked, 0, 'the couple’s session sees other couples’ bookings — RLS changed; re-derive this suite');
  console.log(`# old count under the couple's session: ${seen.booked} of ${truth.rows[0]!.n} real bookings (it only saw its own ${seen.events} event(s))`);
});

/* ── 2 · the gate now ─────────────────────────────────────────────────────── */

test('a THIRD couple is refused on a card whose daily limit is 2', async () => {
  const refusal = await gate(F.onDay);
  assert.ok(refusal, 'the third booking went through — the daily limit still refuses nothing');
  assert.deepEqual(refusal, { limit: LIMIT, booked: LIMIT });
  console.log(`# third booking on a limit-${LIMIT} card: REFUSED (${refusal.booked}/${refusal.limit})`);
});

test('POSITIVE CONTROL: a day with room still books', async () => {
  assert.equal(await gate(F.onQuiet), null, 'a day with one booking of two was refused');
});

test('MONTH-ONLY events are no booking on the 1st — two of them leave the 1st open', async () => {
  assert.equal(await gate(F.onFirst), null, 'month-only events stored on the 1st were counted as bookings on the 1st');
  const n = await asService(async () =>
    (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [F.card, FIRST])).rows[0]!.n,
  );
  assert.equal(n, 0);
  // …and without the precision rule they WOULD have filled it: prove the fixture has teeth.
  const naive = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors ev JOIN public.events e ON e.event_id = ev.event_id
      WHERE ev.service_id = $1 AND e.event_date = $2::date AND ev.status IN ('contracted','deposit_paid') AND e.event_date_precision = 'month'`,
    [F.card, FIRST],
  );
  assert.equal(naive.rows[0]!.n, LIMIT);
});

test('the couple’s OWN month-only event is not gated on its placeholder day', async () => {
  // Stored on DAY — which is full — but the date is only a month.
  assert.equal(await gate(F.monthOnly), null);
});

test('archived and merely-shortlisted rows are not bookings', async () => {
  const n = await asService(async () =>
    (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [F.card, DAY])).rows[0]!.n,
  );
  assert.equal(n, LIMIT, 'the count included an archived or shortlisted row (4 rows sit on that day)');
});

test('the gate’s own row is excluded — re-running it never counts the couple against themselves', async () => {
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [F.onQuiet.rowId]);
  try {
    const withSelf = await asService(async () =>
      (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [F.card, QUIET])).rows[0]!.n,
    );
    const withoutSelf = await asService(async () =>
      (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date, $3) AS n`, [F.card, QUIET, F.onQuiet.rowId])).rows[0]!.n,
    );
    assert.deepEqual({ withSelf, withoutSelf }, { withSelf: 2, withoutSelf: 1 });
  } finally {
    await db.query(`UPDATE public.event_vendors SET status = 'shortlisted' WHERE vendor_id = $1`, [F.onQuiet.rowId]);
  }
});

/* ── 3 · the bench search asks the same count ────────────────────────────── */

test('the bench search hides the card on the full day, and only there', async () => {
  const r = await asService(() =>
    db.query<{ service_id: string; refused_on: string }>(
      `SELECT service_id, refused_on::text AS refused_on FROM public.service_cards_unbookable_on($1::uuid[], $2::date[])`,
      [[F.card], [DAY, QUIET, FIRST]],
    ),
  );
  assert.deepEqual(r.rows.map((x) => x.refused_on), [DAY]);
});

/* ── 4 · who may ask ──────────────────────────────────────────────────────── */

test('no browser may ask the count — anon and signed-in callers are refused, the server answers', async () => {
  const call = () => db.query(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [F.card, DAY]);
  await assert.rejects(asCouple(call), /permission denied/, 'a signed-in account can count a supplier’s bookings');
  await setRole('anon');
  await db.exec('SET ROLE anon');
  try {
    await assert.rejects(call(), /permission denied/, 'anon can count a supplier’s bookings');
  } finally {
    await reset();
  }
  const ok = await asService(call);
  assert.equal(ok.rows.length, 1);
});

test('the count is SECURITY DEFINER, STABLE, search_path pinned — and returns one number', async () => {
  const r = await db.query<{ secdef: boolean; vol: string; cfg: string[] | null; ret: string }>(
    `SELECT p.prosecdef AS secdef, p.provolatile::text AS vol, p.proconfig AS cfg, format_type(p.prorettype, NULL) AS ret
       FROM pg_proc p WHERE p.oid = 'public.service_card_bookings_on(uuid, date, uuid)'::regprocedure`,
  );
  assert.equal(r.rows[0]!.secdef, true, 'under the caller it would count only the caller’s own bookings again');
  assert.equal(r.rows[0]!.vol, 's');
  assert.ok((r.rows[0]!.cfg ?? []).some((c) => c.startsWith('search_path=')));
  assert.equal(r.rows[0]!.ret, 'integer');
});
