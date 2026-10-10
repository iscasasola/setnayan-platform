/**
 * THE STAGE PILL SAYS WHAT ACTUALLY HAPPENED.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The supplier's pipeline pill is DERIVED and READ-ONLY (owner decision): it
 * moves because the supplier did a thing, never because they picked from a
 * menu. That makes it only as honest as the facts behind it, and this repo has
 * three separate mechanisms tracking a thread's state — `chat_threads.
 * inquiry_status`, `event_vendors.status` and `inquiry_outcomes.outcome` — none
 * of which spells this ladder alone. A fourth private ordering is the failure
 * that keeps happening, so:
 *
 *   1. the ordering is one pure function, checked over EVERY combination
 *   2. "is it finished?" is one predicate, and it reads the writers that
 *      actually exist rather than the enum value nothing writes
 *   3. both surfaces go through both, and neither keeps a private ranking
 *   4. every `chat_inquiry_status` the migrations define is classified — a
 *      seventh value added later fails here instead of silently reading as a
 *      live inquiry
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  CANCELLED_INQUIRY_STATUSES,
  isCancelledInquiryStatus,
  resolveThreadStage,
  rowReadsCompleted,
  THREAD_STAGE_LABEL,
  THREAD_STAGE_TONE,
  type ThreadStage,
} from '@/lib/vendor-thread-stage';

const WEB = join(import.meta.dirname, '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const THREAD_PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
// RE-AIMED 2026-10-10 (S-PR2): was `clients/surface.tsx`, the retired second customer list — see test 3.
const CUSTOMERS = 'app/vendor-dashboard/customers/page.tsx';
const STAGE = 'lib/vendor-thread-stage.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Live statuses — the two a conversation can still be having. */
const LIVE_INQUIRY_STATUSES = ['pending', 'accepted'];

test('the scan read real files (an empty read is a green lie)', () => {
  for (const rel of [THREAD_PAGE, CUSTOMERS, STAGE]) {
    assert.ok(read(rel).length > 500, `${rel} came back empty — the scan is not reading it`);
  }
});

test('🔑 1 · the ladder is ordered the same way for every combination of facts', () => {
  // All 16 combinations, written out. The expectation is the CONTRACT:
  // completed beats everything · a live booking beats a dead thread · a dead
  // thread beats a quote sent into it · otherwise it is still an inquiry.
  const expected: Array<[boolean, boolean, boolean, boolean, ThreadStage]> = [
    // completed, booked, quoted, cancelled
    [false, false, false, false, 'inquiry'],
    [false, false, false, true, 'cancelled'],
    [false, false, true, false, 'quoted'],
    [false, false, true, true, 'cancelled'],
    [false, true, false, false, 'booked'],
    [false, true, false, true, 'booked'],
    [false, true, true, false, 'booked'],
    [false, true, true, true, 'booked'],
    [true, false, false, false, 'completed'],
    [true, false, false, true, 'completed'],
    [true, false, true, false, 'completed'],
    [true, false, true, true, 'completed'],
    [true, true, false, false, 'completed'],
    [true, true, false, true, 'completed'],
    [true, true, true, false, 'completed'],
    [true, true, true, true, 'completed'],
  ];
  assert.equal(expected.length, 16, 'the table stopped covering every combination');
  for (const [completed, booked, quoted, cancelled, want] of expected) {
    assert.equal(
      resolveThreadStage({ completed, booked, quoted, cancelled }),
      want,
      `completed=${completed} booked=${booked} quoted=${quoted} cancelled=${cancelled}`,
    );
  }
});

test('🔑 2 · "finished" reads the writers that exist, not the value nothing writes', () => {
  // The completion handshake — measured in prod: awaiting_vendor=45, confirmed=1.
  assert.equal(rowReadsCompleted({ completion_status: 'confirmed' }), true);
  assert.equal(rowReadsCompleted({ completion_status: 'auto_confirmed' }), true);
  assert.equal(rowReadsCompleted({ customer_confirmed_received_at: '2026-09-01T00:00:00Z' }), true);
  // The couple-side auto-flip 24h after the event writes `status`, and touches
  // no handshake column. Leaving it out is what made this rung unreachable.
  assert.equal(rowReadsCompleted({ status: 'delivered' }), true);
  assert.equal(rowReadsCompleted({ status: 'complete' }), true);
  // Everything before the finish line.
  for (const row of [
    { completion_status: 'awaiting_vendor', status: 'contracted' },
    // ⚖ A supplier saying they are done is a CLAIM, not a release — the same
    // boundary the delete handshake draws. It must not read as finished.
    { completion_status: 'vendor_marked', status: 'deposit_paid' },
    { completion_status: 'disputed', status: 'deposit_paid' },
    { status: 'considering' },
    null,
  ]) {
    assert.equal(rowReadsCompleted(row), false, `${JSON.stringify(row)} read as finished`);
  }
});

