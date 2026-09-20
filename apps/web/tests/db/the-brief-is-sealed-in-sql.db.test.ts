/**
 * THE BRIEF IS SEALED IN SQL (test:db) — migration 20271236283573.
 *
 * PR #5738 put the booking-fee stage rule on the PAGE (`redactBriefForStage` in
 * `lib/event-access-stage.ts`). `public.get_vendor_event_brief` is SECURITY
 * DEFINER, so a supplier could open devtools and call
 * `/rest/v1/rpc/get_vendor_event_brief` with the anon key that ships in the page
 * and read the exact venue, the meal counts, the day-of timeline and the
 * seat-plan size that the page had just hidden from them. Four siblings whose
 * only callers are pages #5738 gated WHOLE had the same hole:
 * `get_vendor_mood_board`, `get_vendor_seat_plan`, `get_vendor_cocktail_editor`,
 * `get_vendor_catering_metrics`.
 *
 * ── WHAT THIS FILE HOLDS ────────────────────────────────────────────────────
 *   1. ONE TABLE OF CASES (`FEE_CASES`) drives BOTH rules. Each case is asked of
 *      `resolveEventAccessStage` (TypeScript, pure) and of
 *      `public.vendor_event_fee_gate_stage` (SQL, against a real charge row),
 *      and the two must return the same word AND the expected one. If they can
 *      disagree they will, so they are never asked separately.
 *   2. THE FIELD SET, per stage, on a brief with every field populated — and
 *      not by re-listing it here: the SQL payload is compared to
 *      `redactBriefForStage` applied to the payload the SAME function returns
 *      with the switch OFF. A field either rule forgets shows up as a diff.
 *   3. THE FOUR SIBLINGS refuse `fee_unsettled` per fee status, and SERVE a
 *      real payload once the fee is settled — the positive control, so the
 *      refusals are attributable to the guard and not to a broken fixture.
 *   4. FAIL OPEN. `booking_fee_charges` is made unreadable and the gate must
 *      answer 'unlocked'. A supplier is never locked out of a wedding they are
 *      shooting tomorrow because one SELECT failed.
 *   5. THE SWITCH. With `platform_settings.fee_unlocks_event_enforced` NULL —
 *      today's production state — every function answers exactly as it did
 *      before this migration existed, including on an unsettled fee, and the
 *      brief carries NO `withheld` key.
 *
 * 🔑 EVERY POSITIVE IS ASSERTED BY VALUE on an event that has every field set.
 * On an empty event a withheld field and an unset field both read as NULL, and
 * the test would pass for the wrong reason.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  redactBriefForStage,
  resolveEventAccessStage,
  withheldFromPayload,
  reconcileStageWithPayload,
  FEE_SETTLED_STATUSES,
  FEE_UNSETTLED_STATUSES,
  STAGE_THREE_ONLY_BRIEF_FIELDS,
  type BookingFeeChargeFacts,
  type EventAccessStage,
} from '../../lib/event-access-stage';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

// ───────────────────────────────────────────────────────────────────────────
// THE ONE TABLE OF CASES. Both rules are driven from it; neither is asked
// anything this table does not say.
// ───────────────────────────────────────────────────────────────────────────
type FeeCase = {
  /** The `booking_fee_charges.status`, or null for "no charge row at all". */
  status: string | null;
  /** `admitRoomBookings`' answer — for the brief, `stage === 'booked'`. */
  booked: boolean;
  expect: EventAccessStage;
  why: string;
  /**
   * FALSE when `booking_fee_charges_status_check` will not let this status
   * exist as a row. The case is still asked of the TypeScript rule — the
   * allowlist has to survive a status the database learns LATER — but it cannot
   * be asked of SQL, and the test below proves the CHECK is the reason rather
   * than taking this flag's word for it. (A row can be true and not lookable.)
   */
  storable?: false;
};

