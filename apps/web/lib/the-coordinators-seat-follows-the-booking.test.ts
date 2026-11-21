/**
 * 🧭 THE COORDINATOR'S SEAT FOLLOWS THE BOOKING (ship review of #8094, 21 Nov 2026, items 1 and 4).
 *   1 · "is this booking a coordinator's?" is the DATABASE's rule — the shop's services (`isCoordinatorTrade`, the
 *       mirror of `services_make_a_coordinator`), never the couple's category alone; an unread shop opens nothing;
 *   2 · the seat the booking opens carries the booking (`opened_by_event_vendor_id`), so the database closes that seat
 *       — and only it — when the booking is cancelled (proved in tests/db/only-a-host-books-…db.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { bookingIsACoordinators } from './coordinator-trade';

function shop(result: { data: unknown; error: { message: string } | null }): SupabaseClient {
  const b: Record<string, unknown> = { select: () => b, eq: () => b, maybeSingle: async () => result };
  return { from: () => b } as unknown as SupabaseClient;
}

test('1 · a shop is a coordinator by its SERVICES; a supplier with no shop by the same list; unread = no', async () => {
  const coordinatorShop = shop({ data: { services: ['day_of_coordinator'] }, error: null });
  const floristShop = shop({ data: { services: ['florist'] }, error: null });
  // The couple filed a florist under "planner_coordinator": the shop's services decide, as in the database.
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'planner_coordinator', marketplaceVendorId: 'shop' }), false);
  // …and a coordinator filed under another category is still the coordinator.
  assert.equal(await bookingIsACoordinators(coordinatorShop, { category: 'misc', marketplaceVendorId: 'shop' }), true);
  // No shop: only the category exists, read through the same list.
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'planner_coordinator', marketplaceVendorId: null }), true);
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'photographer', marketplaceVendorId: null }), false);
  // A shop that could not be read opens nothing.
  const unread = shop({ data: null, error: { message: 'timeout' } });
  assert.equal(await bookingIsACoordinators(unread, { category: 'planner_coordinator', marketplaceVendorId: 'shop' }), false);
});

test('2 · the call site asks that rule and hands the booking to the seat', () => {
  const actions = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/actions.ts'), 'utf8'));
  assert.match(actions, /bookingIsACoordinators\(/, 'the grant is keyed on something other than the one rule again');
  assert.doesNotMatch(actions, /prevRow\?\.category === 'planner_coordinator'/, 'the category alone decides again');
  assert.match(actions, /eventVendorId: vendorId/, 'the seat no longer carries the booking that opened it');
  const grant = stripComments(readFileSync(join(process.cwd(), 'lib/coordinator-grant.ts'), 'utf8'));
  assert.equal(grant.match(/opened_by_event_vendor_id:/g)?.length, 3, 'every seat this file opens (invite · seat · revive) carries the booking');
});
