/**
 * THE CARD RECORD reader — END-TO-END DB verification (migrations replayed).
 *
 * Covers 20271018283550_service_card_record_reader. Every claim this feature
 * makes to a stranger is a boundary, so each is asserted against real SQL
 * rather than mocked:
 *
 *   • the PRIVACY ENVELOPE is real — the payload's keys are exactly
 *     {event_type, month_year, pax_band}; no id, no name, no exact date and no
 *     exact head-count can be reached through it, and the month carries no day;
 *   • pax is BANDED IN SQL at the documented thresholds (the TypeScript side
 *     owns only the labels, so this is the only place the numbers exist);
 *   • GATE (a) the MINIMUM-N FLOOR bites at exactly 3, it counts ARM'S-LENGTH
 *     events so padding cannot buy past it, and the COUNT is never suppressed;
 *   • GATE (b) the ledger boundary is the COMPLETED MONTH, not yesterday — so
 *     the day a row first appears cannot betray the exact event_date;
 *   • GATE (c) the ledger is PAST-ONLY and capped at 6, newest first — a future
 *     booking counts toward the total but never becomes a row;
 *   • "booked" really is the shared four-status set, via the named helper;
 *   • ONE BOOKING IS ONE EVENT — a package cascade's covered rows cannot
 *     multiply the count;
 *   • ANTI-PADDING bites: a vendor booking their own event does not raise the
 *     public number, and archived / fraud-voided rows are excluded;
 *   • the GRANT posture is the one the migration claims — the reader is NOT
 *     anon-callable (both call sites are server-side, so anon EXECUTE would be
 *     surface with no consumer plus the path to probing draft/paused cards),
 *     and both helpers are callable by NEITHER anon NOR authenticated (naming
 *     the roles, not just PUBLIC — the 2026-07-26 lesson);
 *   • the batch is CAPPED, and the superseded per-card signature is gone.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let vendorProfileId: string;
let vendorOwnerId: string;
let serviceId: string;
/** A second card on the same shop — proves the record is per-CARD, not per-shop. */
let otherServiceId: string;

type RecordRow = {
  booked_count: number;
  type_mix: { event_type: string; n: number }[];
  ledger: { event_type: string; month_year: string; pax_band: string }[];
};

/** The reader is batched — read many cards in one call. */
async function readRecords(svcs: string[]): Promise<Map<string, RecordRow>> {
  const r = await db.query<{ vendor_service_id: string; record: RecordRow }>(
    `SELECT vendor_service_id, record FROM public.service_card_records($1::uuid[])`,
    [svcs],
  );
  return new Map(r.rows.map((row) => [row.vendor_service_id, row.record]));
}

/** One card, through the same batch reader. */
async function readRecord(svc: string): Promise<RecordRow> {
  const m = await readRecords([svc]);
  return m.get(svc)!;
}

/** A fresh card on the fixture shop, so a test's counts are not diluted. */
async function newCard(category: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, $2, 1000, 'Free extra hour') RETURNING vendor_service_id`,
    [vendorProfileId, category],
  );
  return r.rows[0]!.vendor_service_id;
}

/**
 * An event dated by a raw SQL expression, so boundary fixtures are exact
 * relative to the DATABASE's clock rather than the test process's. `expr` must
 * evaluate to a DATE.
 */
async function newEventAtExpr(name: string, expr: string): Promise<string> {
  // Always 'birthday': a non-wedding needs no ceremony_type / venue_setting, so
  // the biconditional CHECK stays satisfied with both NULL.
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, estimated_pax, ceremony_type, venue_setting)
     VALUES ($1, 'birthday', (${expr})::date, 100, NULL, NULL) RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** Manila "today" and the completed-month boundary, as the reader computes them. */
const MANILA_TODAY = `(now() AT TIME ZONE 'Asia/Manila')::date`;
const MONTH_START = `date_trunc('month', ${MANILA_TODAY})::date`;

/**
 * An event. `date` may be null; `pax` may be null (the common real-world case).
 *
 * NOTE `events.event_type` is TEXT, not an enum — 20261205000000 converted it
 * for the dynamic admin-authored vocab. That is precisely why the reader emits
 * raw slugs and the TypeScript side humanizes them: an admin can mint a type
 * this build has never heard of, and the card must still label it.
 */
async function newEvent(
  name: string,
  type: string,
  date: string | null,
  pax: number | null,
): Promise<string> {
  // events_wedding_fields_consistency is a BICONDITIONAL: a wedding must carry
  // ceremony_type + venue_setting, and a non-wedding must carry neither.
  const wedding = type === 'wedding';
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, estimated_pax, ceremony_type, venue_setting)
     VALUES ($1, $2, $3::date, $4, $5, $6) RETURNING event_id`,
    [
      name,
      type,
      date,
      pax,
      wedding ? 'catholic' : null,
      wedding ? 'banquet_hall' : null,
    ],
  );
  return r.rows[0]!.event_id;
}

