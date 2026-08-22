/**
 * Guard — a buyer may cancel a bill only before it is paid.
 *
 * `cancelOrder` used to write `status='cancelled'` with NO condition on the
 * status it was LEAVING, so a settled order could be walked to cancelled by its
 * own buyer. The RLS guard behind it cannot help: `orders_update_status_guard`
 * is RESTRICTIVE with `USING (user_id = auth.uid())` and a WITH CHECK that
 * constrains only the NEW value, which admits 'cancelled'.
 *
 * Two harms — the money record for a paid service reads as never bought, and
 * until 2026-08-21 it was the route PAST the event-delete gate: cancel the bill,
 * then delete the celebration.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  CANCELLABLE_ORDER_STATUSES,
  SETTLED_ORDER_STATUSES,
} from './event-deletion-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = resolve(HERE, '../app/dashboard/[eventId]/orders/actions.ts');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('every cancellable status is pre-payment', () => {
  // 🔑 NAMED POSITIVELY, NOT AS "anything but paid". A deny-list over an
  // eight-value enum is a bill you keep paying: add a state later and it is
  // cancellable by default.
  for (const s of CANCELLABLE_ORDER_STATUSES) {
    assert.ok(
      !(SETTLED_ORDER_STATUSES as readonly string[]).includes(s),
      `${s} is cancellable AND settled — cancelling paid money is a refund ` +
        'request, not a cancellation',
    );
  }
});

test('no settled status is cancellable by the buyer', () => {
  for (const s of SETTLED_ORDER_STATUSES) {
    assert.ok(
      !(CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(s),
      `${s} can be cancelled from the buyer's own screen`,
    );
  }
});

test('the cancel is constrained to those statuses in the query itself', () => {
  const src = read(ACTIONS);
  assert.match(
    src,
    /\.in\('status', CANCELLABLE_ORDER_STATUSES\)/,
    'cancelOrder no longer constrains the status it is LEAVING — a paid order ' +
      'can be walked to cancelled by its own buyer.',
  );
});

test('a refused cancel is not reported as a success', () => {
  const src = read(ACTIONS);
  // 🪤 Supabase does not throw. An RLS refusal and a no-op update are the same
  // shape — zero rows, no error — so without reading back, a refused cancel
  // would redirect to "cancelled=1" and the person would be told it worked.
  assert.match(
    src,
    /\.select\('order_id'\)/,
    'the cancel does not read back the row it claims to have changed',
  );
  assert.match(
    src,
    /if \(!cancelled \|\| cancelled\.length === 0\)/,
    'a zero-row cancel falls through to the success redirect',
  );
});
