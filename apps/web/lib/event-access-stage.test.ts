import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALWAYS_OPEN_SURFACES,
  FEE_SETTLED_STATUSES,
  FEE_UNSETTLED_STATUSES,
  SHOW_BUDGET_BAND_WHILE_QUOTING,
  VENUE_WHILE_QUOTING,
  eventAccessUnlocked,
  feeEnforcementFromSources,
  feeEnforcementSentence,
  feeLockCopy,
  reconcileStageWithPayload,
  redactBriefForStage,
  resolveEventAccessStage,
  withheldFromPayload,
  type BookingFeeChargeFacts,
} from '@/lib/event-access-stage';

/**
 * THE RULE IS EXECUTED, NEVER DESCRIBED.
 *
 * Owner, 2026-09-20: "when they pay the booking fee, that is when we unlock the
 * rest of the controls for that event" — and "initially, they get information
 * they only need to create a quotation for free."
 *
 * Every state the fee can be in is run through the shipped function here:
 * paid · waived_free5 · waived_import · pending · failed · expired · no charge
 * at all · unreadable — each on BOTH sides of the flag. A table in a docblock
 * would have let `waived_free5` be forgotten, and `waived_free5` is every
 * supplier's first five bookings.
 */

const charge = (status: string): BookingFeeChargeFacts => ({
  kind: 'charge',
  status,
  amountPhp: 837.5,
  dueAt: '2026-10-05',
  orderId: 'order-1',
});

// ── The flag ───────────────────────────────────────────────────────────────

test('FLAG OFF: every state unlocks, including a pending bill', () => {
  const states: BookingFeeChargeFacts[] = [
    { kind: 'none' },
    { kind: 'unreadable' },
    charge('pending'),
    charge('failed'),
    charge('expired'),
    charge('paid'),
    charge('waived_free5'),
  ];
  for (const c of states) {
    const d = eventAccessUnlocked({ charge: c, enforced: false });
    assert.equal(d.unlocked, true, `${JSON.stringify(c)} must unlock while the flag is off`);
    assert.equal(d.reason, 'flag_off');
    assert.equal(d.owed, null);
  }
  // …and the stage is 'unlocked' whether or not the shop is booked, which is
  // what makes redactBriefForStage a no-op and today's behaviour identical.
  for (const booked of [true, false]) {
    assert.equal(
      resolveEventAccessStage({ booked, charge: charge('pending'), enforced: false }).stage,
      'unlocked',
      `booked=${booked} must be 'unlocked' while the flag is off`,
    );
  }
});

// ── Settled: PAID **OR** WAIVED ────────────────────────────────────────────

test('🚨 SETTLED IS PAID OR WAIVED — waived_free5 unlocks exactly like paid', () => {
  for (const status of ['paid', 'waived_free5', 'waived_import']) {
    const d = eventAccessUnlocked({ charge: charge(status), enforced: true });
    assert.equal(
      d.unlocked,
      true,
      `${status} means nothing is owed — locking it would shut every supplier out of their ` +
        `first five bookings (the free-5 waiver), which is the opposite of the ruling.`,
    );
    assert.equal(d.reason, 'settled');
    assert.equal(d.owed, null);
    assert.ok(FEE_SETTLED_STATUSES.has(status), `${status} must be in FEE_SETTLED_STATUSES`);
  }
});

test('the two status sets are disjoint — no status can both lock and settle', () => {
  for (const s of FEE_SETTLED_STATUSES) {
    assert.equal(FEE_UNSETTLED_STATUSES.has(s), false, `${s} is in both sets`);
  }
});

// ── Unsettled: the only three that lock ────────────────────────────────────

test('pending · failed · expired LOCK, and carry the amount, the date and the bill', () => {
  for (const status of ['pending', 'failed', 'expired']) {
    const d = eventAccessUnlocked({ charge: charge(status), enforced: true });
    assert.equal(d.unlocked, false, `${status} means money is owed`);
    assert.equal(d.reason, 'fee_due');
    // A locked screen that cannot say the amount is a blank wall with a lock on it.
    assert.deepEqual(d.owed, { amountPhp: 837.5, dueAt: '2026-10-05', orderId: 'order-1' });
    assert.ok(FEE_UNSETTLED_STATUSES.has(status));
  }
});