/** A booking of `svc` for `event`. Returns the event_vendors id. */
async function book(
  event: string,
  svc: string,
  status: string,
  opts: {
    linkMarketplace?: boolean;
    packageRole?: string | null;
    archived?: boolean;
    voided?: boolean;
  } = {},
): Promise<string> {
  const {
    linkMarketplace = true,
    packageRole = null,
    archived = false,
    voided = false,
  } = opts;
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, service_id,
        marketplace_vendor_id, linked_vendor_profile_id, package_role,
        archived_at, voided_by_fraud)
     VALUES ($1, 'photographer', 'Card Record Studio', $2::public.vendor_status, $3,
             $4, $4, $5, CASE WHEN $6 THEN NOW() END, $7)
     RETURNING vendor_id`,
    [
      event,
      status,
      svc,
      linkMarketplace ? vendorProfileId : null,
      packageRole,
      archived,
      voided,
    ],
  );
  return r.rows[0]!.vendor_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // account_type 'customer', not 'vendor': the on_auth_user_created trigger
  // auto-creates a vendor_profiles row for a vendor signup, and vendor_profiles
  // is UNIQUE on user_id — so a vendor signup here would collide with the
  // explicitly-shaped (verified + stamped) profile this fixture needs.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('owner@cardrecord.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  vendorOwnerId = u.rows[0]!.id;

  // Verified + stamped: enforce_booking_requires_verified_vendor (20270927437859)
  // refuses a booked status otherwise, and vendor_profiles_verified_requires_stamp
  // (20271017100000) refuses a verified row with no last_verified_at.
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Card Record Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorOwnerId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const svc = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, 'photography', 50000, 'Free extra hour') RETURNING vendor_service_id`,
    [vendorProfileId],
  );
  serviceId = svc.rows[0]!.vendor_service_id;

  const svc2 = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, 'videography', 60000, 'Free extra hour') RETURNING vendor_service_id`,
    [vendorProfileId],
  );
  otherServiceId = svc2.rows[0]!.vendor_service_id;
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the record reader (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

// ───────────────────────────────────────────────────────────────────────────
// GRANT POSTURE — the reader is public, the helpers are not
// ───────────────────────────────────────────────────────────────────────────

test('the reader is NOT callable by anon — both call sites are server-side', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS ok
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'service_card_records'`,
  );
  assert.ok(r.rows.length > 0, 'the reader must exist');
  for (const row of r.rows) {
    assert.equal(
      row.ok,
      false,
      'anon EXECUTE would be surface with no consumer — and the path to probing draft/paused cards',
    );
  }
});

test('the reader IS callable by authenticated (the vendor reads their own cards)', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ok
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'service_card_records'`,
  );
  assert.ok(r.rows.length > 0);
  for (const row of r.rows) assert.equal(row.ok, true);
});

test('the single-card signature does not survive — exactly ONE public reader', async () => {
  const r = await db.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'service_card_record'`,
  );
  assert.equal(r.rows.length, 0, 'the per-card fan-out reader must be gone');
});

test('neither helper is callable by anon or authenticated', async () => {
  for (const fn of ['booked_event_vendor_statuses', 'vendor_booking_is_arms_length']) {
    const exists = await db.query(
      `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.ok(exists.rows.length > 0, `${fn} must exist`);

    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_function_privilege($1, p.oid, 'EXECUTE') AS ok
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = $2`,
        [role, fn],
      );
      for (const row of r.rows) {
        assert.equal(row.ok, false, `${role} must NOT be able to EXECUTE ${fn}`);
      }
    }
  }
});