const FEE_CASES: readonly FeeCase[] = [
  { status: null, booked: true, expect: 'unlocked', why: 'no charge is nothing owed' },
  { status: 'paid', booked: true, expect: 'unlocked', why: 'settled' },
  {
    status: 'waived_free5',
    booked: true,
    expect: 'unlocked',
    why: 'every supplier’s first five bookings — reading settled as paid-only locks them all out',
  },
  { status: 'waived_import', booked: true, expect: 'unlocked', why: 'a booking they brought' },
  {
    status: 'a_status_nobody_has_seen',
    booked: true,
    expect: 'unlocked',
    why: 'the lock is an ALLOWLIST — an unknown status unlocks',
    storable: false,
  },
  { status: 'pending', booked: true, expect: 'booked_fee_due', why: 'billed, not paid' },
  { status: 'failed', booked: true, expect: 'booked_fee_due', why: 'did not clear; still owed' },
  { status: 'expired', booked: true, expect: 'booked_fee_due', why: 'window closed unpaid' },
  {
    status: null,
    booked: false,
    expect: 'quoting',
    why: 'not booked at all — nothing owed, and nothing beyond a quote is theirs yet',
  },
  { status: 'paid', booked: false, expect: 'quoting', why: 'settled but still only quoting' },
  { status: 'pending', booked: false, expect: 'booked_fee_due', why: 'owed beats not-booked' },
];

/** The same case as the TypeScript rule sees it. */
function tsCharge(status: string | null): BookingFeeChargeFacts {
  return status === null
    ? { kind: 'none' }
    : { kind: 'charge', status, amountPhp: 500, dueAt: null, orderId: null };
}

// ── fixtures ───────────────────────────────────────────────────────────────

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newVendor(
  email: string,
  services: string[] = ['photography'],
): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Sealed Brief Co', 'Manila', $2::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid, services],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/** An event with EVERY field the brief narrows actually populated. */
async function newEvent(label: string): Promise<string> {
  const coupleUid = await newUser(`couple-${label}@sealed.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision,
        venue_name, venue_address, region, share_budget_band,
        monogram_text, monogram_color)
     VALUES ($1, 'birthday', '2027-09-09'::date, 'day',
             'The Hidden Hall', '7 Quiet Lane, Pasig', 'NCR', TRUE,
             'A&M', '#8A6A4F')
     RETURNING event_id`,
    [`Ana & Miguel ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, location)
     VALUES ($1, 'Ceremony', 'ceremony', '2027-09-09T15:00:00Z', 'The Hidden Hall')`,
    [eventId],
  );
  for (const status of ['attending', 'attending', 'pending']) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
       VALUES ($1, 'Private', 'Person', 'both', 'friends', $2)`,
      [eventId, status],
    );
  }
  // ONE snapshot covering both leaves, so the band reaches a photographer AND a
  // caterer. Two separate INSERTs would take two `snapshot_id` defaults and the
  // brief's `latest` CTE would see only one of them.
  await db.query(
    `WITH snap AS MATERIALIZED (SELECT gen_random_uuid() AS sid)
     INSERT INTO public.budget_allocation_decisions
       (event_id, canonical_service, final_amount_php, snapshot_id)
     SELECT $1, v.leaf, 100000, snap.sid
       FROM snap CROSS JOIN (VALUES ('photography'), ('catering')) AS v(leaf)`,
    [eventId],
  );
  return eventId;
}

/** A seat plan with real size, so `seat_plan` has something to withhold. */
async function publishFloorPlan(eventId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_floor_plan (event_id, published_at)
     VALUES ($1, NOW())
     ON CONFLICT (event_id) DO UPDATE SET published_at = EXCLUDED.published_at`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order)
     VALUES ($1, 'Table 1', 'round_8', 8, 1)`,
    [eventId],
  );
}

async function bookVendor(
  eventId: string,
  vpid: string,
  category = 'photographer',
  status = 'contracted',
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, $2::public.vendor_category, 'Sealed Brief Co', $3::public.vendor_status, $4)
     RETURNING vendor_id`,
    [eventId, category, status, vpid],
  );
  return r.rows[0]!.vendor_id;
}

/**
 * A charge in an EXACT status. Inserted directly rather than minted through
 * `booking_fee_open_lock_charge`, because the cases below need statuses that
 * function will never produce on demand (`failed`, `expired`, and a status
 * nobody has seen) and the gate reads nothing but the status.
 */