test('a booked shop with an unsettled fee is stage booked_fee_due; an unbooked one is quoting', () => {
  assert.equal(
    resolveEventAccessStage({ booked: true, charge: charge('pending'), enforced: true }).stage,
    'booked_fee_due',
  );
  assert.equal(
    resolveEventAccessStage({ booked: false, charge: { kind: 'none' }, enforced: true }).stage,
    'quoting',
  );
  assert.equal(
    resolveEventAccessStage({ booked: true, charge: charge('paid'), enforced: true }).stage,
    'unlocked',
  );
});

// ── FAIL OPEN ──────────────────────────────────────────────────────────────

test('🚨 AN UNREADABLE FEE FAILS OPEN — a refused SELECT never locks a supplier out', () => {
  const d = eventAccessUnlocked({ charge: { kind: 'unreadable' }, enforced: true });
  assert.equal(
    d.unlocked,
    true,
    'a read that failed is not a fee that is owed. Locking here would shut a supplier out ' +
      'of a wedding they are shooting tomorrow because one query was refused.',
  );
  assert.equal(d.reason, 'fee_unreadable', 'and it must be DISTINGUISHABLE from "no charge"');
  assert.equal(
    resolveEventAccessStage({ booked: true, charge: { kind: 'unreadable' }, enforced: true })
      .stage,
    'unlocked',
  );
});

test('no charge at all unlocks — a booking that was never billed owes nothing', () => {
  const d = eventAccessUnlocked({ charge: { kind: 'none' }, enforced: true });
  assert.equal(d.unlocked, true);
  assert.equal(d.reason, 'no_charge');
});

test('an UNKNOWN status unlocks — the lock is an allowlist, not a denylist', () => {
  for (const status of ['', 'refunded', 'void', 'some_future_state']) {
    assert.equal(
      eventAccessUnlocked({ charge: charge(status), enforced: true }).unlocked,
      true,
      `"${status}" is not provably owed, so it must not lock`,
    );
  }
});

// ── The field policy ───────────────────────────────────────────────────────

const FULL_BRIEF = {
  stage: 'booked',
  event: {
    display_name: 'Rosa & Ben',
    event_date: '2026-12-12',
    venue_name: 'Casa Real',
    venue_address: '12 Real St, Bacolod',
    region: 'Negros Occidental',
    ceremony_type: 'catholic',
  },
  booked_categories: ['photographer'],
  pax: { invited: 180, attending: 150, maybe: 4, pending: 20, declined: 6 },
  dietary: { meal_counts: { beef: 90 }, restriction_notes: 3 },
  budget_band: { lo_centavos: 4000000, hi_centavos: 6000000 },
  palette: { ceremony: ['#fff'] },
  monogram: { text: 'R&B', color: '#000', font_key: 'x', frame_key: null, custom_svg: null },
  timeline: [{ label: 'Processional', block_type: 'ceremony', start_at: null, end_at: null, location: 'Aisle' }],
  seat_plan: { published: true, published_at: '2026-11-01', table_count: 18, assigned_guests: 150 },
};

test('stage 3 is untouched — an unlocked supplier keeps the whole brief', () => {
  const { brief, withheld } = redactBriefForStage(FULL_BRIEF, 'unlocked');
  assert.deepEqual(brief, FULL_BRIEF);
  assert.deepEqual(withheld, []);
});

test('quoting keeps every PRICING input the owner named', () => {
  const { brief } = redactBriefForStage(FULL_BRIEF, 'quoting');
  // "event type, date + their own availability, the AREA, guest count, the
  // service requested, the couple's notes/preferences, and the budget band."
  assert.equal(brief.event!.ceremony_type, 'catholic', 'event type');
  assert.equal(brief.event!.event_date, '2026-12-12', 'date');
  assert.equal(brief.event!.region, 'Negros Occidental', 'the AREA');
  assert.deepEqual(brief.pax, FULL_BRIEF.pax, 'guest count');
  assert.deepEqual(brief.booked_categories, ['photographer'], 'the service requested');
  assert.deepEqual(brief.palette, FULL_BRIEF.palette, "the couple's preferences");
  assert.equal(brief.event!.display_name, 'Rosa & Ben', 'who they are talking to');
});