test('the reader is SECURITY DEFINER with a pinned search_path', async () => {
  const r = await db.query<{ secdef: boolean; cfg: string[] | null }>(
    `SELECT p.prosecdef AS secdef, p.proconfig AS cfg
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'service_card_records'`,
  );
  assert.equal(r.rows[0]!.secdef, true);
  assert.ok(
    (r.rows[0]!.cfg ?? []).some((c) => c.startsWith('search_path=')),
    'search_path must be pinned',
  );
});

test('the batch is capped — an oversized array returns nothing, and never errors', async () => {
  // 51 ids > the migration's v_max_ids of 50.
  const many = Array.from({ length: 51 }, (_, i) =>
    `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  );
  const r = await db.query(
    `SELECT vendor_service_id FROM public.service_card_records($1::uuid[])`,
    [many],
  );
  assert.equal(r.rows.length, 0, 'over the cap the reader returns no rows');

  // ...and exactly at the cap it still answers.
  const atCap = many.slice(0, 50);
  const ok = await db.query(
    `SELECT vendor_service_id FROM public.service_card_records($1::uuid[])`,
    [atCap],
  );
  assert.equal(ok.rows.length, 50, 'at the cap every id still comes back');
});

test('an empty or all-null array returns nothing rather than erroring', async () => {
  for (const arr of [[], [null]]) {
    const r = await db.query(
      `SELECT vendor_service_id FROM public.service_card_records($1::uuid[])`,
      [arr],
    );
    assert.equal(r.rows.length, 0);
  }
});

test('ONE call answers MANY cards — the batch really is a batch', async () => {
  const m = await readRecords([serviceId, otherServiceId]);
  assert.equal(m.size, 2, 'both cards answered by a single round-trip');
  assert.ok(m.has(serviceId));
  assert.ok(m.has(otherServiceId));
});

// ───────────────────────────────────────────────────────────────────────────
// BEHAVIOUR
// ───────────────────────────────────────────────────────────────────────────

test('an unknown service id returns the zero record instead of raising', async () => {
  const rec = await readRecord('00000000-0000-0000-0000-000000000000');
  assert.equal(rec.booked_count, 0);
  assert.deepEqual(rec.type_mix, []);
  assert.deepEqual(rec.ledger, []);
});

test('a card with no bookings reads zero', async () => {
  const rec = await readRecord(otherServiceId);
  assert.equal(rec.booked_count, 0);
});

test('only the shared BOOKED statuses count; considering / shortlisted do not', async () => {
  const counted = ['contracted', 'deposit_paid', 'delivered', 'complete'];
  const ignored = ['considering', 'shortlisted'];

  for (const s of [...counted, ...ignored]) {
    const ev = await newEvent(`Status ${s}`, 'wedding', '2026-01-15', 120);
    await book(ev, serviceId, s);
  }

  const rec = await readRecord(serviceId);
  assert.equal(
    rec.booked_count,
    counted.length,
    'exactly the four booked statuses may count',
  );

  // And the helper really is the source of that set.
  const h = await db.query<{ arr: string[] }>(
    `SELECT public.booked_event_vendor_statuses() AS arr`,
  );
  assert.deepEqual([...h.rows[0]!.arr].sort(), [...counted].sort());
});

test('ONE BOOKING IS ONE EVENT — a package cascade cannot multiply the count', async () => {
  const ev = await newEvent('Package Cascade', 'wedding', '2026-02-20', 150);
  // The money-carrying anchor plus three cascaded covered rows — all the same
  // card, all the same event. That is ONE booking.
  await book(ev, serviceId, 'contracted', { packageRole: 'anchor' });
  for (let i = 0; i < 3; i++) {
    await book(ev, serviceId, 'contracted', { packageRole: 'covered' });
  }

  const rec = await readRecord(serviceId);
  assert.equal(rec.booked_count, 5, 'four rows on one event must add exactly 1');

  const weddings = rec.type_mix.find((m) => m.event_type === 'wedding');
  assert.equal(weddings?.n, 5, 'the mix counts events too, not rows');
});

test('the record is per CARD — another card on the same shop stays at zero', async () => {
  const rec = await readRecord(otherServiceId);
  assert.equal(rec.booked_count, 0);
});

test('archived and fraud-voided bookings never pad the number', async () => {
  const before = (await readRecord(serviceId)).booked_count;

  const a = await newEvent('Archived Pick', 'wedding', '2026-03-01', 100);
  await book(a, serviceId, 'contracted', { archived: true });

  const v = await newEvent('Fraud Voided', 'wedding', '2026-03-02', 100);
  await book(v, serviceId, 'contracted', { voided: true });

  const arch = await newEvent('Archived Event', 'wedding', '2026-03-03', 100);
  await book(arch, serviceId, 'contracted');
  await db.query(`UPDATE public.events SET archived = TRUE WHERE event_id = $1`, [arch]);

  assert.equal((await readRecord(serviceId)).booked_count, before);
});

test('ANTI-PADDING — a vendor booking their own event does not raise the count', async () => {
  const before = (await readRecord(serviceId)).booked_count;

  const own = await newEvent('Self Booked', 'wedding', '2026-03-10', 100);
  await book(own, serviceId, 'contracted');
  // ...and only NOW does the vendor's owner join that event's couple roster.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [own, vendorOwnerId],
  );

  assert.equal(
    (await readRecord(serviceId)).booked_count,
    before,
    'a self-dealt booking must not pad a public trust signal',
  );

  // The named helper is what decided that.
  const h = await db.query<{ ok: boolean }>(
    `SELECT public.vendor_booking_is_arms_length($1, $2, NULL) AS ok`,
    [vendorProfileId, own],
  );
  assert.equal(h.rows[0]!.ok, false);
});

test('the event-type MIX aggregates over every booked event, not just the ledger', async () => {
  for (const [name, type] of [
    ['Debut A', 'debut'],
    ['Debut B', 'debut'],
    ['Corporate A', 'corporate'],
  ] as const) {
    const ev = await newEvent(name, type, '2025-05-05', 80);
    await book(ev, serviceId, 'complete');
  }

  const rec = await readRecord(serviceId);
  const byType = Object.fromEntries(rec.type_mix.map((m) => [m.event_type, m.n]));
  assert.equal(byType.debut, 2);
  assert.equal(byType.corporate, 1);

  // Sorted by count desc — weddings dominate this fixture.
  assert.equal(rec.type_mix[0]!.event_type, 'wedding');
  assert.ok(
    rec.type_mix[0]!.n >= (rec.type_mix[1]?.n ?? 0),
    'type_mix must arrive sorted count-desc',
  );

  // The mix must account for every booked event.
  const mixTotal = rec.type_mix.reduce((s, m) => s + m.n, 0);
  assert.equal(mixTotal, rec.booked_count);
});

// ───────────────────────────────────────────────────────────────────────────
// THE PRIVACY ENVELOPE
// ───────────────────────────────────────────────────────────────────────────

test('pax is BANDED in SQL at the documented thresholds, never returned raw', async () => {
  // A dedicated card so the banding fixture is not diluted by earlier events.
  const svc = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1, 'catering', 1000, 'Free extra hour') RETURNING vendor_service_id`,
      [vendorProfileId],
    )
  ).rows[0]!.vendor_service_id;

  // (pax, expected band) — the boundaries are what matter.
  const cases: [number | null, string][] = [
    [1, 'under_50'],
    [49, 'under_50'],
    [50, '50_99'],
    [99, '50_99'],
    [100, '100_199'],
    [199, '100_199'],
    [200, '200_plus'],
    [null, 'unknown'],
  ];

  // One per month, descending, so all eight are distinguishable by month.
  const months = [
    '2024-01', '2024-02', '2024-03', '2024-04',
    '2024-05', '2024-06', '2024-07', '2024-08',
  ];
  const expectedByMonth = new Map<string, string>();
  for (let i = 0; i < cases.length; i++) {
    const [pax, band] = cases[i]!;
    const m = months[i]!;
    const ev = await newEvent(`Pax ${pax}`, 'birthday', `${m}-10`, pax);
    await book(ev, svc, 'complete');
    expectedByMonth.set(m, band);
  }

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, cases.length);
  // Only the 6 most recent survive the cap — assert the ones that do.
  for (const row of rec.ledger) {
    assert.equal(
      row.pax_band,
      expectedByMonth.get(row.month_year),
      `band for ${row.month_year}`,
    );
  }

  // The raw head-count must be unreachable: no returned value equals it.
  const payload = JSON.stringify(rec);
  for (const [pax] of cases) {
    if (pax === null) continue;
    assert.ok(
      !new RegExp(`\\b${pax}\\b`).test(JSON.stringify(rec.ledger)),
      `exact pax ${pax} must never appear in the ledger (payload: ${payload})`,
    );
  }
});