test('🔑 3 · both surfaces use the shared resolver and keep no private ranking', async () => {
  const page = read(THREAD_PAGE);
  const customers = read(CUSTOMERS);

  // The thread page hands the resolver the one fact it alone holds.
  assert.equal(
    (page.match(/inquiryStatus:\s*thread\.inquiry_status/g) ?? []).length,
    1,
    'the thread page stopped passing inquiry_status — a declined thread reads as a live inquiry',
  );
  /*
    RE-AIMED 2026-10-10 (supplier redesign S-PR2). The second surface here was `clients/surface.tsx`: the "Clients"
    list ranked its two buckets through `resolveThreadStage` (×2) and asked "is it finished?" with
    `rowReadsCompleted` (×1). That list is RETIRED — its rows are Customers › People's — so the two counts on it
    have nothing to count.

    What they were FOR has not gone anywhere: a customer LIST and the thread it opens must not disagree about
    whether a booking is finished. The People roster ranks by its own one rule (`customerLaneOf`, held by
    `customers/the-roster-opens-on-who-is-waiting.test.ts`), and until this change that rule looked at `status`
    alone — so a booking the couple had confirmed receiving read "Completed" on its thread and "Booked" on the
    list. The roster now ASKS the shared predicate and feeds the answer in. Pinned as a call, and executed.
    SABOTAGE: `completed: rowReadsCompleted(b)` removed from the Customers page → RED ·
    `booking?.completed ||` removed from `customerLaneOf` → RED.
  */
  assert.equal(
    (customers.match(/completed: rowReadsCompleted\(b\)/g) ?? []).length,
    1,
    'the customers list stopped asking "is it finished?" with the shared predicate',
  );
  assert.match(customers, /completion_status, customer_confirmed_received_at/, 'the roster no longer reads the completion handshake at all');
  const { customerLaneOf } = await import('./vendor-customer-pipeline');
  const lane = (booking: { status: string | null; lock_request_state: string | null; completed?: boolean }) =>
    customerLaneOf(
      { eventId: 'e1', thread: null, eventName: 'Cruz wedding', descriptor: 'Customer', eventDate: '2026-10-04', place: null,
        booking: { eventVendorId: 'ev1', requestedAt: null, expiresAt: null, ...booking } },
      true,
      Date.UTC(2026, 9, 2),
    )?.lane;
  // Every row the shared predicate calls finished lands in the finished lane…
  for (const row of [
    { status: 'contracted', completion_status: 'confirmed' },
    { status: 'contracted', completion_status: 'auto_confirmed' },
    { status: 'deposit_paid', customer_confirmed_received_at: '2026-10-01T00:00:00Z' },
    { status: 'delivered' },
    { status: 'complete' },
  ]) {
    assert.equal(rowReadsCompleted(row), true, `${JSON.stringify(row)} is not finished by the shared predicate`);
    assert.equal(lane({ status: row.status, lock_request_state: null, completed: rowReadsCompleted(row) }), 'finished', `${JSON.stringify(row)} reads finished on its thread and not on the list`);
  }
  // …and a live booking does not.
  assert.equal(lane({ status: 'contracted', lock_request_state: 'agreed', completed: rowReadsCompleted({ status: 'contracted' }) }), 'booked');
  // No surface may re-derive the finish line inline.
  for (const [rel, src] of [
    [THREAD_PAGE, page],
    [CUSTOMERS, customers],
  ] as const) {
    assert.ok(
      !/completion_status\s*===\s*'(confirmed|auto_confirmed)'/.test(src),
      `${rel} inlines the completion predicate again — it belongs in rowReadsCompleted`,
    );
  }
});

test('🔑 4 · every stage has a label and a tone, and nothing is left over', () => {
  const stages: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];
  assert.deepEqual(Object.keys(THREAD_STAGE_LABEL).sort(), [...stages].sort());
  assert.deepEqual(Object.keys(THREAD_STAGE_TONE).sort(), [...stages].sort());
  // ⚖ Cancelled must not be painted as an error — most routes to it are
  // ordinary, and red tells a supplier they did something wrong.
  assert.ok(
    !/danger|red|error/.test(THREAD_STAGE_TONE.cancelled),
    'Cancelled went red — the couple choosing somebody else is not a fault',
  );
});

test('🔑 5 · every chat_inquiry_status the migrations define is classified', () => {
  // Derived from the migrations, never hand-listed: a value added by a later
  // ALTER TYPE has to be sorted into live or cancelled, or this fails.
  const defined = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const created = sql.match(
      /CREATE TYPE\s+public\.chat_inquiry_status\s+AS ENUM\s*\(([^)]*)\)/i,
    );
    if (created) {
      for (const m of created[1]!.matchAll(/'([a-z_]+)'/g)) defined.add(m[1]!);
    }
    for (const m of sql.matchAll(
      /ALTER TYPE\s+public\.chat_inquiry_status\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([a-z_]+)'/gi,
    )) {
      defined.add(m[1]!);
    }
  }
  assert.ok(defined.size >= 6, `only found ${defined.size} enum values — the scan is not matching`);

  const classified = new Set<string>([...LIVE_INQUIRY_STATUSES, ...CANCELLED_INQUIRY_STATUSES]);
  assert.deepEqual(
    [...defined].filter((v) => !classified.has(v)).sort(),
    [],
    'a chat_inquiry_status value is neither live nor cancelled — it would read as a live inquiry',
  );
  assert.deepEqual(
    [...classified].filter((v) => !defined.has(v)).sort(),
    [],
    'the code classifies a status the database does not have',
  );
  for (const live of LIVE_INQUIRY_STATUSES) {
    assert.equal(isCancelledInquiryStatus(live), false, `${live} read as cancelled`);
  }
  for (const dead of CANCELLED_INQUIRY_STATUSES) {
    assert.equal(isCancelledInquiryStatus(dead), true, `${dead} did not read as cancelled`);
  }
  assert.equal(isCancelledInquiryStatus(null), false, 'a missing status must not read as cancelled');
});