test('quoting withholds the OPERATING detail, and SAYS which — never a silent empty', () => {
  for (const stage of ['quoting', 'booked_fee_due'] as const) {
    const { brief, withheld } = redactBriefForStage(FULL_BRIEF, stage);
    assert.equal(brief.event!.venue_name, null, `${stage}: exact venue`);
    assert.equal(brief.event!.venue_address, null, `${stage}: address`);
    assert.equal(brief.dietary, null, `${stage}: meal counts`);
    assert.deepEqual(brief.timeline, [], `${stage}: timeline`);
    assert.equal((brief.seat_plan as { table_count: number }).table_count, 0, `${stage}: seats`);
    assert.equal((brief.monogram as { text: string | null }).text, null, `${stage}: monogram`);

    // 🔑 THE WITHHOLDING MUST REACH THE RENDER. Every redaction above is
    // shape-preserving, so without this list a withheld timeline is
    // byte-identical to a wedding nobody has planned yet.
    assert.deepEqual(
      [...withheld].sort(),
      ['dietary', 'monogram', 'seat_plan', 'timeline', 'venue'],
      `${stage}: every field taken must be named back`,
    );
  }
});

test('the two owner-open questions are NAMED CONSTANTS, and the policy honours them', () => {
  // ⚖ #1 — the budget band while quoting. Recommendation: show it.
  assert.equal(SHOW_BUDGET_BAND_WHILE_QUOTING, true);
  const { brief } = redactBriefForStage(FULL_BRIEF, 'quoting');
  assert.deepEqual(
    brief.budget_band,
    FULL_BRIEF.budget_band,
    'SHOW_BUDGET_BAND_WHILE_QUOTING is true, so the band must survive — a supplier who ' +
      'cannot see it quotes blind.',
  );
  // ⚖ #2 — the venue while quoting. Recommendation: area only.
  assert.equal(VENUE_WHILE_QUOTING, 'area_only');
  assert.equal(brief.event!.venue_name, null);
  assert.equal(brief.event!.region, 'Negros Occidental', 'the AREA is never the thing withheld');
});

test('redaction does not mutate the payload it was handed', () => {
  const before = JSON.stringify(FULL_BRIEF);
  redactBriefForStage(FULL_BRIEF, 'quoting');
  assert.equal(JSON.stringify(FULL_BRIEF), before);
});

test('a brief that is ALREADY empty reports nothing withheld', () => {
  // Otherwise the locked panel would claim to be hiding a timeline that does
  // not exist — a second way of saying something untrue.
  const bare = {
    event: { display_name: 'X', event_date: null, venue_name: null, venue_address: null },
    dietary: null,
    timeline: [],
    seat_plan: { published: false, published_at: null, table_count: 0, assigned_guests: 0 },
    monogram: { text: null, color: null, font_key: null, frame_key: null, custom_svg: null },
  };
  assert.deepEqual(redactBriefForStage(bare, 'quoting').withheld, []);
});

// ── What a locked screen says ──────────────────────────────────────────────

/**
 * ── THE COPY MUST SAY WHAT IS TRUE, IN BOTH FLAG STATES ────────────────────
 *
 * PR #5737 ships due/overdue copy that reads "Your booking is not affected",
 * guarded by a BAN on the words cancel · suspend · lose access · hidden from.
 * Both were measured and correct: nothing read `expires_at`, `cron.job` is
 * empty, access was `lock_request_state = 'agreed'` alone.
 *
 * This PR makes that premise conditional, so:
 *   · a word BAN now fails in both directions — it misses a reword ("your event
 *     closes up") and it convicts the honest sentence once the flag is on;
 *   · and a hand-written pair of sentences would need somebody to switch both
 *     on the day the flag is flipped, which is the day nobody reads the file.
 *
 * So the sentence is DERIVED from the flag, and the assertion is a PROPERTY:
 * it states the consequence that is true for the current state, and never
 * asserts its opposite.
 */