test('a ledger row carries EXACTLY three keys — no id, no name, no exact date', async () => {
  const rec = await readRecord(serviceId);
  assert.ok(rec.ledger.length > 0, 'fixture must produce ledger rows');

  for (const row of rec.ledger) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ['event_type', 'month_year', 'pax_band'],
      'the ledger row shape is the privacy envelope',
    );
    // Month-year only: a day component would be an exact date.
    assert.match(row.month_year, /^\d{4}-\d{2}$/);
  }

  // Nothing anywhere in the payload may look like a uuid.
  assert.doesNotMatch(
    JSON.stringify(rec),
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    'no id of any kind may reach the payload',
  );
  // Nor may any display name the fixture used.
  assert.doesNotMatch(JSON.stringify(rec), /Card Record Studio|Self Booked|Package Cascade/);
});

test('the ledger is PAST-ONLY — a future booking counts but never becomes a row', async () => {
  const svc = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1, 'florist', 1000, 'Free extra hour') RETURNING vendor_service_id`,
      [vendorProfileId],
    )
  ).rows[0]!.vendor_service_id;

  const past = await newEvent('Past Event', 'wedding', '2025-06-01', 100);
  await book(past, svc, 'complete');

  // Dated well ahead of any plausible clock this test runs under.
  const future = await newEvent('Future Event', 'wedding', '2099-06-01', 100);
  await book(future, svc, 'contracted');

  // No date at all — real rows have this; it cannot be ordered, so no row.
  const undated = await newEvent('Undated Event', 'wedding', null, 100);
  await book(undated, svc, 'contracted');

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, 3, 'all three are booked work');
  assert.equal(rec.ledger.length, 1, 'only the past, dated event is documented');
  assert.equal(rec.ledger[0]!.month_year, '2025-06');
});

test('the ledger is capped at 6 and ordered newest-first', async () => {
  const svc = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1, 'hair_makeup', 1000, 'Free extra hour') RETURNING vendor_service_id`,
      [vendorProfileId],
    )
  ).rows[0]!.vendor_service_id;

  // Nine past events, deliberately inserted out of order.
  const months = [
    '2025-03', '2025-09', '2025-01', '2025-07', '2025-05',
    '2025-02', '2025-08', '2025-04', '2025-06',
  ];
  for (const m of months) {
    const ev = await newEvent(`Cap ${m}`, 'wedding', `${m}-10`, 100);
    await book(ev, svc, 'complete');
  }

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, 9, 'every event still counts toward the total');
  assert.equal(rec.ledger.length, 6, 'the ledger is capped at 6');
  assert.deepEqual(
    rec.ledger.map((r) => r.month_year),
    ['2025-09', '2025-08', '2025-07', '2025-06', '2025-05', '2025-04'],
    'newest first, and the cap keeps the most recent',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// GATE (a) — THE MINIMUM-N FLOOR
//
// Below 3 arm's-length events, the "aggregates" ARE one private event's record
// — and on /v/[slug] they render on the same page as a reviews section that
// names the couple. So the card emits its COUNT alone. Pre-launch this is the
// common path, not an edge case.
// ───────────────────────────────────────────────────────────────────────────

test('below the min-N floor: the count survives, the mix and ledger are suppressed', async () => {
  for (const n of [1, 2]) {
    const svc = await newCard(n === 1 ? 'coordination' : 'lights_sounds');
    for (let i = 0; i < n; i++) {
      const ev = await newEvent(`Floor ${n}-${i}`, 'wedding', `2025-0${i + 1}-10`, 120);
      await book(ev, svc, 'complete');
    }

    const rec = await readRecord(svc);
    assert.equal(rec.booked_count, n, `count is never suppressed (n=${n})`);
    assert.deepEqual(rec.type_mix, [], `type_mix suppressed below the floor (n=${n})`);
    assert.deepEqual(rec.ledger, [], `ledger suppressed below the floor (n=${n})`);
  }
});

test('AT the min-N floor (3) the aggregates are released', async () => {
  const svc = await newCard('host_emcee');
  for (let i = 0; i < 3; i++) {
    const ev = await newEvent(`AtFloor ${i}`, 'wedding', `2025-0${i + 1}-10`, 120);
    await book(ev, svc, 'complete');
  }

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, 3);
  assert.equal(rec.type_mix.length, 1, 'the mix is released at exactly 3');
  assert.equal(rec.type_mix[0]!.n, 3);
  assert.equal(rec.ledger.length, 3, 'the ledger is released at exactly 3');
});