async function setCharge(
  eventId: string,
  vpid: string,
  eventVendorId: string,
  status: string | null,
): Promise<void> {
  await db.query(`DELETE FROM public.booking_fee_charges WHERE event_id = $1`, [eventId]);
  if (status === null) return;
  await db.query(
    `INSERT INTO public.booking_fee_ledger (vendor_profile_id, event_id)
     VALUES ($1, $2) ON CONFLICT (vendor_profile_id, event_id) DO NOTHING`,
    [vpid, eventId],
  );
  await db.query(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_vendor_id, vendor_profile_id, event_id,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
        schedule_version, status, source)
     SELECT l.ledger_id, $3, $1, $2, 1000000, 50000, 50000, 'test', $4, 'lock'
       FROM public.booking_fee_ledger l
      WHERE l.vendor_profile_id = $1 AND l.event_id = $2`,
    [vpid, eventId, eventVendorId, status],
  );
}

async function setSwitch(on: boolean | null): Promise<void> {
  await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = $1 WHERE id = 1`, [
    on,
  ]);
}

async function asVendor(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

async function gateStage(eventId: string, booked: boolean): Promise<string> {
  const r = await db.query<{ s: string }>(
    `SELECT public.vendor_event_fee_gate_stage($1, $2) AS s`,
    [eventId, booked],
  );
  return r.rows[0]!.s;
}

async function brief(eventId: string): Promise<Row> {
  const r = await db.query<{ b: Row }>(`SELECT public.get_vendor_event_brief($1) AS b`, [eventId]);
  return r.rows[0]!.b;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await setSwitch(null);
});

// ───────────────────────────────────────────────────────────────────────────
// 0 · ANTI-VACUITY — the column exists, the helper exists, and the fixture can
//     actually produce every status the table names.
// ───────────────────────────────────────────────────────────────────────────