test('🔑 the consequence sentence is TRUE in both flag states, from one source', () => {
  const off = feeEnforcementSentence({ enforced: false });
  const on = feeEnforcementSentence({ enforced: true });

  assert.notEqual(off, on, 'one sentence for two different behaviours is one of them wrong');

  // FLAG OFF — measured: no scheduler, nothing reads expires_at, access is
  // lock_request_state alone. Nothing happens when the date passes.
  assert.match(off, /not affected/, 'flag off: the booking really is untouched, so say so');
  assert.doesNotMatch(
    off,
    /locked|lock(s|ed)? until|stay locked/i,
    'flag off: nothing is withheld, so the copy must not threaten that it is — that is the ' +
      'invented consequence #5737 exists to prevent.',
  );

  // FLAG ON — the gate IS the consequence. The copy must name it, and must NOT
  // carry the flag-off reassurance, which becomes misleading.
  assert.match(on, /locked until the fee is settled/, 'flag on: name the real consequence');
  assert.doesNotMatch(
    on,
    /booking is not affected/,
    'flag on: "your booking is not affected" is technically true (nothing is cancelled) and ' +
      'misleading (the event\u2019s tools ARE locked). Two half-truths make a lie on money.',
  );
  // …and it must keep the two promises the ruling makes, in both directions.
  assert.match(on, /booking stands/, 'flag on: the booking itself is NOT cancelled — say it');
  assert.match(
    on,
    /conversation with the couple/,
    'flag on: the always-open three must be promised on the screen that locks things',
  );
  assert.match(on, /money page/);
  assert.match(on, /couple sees nothing/, 'the couple is never told about their supplier\u2019s bill');
});

test('the locked screen and the overdue line share ONE consequence sentence', () => {
  // A dead export is not a source of truth. The screen that actually locks must
  // consume it, or the two will drift the first time one is edited.
  const copy = feeLockCopy({
    stage: 'booked_fee_due',
    owed: { amountPhp: 837.5, dueAt: '2026-09-27', orderId: 'o1' },
    withheld: ['venue'],
  });
  assert.ok(
    copy.detail.includes(feeEnforcementSentence({ enforced: true })),
    'feeLockCopy hand-writes its own version of the consequence instead of using the one source',
  );
});

test('a locked screen names the amount, the due date and the way out', () => {
  const copy = feeLockCopy({
    stage: 'booked_fee_due',
    owed: { amountPhp: 837.5, dueAt: '2026-10-05', orderId: 'o1' },
    withheld: ['venue', 'timeline'],
  });
  assert.match(copy.headline, /₱837\.50/, 'the amount is in the headline');
  assert.match(copy.headline, /unlock this event/i);
  assert.match(copy.detail, /2026/, 'the due date is stated');
  assert.equal(copy.cta, 'Pay the booking fee');
  // The always-open promise is made on the screen itself, not only in a docblock.
  assert.match(copy.detail, /conversation with the couple/i);
  assert.match(copy.detail, /money page/i);
});

test('a QUOTING screen explains itself without demanding money that is not owed', () => {
  const copy = feeLockCopy({ stage: 'quoting', owed: null, withheld: ['venue'] });
  assert.equal(copy.cta, null, 'nothing is owed yet, so there is no bill to pay');
  assert.match(copy.detail, /price this job/i);
  assert.doesNotMatch(copy.headline, /₱/);
});

test('the three always-open surfaces are recorded as strings, not as a promise', () => {
  assert.deepEqual(Object.keys(ALWAYS_OPEN_SURFACES).sort(), [
    'bookingMoney',
    'conversation',
    'feePayment',
  ]);
  assert.equal(ALWAYS_OPEN_SURFACES.conversation, '/vendor-dashboard/messages');
  assert.equal(ALWAYS_OPEN_SURFACES.feePayment, '/vendor-dashboard/booking-fees');
  assert.equal(ALWAYS_OPEN_SURFACES.bookingMoney, 'tab=quote');
});