test('the floor counts ARM’S-LENGTH events — padding cannot buy you past it', async () => {
  const svc = await newCard('florist_2');
  // Two genuine events...
  for (let i = 0; i < 2; i++) {
    const ev = await newEvent(`Genuine ${i}`, 'wedding', `2025-0${i + 1}-10`, 120);
    await book(ev, svc, 'complete');
  }
  // ...plus a self-dealt third, which must NOT unlock the aggregates.
  const own = await newEvent('Padded Third', 'wedding', '2025-04-10', 120);
  await book(own, svc, 'complete');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [own, vendorOwnerId],
  );

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, 2, 'the self-dealt event never counted');
  assert.deepEqual(rec.type_mix, [], 'so the card is still below the floor');
  assert.deepEqual(rec.ledger, []);
});

// ───────────────────────────────────────────────────────────────────────────
// GATE (b) — THE COMPLETED-MONTH LEDGER BOUNDARY
//
// A row appears only once its whole MONTH is history. With a day boundary
// (`event_date <= today`) a row would surface at midnight Manila ON the event
// day, so anyone polling this reader daily would learn the EXACT event_date
// from the day the row first appeared — recovering precisely the granularity
// the 'YYYY-MM' format exists to withhold.
// ───────────────────────────────────────────────────────────────────────────