test('the switch and the gate helper exist, and both rules know the same vocabulary', async () => {
  const col = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'platform_settings'
        AND column_name = 'fee_unlocks_event_enforced'`,
  );
  assert.equal(col.rows[0]!.n, 1, 'the switch column is absent — every case below is vacuous');

  const fn = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_event_fee_gate_stage'`,
  );
  assert.equal(fn.rows[0]!.n, 1, 'the gate helper is absent');

  // The SQL allowlist is spelled out in `vendor_event_fee_gate_stage`; the TS
  // one is exported. They are the same three words, and the settled set holds
  // the one that matters most.
  assert.deepEqual([...FEE_UNSETTLED_STATUSES].sort(), ['expired', 'failed', 'pending']);
  assert.ok(FEE_SETTLED_STATUSES.has('waived_free5'), 'free-5 must settle');
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE GATE — one table of cases, asked of both rules.
// ───────────────────────────────────────────────────────────────────────────

test('the SQL gate and the TypeScript rule return the SAME stage for every case', async () => {
  const eventId = await newEvent('gate');
  const { vpid, uid } = await newVendor('gate@sealed.test');
  const evId = await bookVendor(eventId, vpid);
  await setSwitch(true);
  await asVendor(uid);

  for (const c of FEE_CASES) {
    const label = `${c.status ?? 'no charge'} / booked=${c.booked} (${c.why})`;
    const ts = resolveEventAccessStage({
      booked: c.booked,
      charge: tsCharge(c.status),
      enforced: true,
    }).stage;
    assert.equal(ts, c.expect, `TypeScript rule disagrees with the table: ${label}`);

    if (c.storable === false) {
      // PROVE the reason this case is not asked of SQL, rather than asserting
      // it in a comment: the status CHECK refuses the row.
      await assert.rejects(
        () => setCharge(eventId, vpid, evId, c.status),
        /booking_fee_charges_status_check/,
        `${label} is marked unstorable but the database accepts it — ask SQL too`,
      );
      continue;
    }

    await setCharge(eventId, vpid, evId, c.status);
    const sql = await gateStage(eventId, c.booked);
    assert.equal(sql, c.expect, `SQL gate disagrees with the table: ${label}`);
    assert.equal(sql, ts, `SQL and TypeScript disagree: ${label}`);
  }
  // MUTATION (proven, see PR): drop 'waived_free5' from the settled side of the
  // SQL `NOT IN ('pending','failed','expired')` test — i.e. make it lock — and
  // this test goes red on the free-5 case alone.
});

test('with the switch OFF the SQL gate answers "unlocked" for EVERY case, including an unpaid fee', async () => {
  const eventId = await newEvent('switch-off');
  const { vpid, uid } = await newVendor('switch-off@sealed.test');
  const evId = await bookVendor(eventId, vpid);
  await asVendor(uid);

  for (const c of FEE_CASES) {
    if (c.storable === false) continue; // proven unstorable in the case above
    await setCharge(eventId, vpid, evId, c.status);
    for (const value of [null, false] as const) {
      await setSwitch(value);
      assert.equal(
        await gateStage(eventId, c.booked),
        'unlocked',
        `switch=${value} must narrow nothing (${c.status ?? 'no charge'})`,
      );
    }
    // And the TS rule says the same thing when it is not enforced.
    assert.equal(
      resolveEventAccessStage({ booked: c.booked, charge: tsCharge(c.status), enforced: false })
        .stage,
      'unlocked',
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE FIELD SET — the brief, per stage, compared field for field against
//     the TypeScript redaction of the SAME payload.
// ───────────────────────────────────────────────────────────────────────────

test('the brief narrows EXACTLY the fields redactBriefForStage narrows, and names them', async () => {
  const eventId = await newEvent('fields');
  const { vpid, uid } = await newVendor('fields@sealed.test', ['catering']);
  // 'catering' so `dietary` is populated — otherwise the meal-count case is
  // asserted against a NULL that was always NULL.
  const evId = await bookVendor(eventId, vpid, 'catering');
  await publishFloorPlan(eventId);
  await asVendor(uid);

  // The payload as it is today (switch off) — the input to BOTH rules.
  await setSwitch(null);
  const full = await brief(eventId);
  assert.ok(!('withheld' in full), 'an unenforced payload must be byte-identical to before');
  assert.equal((full.event as Row).venue_name, 'The Hidden Hall');
  assert.equal((full.event as Row).venue_address, '7 Quiet Lane, Pasig');
  assert.ok(full.dietary, 'the caterer sees meal counts — else the dietary case is vacuous');
  assert.ok(full.budget_band, 'the band must be present BEFORE narrowing, or "it stays" is vacuous');
  assert.equal((full.timeline as unknown[]).length, 1);
  assert.equal((full.seat_plan as Row).table_count, 1);
  assert.equal((full.monogram as Row).text, 'A&M');

  await setSwitch(true);
  await setCharge(eventId, vpid, evId, 'pending');
  const narrowed = await brief(eventId);

  // What the PAGE would have produced from the un-narrowed payload.
  const expected = redactBriefForStage(structuredClone(full), 'booked_fee_due');

  assert.deepEqual(
    narrowed.withheld,
    expected.withheld,
    'the database and the page disagree about WHICH fields were taken',
  );
  assert.deepEqual(
    narrowed.withheld,
    ['venue', 'dietary', 'timeline', 'seat_plan', 'monogram'],
    'all five stage-3 fields were populated, so all five must be named',
  );

  const withoutKey = { ...narrowed };
  delete withoutKey.withheld;
  assert.deepEqual(
    withoutKey,
    expected.brief,
    'the SQL payload is not field-for-field what redactBriefForStage produces',
  );

  // And by VALUE, so a structural diff cannot be the only thing holding this.
  assert.equal((narrowed.event as Row).venue_name, null);
  assert.equal((narrowed.event as Row).venue_address, null);
  assert.equal((narrowed.event as Row).region, 'NCR', 'the AREA is a stage-1 pricing input');
  assert.equal((narrowed.event as Row).event_date, '2027-09-09', 'the date stays');
  assert.equal(narrowed.dietary, null);
  assert.deepEqual(narrowed.timeline, []);
  assert.equal((narrowed.seat_plan as Row).table_count, 0);
  assert.equal((narrowed.monogram as Row).text, null);
  assert.ok(narrowed.budget_band, 'the budget band is a quoting input and STAYS (owner-open #1)');
  assert.ok((narrowed.pax as Row).invited, 'guest counts are a quoting input and stay');
  assert.doesNotMatch(
    JSON.stringify(narrowed),
    /Hidden Hall|Quiet Lane/,
    'the venue survives somewhere else in the payload',
  );
  // MUTATION (proven, see PR): delete the `jsonb_set(v_payload, '{dietary}', …)`
  // line from the migration and this test goes red on the deepEqual against
  // `expected.brief` AND on `narrowed.dietary`.
});

test('every field the page may withhold is a field the database withholds', async () => {
  // Not a re-listing: the register is `STAGE_THREE_ONLY_BRIEF_FIELDS`, and the
  // previous test proved the database names all five when all five are set. If
  // a SIXTH field is added to the register, this fails until SQL learns it.
  assert.deepEqual([...STAGE_THREE_ONLY_BRIEF_FIELDS], [
    'venue',
    'dietary',
    'timeline',
    'seat_plan',
    'monogram',
  ]);
});

test('the payload announces its own narrowing, and that announcement reaches the screen', () => {
  const sqlNarrowed = {
    event: { venue_name: null, venue_address: null, region: 'NCR' },
    dietary: null,
    timeline: [],
    seat_plan: { published: false, published_at: null, table_count: 0, assigned_guests: 0 },
    monogram: { text: null },
    withheld: ['venue', 'timeline'],
  };
  // The page recomputing from a payload whose fields are ALREADY null finds
  // nothing missing — which is why the list has to be read back.
  assert.deepEqual(withheldFromPayload(sqlNarrowed), ['venue', 'timeline']);
  assert.deepEqual(redactBriefForStage(sqlNarrowed, 'booked_fee_due').withheld, [
    'venue',
    'timeline',
  ]);
  // 🚨 And a payload that says it was narrowed is never rendered as unlocked.
  assert.equal(reconcileStageWithPayload('unlocked', sqlNarrowed), 'booked_fee_due');
  assert.equal(reconcileStageWithPayload('unlocked', { withheld: [] }), 'unlocked');
  assert.equal(reconcileStageWithPayload('unlocked', {}), 'unlocked');
  // Garbage in the key is not a lock.
  assert.deepEqual(withheldFromPayload({ withheld: ['not_a_field'] }), []);
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · THE FOUR WHOLE SURFACES — refused per fee status, served once settled.
// ───────────────────────────────────────────────────────────────────────────

type Surface = {
  fn: string;
  /** Everything that surface needs before it will answer at all. */
  setup: (eventId: string, vpid: string) => Promise<void>;
  category: string;
  /** A key the served payload must carry, so "it worked" is asserted by value. */
  serves: (payload: Row) => void;
};

const SURFACES: readonly Surface[] = [
  {
    fn: 'get_vendor_mood_board',
    category: 'photographer',
    setup: async () => {},
    serves: (p) => assert.ok('role_palette' in p, 'the mood board served no palette'),
  },
  {
    fn: 'get_vendor_seat_plan',
    category: 'photographer',
    setup: async (eventId) => {
      await publishFloorPlan(eventId);
    },
    serves: (p) => assert.ok(Array.isArray(p.tables), 'the seat plan served no tables'),
  },
  {
    fn: 'get_vendor_cocktail_editor',
    category: 'mobile_bar',
    setup: async (eventId) => {
      await db.query(
        `INSERT INTO public.event_floor_plan (event_id, cocktail_enabled, cocktail_vendor_edit)
         VALUES ($1, TRUE, TRUE)
         ON CONFLICT (event_id) DO UPDATE
           SET cocktail_enabled = TRUE, cocktail_vendor_edit = TRUE`,
        [eventId],
      );
    },
    serves: (p) => assert.ok(Array.isArray(p.booths), 'the cocktail editor served no booths'),
  },
  {
    fn: 'get_vendor_catering_metrics',
    category: 'catering',
    setup: async () => {},
    serves: (p) => assert.ok('meal_counts' in p, 'catering metrics served no meal counts'),
  },
];

for (const s of SURFACES) {
  test(`${s.fn} refuses an unsettled fee and SERVES a settled one`, async () => {
    const eventId = await newEvent(s.fn);
    const { vpid, uid } = await newVendor(`${s.fn}@sealed.test`, ['photography']);
    const evId = await bookVendor(eventId, vpid, s.category);
    await s.setup(eventId, vpid);
    await asVendor(uid);

    const call = async (): Promise<Row> => {
      const r = await db.query<{ p: Row }>(`SELECT public.${s.fn}($1) AS p`, [eventId]);
      return r.rows[0]!.p;
    };

    // POSITIVE CONTROL FIRST. If the fixture cannot make this surface answer,
    // every refusal below would pass for the wrong reason.
    await setSwitch(true);
    await setCharge(eventId, vpid, evId, 'paid');
    s.serves(await call());

    for (const c of FEE_CASES.filter((x) => x.booked && x.expect === 'booked_fee_due')) {
      await setCharge(eventId, vpid, evId, c.status);
      await assert.rejects(
        call,
        /fee_unsettled/,
        `${s.fn} served a supplier whose fee is ${c.status}`,
      );
      // ...and the SAME status narrows nothing while the switch is off.
      await setSwitch(null);
      s.serves(await call());
      await setSwitch(true);
    }

    for (const c of FEE_CASES.filter(
      (x) => x.booked && x.expect === 'unlocked' && x.storable !== false,
    )) {
      await setCharge(eventId, vpid, evId, c.status);
      s.serves(await call());
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// 4 · FAIL OPEN.
// ───────────────────────────────────────────────────────────────────────────

test('🚨 an UNREADABLE fee unlocks — a refused SELECT is not a fee that is owed', async () => {
  const eventId = await newEvent('fail-open');
  const { vpid, uid } = await newVendor('fail-open@sealed.test');
  const evId = await bookVendor(eventId, vpid);
  await setSwitch(true);
  await setCharge(eventId, vpid, evId, 'pending');
  await asVendor(uid);

  // Proven locked first, so the unlock below is attributable to the failure and
  // not to a fixture that never locked.
  assert.equal(await gateStage(eventId, true), 'booked_fee_due');

  await db.exec(`ALTER TABLE public.booking_fee_charges RENAME TO booking_fee_charges__gone`);
  try {
    assert.equal(
      await gateStage(eventId, true),
      'unlocked',
      'an unreadable charge table locked a supplier out',
    );
    assert.equal(await gateStage(eventId, false), 'quoting', 'a not-booked shop keeps quoting');
    // The brief still answers, in full, rather than refusing or blanking.
    const b = await brief(eventId);
    assert.equal((b.event as Row).venue_name, 'The Hidden Hall');
    assert.ok(!('withheld' in b), 'a failed read must not read as a redaction');
  } finally {
    await db.exec(`ALTER TABLE public.booking_fee_charges__gone RENAME TO booking_fee_charges`);
  }
  // And the TS rule takes the same direction on the same fact.
  assert.equal(
    resolveEventAccessStage({ booked: true, charge: { kind: 'unreadable' }, enforced: true }).stage,
    'unlocked',
  );
  // MUTATION (proven, see PR): remove the `EXCEPTION WHEN OTHERS THEN RETURN
  // v_open` arm around the charge SELECT and this test fails with
  // `relation "booking_fee_charges" does not exist` instead of unlocking.
});

test('a caller with no resolvable shop is never locked — the page redirects them first', async () => {
  const eventId = await newEvent('no-shop');
  const { vpid } = await newVendor('no-shop-owner@sealed.test');
  const evId = await bookVendor(eventId, vpid);
  await setSwitch(true);
  await setCharge(eventId, vpid, evId, 'pending');

  // A signed-in user who owns no shop and is on no team.
  const strangerUid = await newUser('no-shop@sealed.test');
  await asVendor(strangerUid);
  assert.equal(
    await gateStage(eventId, true),
    'unlocked',
    'the database was stricter than the page — that renders as an empty wedding',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · #5730's ACCESS RULE IS UNTOUCHED — this PR is about WHICH FIELDS.
// ───────────────────────────────────────────────────────────────────────────

test('the door is unchanged: a stranger is still refused, and a settled supplier still gets in', async () => {
  const eventId = await newEvent('door');
  const { vpid, uid } = await newVendor('door@sealed.test');
  const evId = await bookVendor(eventId, vpid);
  const { uid: strangerUid } = await newVendor('door-stranger@sealed.test');
  await setSwitch(true);

  await asVendor(strangerUid);
  await assert.rejects(() => brief(eventId), /not_booked/, 'the access rule moved');

  await asVendor(uid);
  await setCharge(eventId, vpid, evId, 'pending');
  const b = await brief(eventId);
  assert.equal(b.stage, 'booked', 'a locked supplier is still BOOKED — the fee is not the door');
  assert.equal((b.event as Row).display_name, 'Ana & Miguel door', 'they still see whose wedding');
});