// ───────────────────────────────────────────────────────────────────────────
// TWO SWITCHES, ONE DIRECTION — migration 20271236283573.
// ───────────────────────────────────────────────────────────────────────────

/**
 * THE INVARIANT, EXECUTED OVER EVERY PAIR OF INPUTS.
 *
 * SQL cannot read `NEXT_PUBLIC_FEE_UNLOCKS_EVENT`, so the SQL half of the gate
 * is switched by `platform_settings.fee_unlocks_event_enforced` alone. The app
 * reads BOTH. The one state that must not exist is the database withholding a
 * field the page believes it is drawing — so:
 *
 *     platformSwitch === true  ⇒  the app is enforcing.
 *
 * This is a truth table, not a sentence, because the sentence is what rots.
 */
test('🔑 DATABASE ENFORCING IMPLIES APP ENFORCING — every pair of switch states', () => {
  const table: Array<{ envFlag: boolean; platformSwitch: boolean | null; app: boolean }> = [
    { envFlag: false, platformSwitch: null, app: false },  // today's production
    { envFlag: false, platformSwitch: false, app: false },
    { envFlag: false, platformSwitch: true, app: true },   // the owner flips it: BOTH narrow
    { envFlag: true, platformSwitch: null, app: true },    // #5738's state: screen only
    { envFlag: true, platformSwitch: false, app: true },
    { envFlag: true, platformSwitch: true, app: true },
  ];
  for (const row of table) {
    const app = feeEnforcementFromSources({
      envFlag: row.envFlag,
      platformSwitch: row.platformSwitch,
    });
    assert.equal(
      app,
      row.app,
      `env=${row.envFlag} switch=${row.platformSwitch} resolved to ${app}`,
    );
    // The database enforces on the COLUMN alone. It may never enforce while the
    // app does not — that is the forbidden state.
    const db = row.platformSwitch === true;
    assert.ok(
      !db || app,
      `FORBIDDEN: the database would narrow while the app renders as unlocked ` +
        `(env=${row.envFlag} switch=${row.platformSwitch})`,
    );
  }
});

test('an UNREADABLE switch is not an enforced switch', () => {
  // `readFeeEnforcementSwitch` returns null on a refused read; null and false are
  // the same answer, and neither turns the gate on behind anybody's back.
  assert.equal(feeEnforcementFromSources({ envFlag: false, platformSwitch: null }), false);
});

test('a SQL-narrowed payload names its fields on the screen, whatever the flag read said', () => {
  const narrowedBySql = {
    event: { venue_name: null, venue_address: null, region: 'NCR' },
    dietary: null,
    timeline: [],
    seat_plan: { published: false, published_at: null, table_count: 0, assigned_guests: 0 },
    monogram: { text: null, color: null, font_key: null, frame_key: null, custom_svg: null },
    withheld: ['venue', 'dietary', 'timeline'],
  };
  // Recomputing from the payload finds nothing — every field is already null.
  // The list has to be READ BACK, or the screen says "the rest of this event".
  const { withheld } = redactBriefForStage(narrowedBySql, 'booked_fee_due');
  assert.deepEqual(withheld, ['venue', 'dietary', 'timeline']);
  const copy = feeLockCopy({ stage: 'booked_fee_due', owed: null, withheld });
  assert.match(copy.detail, /exact venue and address/);
  assert.match(copy.detail, /meal counts/);
  assert.match(copy.detail, /day-of timeline/);

  // 🚨 And a payload that says it was narrowed is never rendered as unlocked.
  assert.equal(reconcileStageWithPayload('unlocked', narrowedBySql), 'booked_fee_due');
  assert.equal(reconcileStageWithPayload('unlocked', { withheld: [] }), 'unlocked');
  assert.equal(reconcileStageWithPayload('unlocked', {}), 'unlocked', 'no key = nothing narrowed');
  assert.equal(
    reconcileStageWithPayload('quoting', {}),
    'quoting',
    'a stage the app already decided is never widened by this',
  );
  assert.deepEqual(
    withheldFromPayload({ withheld: ['not_a_field', 'venue'] }),
    ['venue'],
    'only the register’s own field names are trusted',
  );
});