test('the ledger boundary is the COMPLETED MONTH, not yesterday', async () => {
  const svc = await newCard('cake');

  // All four are booked, so booked_count clears the min-N floor either way.
  // Only the first sits in a month that is already history.
  const lastDayOfPrevMonth = await newEventAtExpr(
    'Prev month last day',
    `${MONTH_START} - INTERVAL '1 day'`,
  );
  const firstOfThisMonth = await newEventAtExpr('This month first day', MONTH_START);
  // "Yesterday", clamped into the current month so the fixture is correct on
  // every calendar day including the 1st.
  const yesterdayThisMonth = await newEventAtExpr(
    'This month yesterday',
    `GREATEST(${MONTH_START}, ${MANILA_TODAY} - INTERVAL '1 day')`,
  );
  const today = await newEventAtExpr('Today', MANILA_TODAY);

  for (const ev of [lastDayOfPrevMonth, firstOfThisMonth, yesterdayThisMonth, today]) {
    await book(ev, svc, 'complete');
  }

  const rec = await readRecord(svc);
  assert.equal(rec.booked_count, 4, 'every one of them is booked work');
  assert.equal(
    rec.ledger.length,
    1,
    'only the event whose MONTH is complete may be documented',
  );

  const expected = await db.query<{ m: string }>(
    `SELECT to_char(${MONTH_START} - INTERVAL '1 day', 'YYYY-MM') AS m`,
  );
  assert.equal(rec.ledger[0]!.month_year, expected.rows[0]!.m);

  // The decisive assertion: nothing from the CURRENT month is ever ledgered,
  // which is what makes the appearance date uninformative.
  const thisMonth = await db.query<{ m: string }>(
    `SELECT to_char(${MONTH_START}, 'YYYY-MM') AS m`,
  );
  assert.ok(
    !rec.ledger.some((r) => r.month_year === thisMonth.rows[0]!.m),
    'a current-month event must never appear, however far into the month we are',
  );
});
