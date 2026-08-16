/**
 * THE ASK MUST RETURN BEFORE ANYTHING ANNOUNCES A BOOKING.
 *
 * finalizeVendor is 4,400 lines and the lock write sits ~500 lines above the
 * effects it triggers. Three separate defects in the PR-H plan were all the same
 * shape — a side effect that fires at REQUEST time and tells somebody the deal
 * is done — and none of them is visible from the diff of the write itself. This
 * is a source-ORDER guard, because ordering is exactly what the bug is.
 *
 * It is deliberately structural rather than behavioural: running finalizeVendor
 * needs a whole Supabase session, and a mock deep enough to reach line 1,600
 * would be asserting against the mock. What can be checked cheaply and honestly
 * is that the early return is upstream of every announcement.
 *
 * MUTATIONS, each measured by occurrence count before → after:
 *   · move the `status: 'lock_requested'` return below the effects  ⇒ test 1 red
 *   · drop `!!targetVendor.marketplace_vendor_id` from handshakeAsk ⇒ test 2 red
 *   · call acquire_service_time_slot outside `if (!handshakeAsk)`   ⇒ test 3 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = resolve(HERE, '../app/dashboard/[eventId]/vendors/actions.ts');

/** Comments stripped: a docblock describing an effect must not count as one. */
function code(): string {
  return readFileSync(ACTIONS, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * finalizeVendor's BODY only.
 *
 * 🪤 THE FIRST CUT OF THIS FILE MATCHED FILE-LEVEL AND WAS WRONG TWICE OVER: it
 * took the `status: 'lock_requested'` of the TYPE DECLARATION (line ~538) as the
 * return, and it took the `triggerVendorActivityRecompute` IMPORT — and a call
 * inside a different exported action 200 lines above finalizeVendor — as
 * effects. It reported a defect that did not exist. A position test has to be
 * scoped to the function whose positions it is asserting.
 */
function finalizeBody(): string {
  const src = code();
  const start = src.indexOf('export async function finalizeVendor');
  assert.ok(start > -1, 'finalizeVendor is gone — has it been renamed?');
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next > -1 ? next : undefined);
}

test('the ask returns BEFORE every side effect that announces a booking', () => {
  const src = finalizeBody();
  // The trailing comma is the object literal; the type declaration ends in `;`
  // and lives outside this slice anyway.
  const askReturn = src.indexOf("status: 'lock_requested',");
  assert.ok(askReturn > -1, "finalizeVendor no longer returns 'lock_requested'");

  // Each of these tells a person, or acts on the world, as though the booking
  // exists. Every one must live BELOW the ask's return.
  const announcements: ReadonlyArray<[string, string]> = [
    ["'booking_confirmed'", 'tells the supplier they are booked'],
    ['event_vendor_payment_plan', 'freezes a payment plan dated from the REQUEST'],
    ['archived_by_lock_of', 'archives every rival the couple was considering'],
    ['triggerVendorActivityRecompute', 'counts a finalized booking that has not happened'],
  ];

  for (const [needle, why] of announcements) {
    const at = src.indexOf(needle, askReturn);
    const before = src.indexOf(needle);
    assert.ok(before > -1, `${needle} vanished — has finalizeVendor been restructured?`);
    assert.ok(
      before > askReturn && at > -1,
      `${needle} (${why}) appears BEFORE the ask returns — it would fire on a request`,
    );
  }
});

test('an ask is only ever made to a supplier who could answer it', () => {
  const src = finalizeBody();
  const m = src.match(/const handshakeAsk\s*=\s*([^;]+);/);
  assert.ok(m, 'handshakeAsk is gone — the ask/book fork has moved');
  const expr = m![1]!;
  assert.match(expr, /isLockHandshakeEnabled\s*\(\s*\)/, 'the ask must be flag-gated');
  // 44 of 45 production bookings are off-platform, and the DB CHECK
  // event_vendors_lock_request_marketplace_chk rejects a pending request on
  // one — so dropping this half throws a raw Postgres string at the couple on
  // the MAJORITY path, not an edge case.
  assert.match(
    expr,
    /marketplace_vendor_id/,
    'an off-platform supplier has no account to answer with — it must still book directly',
  );
});

test('the slot path never books while the couple is only asking', () => {
  const src = finalizeBody();
  // acquire_service_time_slot is SECURITY DEFINER and writes status='contracted'
  // itself, bypassing both the flag and the guard trigger (DEFINER runs as
  // postgres). If it can still run under the flag, suppliers who offer time
  // windows are booked outright while the screen says "we've asked them".
  const guard = src.indexOf('if (!handshakeAsk) {');
  const acquire = src.indexOf("'acquire_service_time_slot'");
  assert.ok(guard > -1, 'the slot-path handshake guard is gone');
  assert.ok(acquire > -1, 'acquire_service_time_slot call vanished — has the slot path moved?');
  assert.ok(
    acquire > guard,
    'acquire_service_time_slot must sit inside `if (!handshakeAsk)` — it BOOKS, it does not ask',
  );
});

test('the ask does not stamp the "chosen supplier" marks', () => {
  const src = finalizeBody();
  const m = src.match(/const lockPayload\s*=\s*handshakeAsk\s*\?\s*\{([\s\S]*?)\}\s*:/);
  assert.ok(m, 'the ask/book payload fork is gone');
  const askPayload = m![1]!;
  // Nothing clears these on a declined / expired / withdrawn request — the only
  // clearer refuses unless the row is already confirmed — so on an ask they
  // would be permanent. A forward primitive with no inverse.
  assert.doesNotMatch(askPayload, /selection_match_rank/, 'an ask is not a choice');
  assert.doesNotMatch(askPayload, /linked_vendor_profile_id/, 'an ask is not an attribution');
  assert.match(askPayload, /lock_request_state/, 'the ask must record itself');
});
