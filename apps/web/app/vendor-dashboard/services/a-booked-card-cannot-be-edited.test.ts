/**
 * 🔒 A CARD A BOOKED CLIENT IS USING CANNOT BE EDITED (owner 19 Nov 2026, DECISION_LOG "SERVICE CARD EDIT LOCK +
 * SUPPLIER CLAIM JOURNEY", verbatim: *"Also add the rule that you can only edit a service card, if there are no booked
 * client that you are working with."*).
 *
 * Fails if:
 *   • any card save action writes before it asks `refuseEditOfBookedCard`, or stops refusing with what it says;
 *   • the maker's one save reaches the `save_vendor_service` RPC (or the gift clear) without passing the lock;
 *   • "booked" stops being the shipped open set (`OPEN_BOOKING_STATUSES`, the delete / turn-off locks' own) — a
 *     complete, cancelled or deleted-event booking must NOT lock the card;
 *   • the refusal stops naming the Problem, each open booking, and the Solution.
 *
 * The rule and its words run for real against a stand-in client; the action wiring is source-scanned (a server action
 * cannot load under node:test).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import {
  CARD_EDIT_UNREAD,
  CARD_IN_USE_LOCK,
  cardEditLockOf,
  cardEditLockRefusal,
  refuseEditOfBookedCard,
} from '@/lib/service-open-bookings';

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, ...p), 'utf8'));
const ACTIONS = read('actions.ts');
const ADDONS = read('addon-actions.ts');

/** A function's body, from its signature to the next top-level declaration. */
function body(src: string, sig: string): string {
  const at = src.indexOf(sig);
  assert.ok(at >= 0, `${sig} was not found — re-anchor this guard`);
  const next = src.slice(at + sig.length).search(/\n(export )?(async )?function /);
  return src.slice(at, next < 0 ? undefined : at + sig.length + next);
}

/** The lock is asked, and its answer refuses, BEFORE the first write named. */
function asksBefore(b: string, sig: string, firstWrite: string) {
  const ask = b.indexOf('refuseEditOfBookedCard(');
  const write = b.indexOf(firstWrite);
  assert.ok(ask > 0, `${sig}: the edit lock is not asked`);
  assert.ok(write > ask, `${sig}: the edit lock is asked AFTER the write (${firstWrite})`);
}

test('every card save asks the edit lock before it writes', () => {
  const commit = body(ACTIONS, 'export async function commitVendorService(');
  asksBefore(commit, 'commitVendorService', "createAdminClient().rpc('save_vendor_service'");
  asksBefore(commit, 'commitVendorService (gift clear)', ".update({ gift_pack_code: null })");
  assert.match(commit, /if \(!isCreate\) \{\s*const locked = await refuseEditOfBookedCard\(supabase, createAdminClient\(\), profile\.vendor_profile_id, serviceId as string\);\s*if \(locked\) return back\(locked\);/, 'the maker save does not refuse a locked edit');

  asksBefore(body(ACTIONS, 'export async function updateVendorService('), 'updateVendorService', 'const { data: updatedRows, error } = await supabase');
  asksBefore(body(ACTIONS, 'export async function setServiceLinks('), 'setServiceLinks', ".from('vendor_service_links')");
  asksBefore(body(ACTIONS, 'export async function setServicePaymentSchedule('), 'setServicePaymentSchedule', ".from('vendor_service_payment_schedules')");
  asksBefore(body(ACTIONS, 'export async function addServiceTimeSlot('), 'addServiceTimeSlot', ".from('vendor_service_time_slots').insert(");
  asksBefore(body(ACTIONS, 'export async function deleteServiceTimeSlot('), 'deleteServiceTimeSlot', '.update({ is_active: false');
  asksBefore(body(ADDONS, 'export async function setServiceAddons('), 'setServiceAddons', 'replaceServiceAddons(');
});

test('the RPC is reached only through the guarded save', () => {
  const calls = ACTIONS.match(/rpc\('save_vendor_service'/g) ?? [];
  assert.equal(calls.length, 1, 'a second caller of save_vendor_service must ask the edit lock too');
});

/** A stand-in for the three reads: the shop's own card (session), its bookings and their events (admin). */
function clients(opts: { own?: boolean; ownError?: boolean; picks?: unknown[] | null; events?: unknown[] }) {
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const k of ['select', 'eq']) q[k] = () => q;
    q.maybeSingle = () => Promise.resolve(result);
    q.in = () => Promise.resolve(result);
    return q;
  };
  const session = {
    from: () =>
      chain(opts.ownError ? { data: null, error: { message: 'refused' } } : { data: opts.own === false ? null : { vendor_service_id: 's1' }, error: null }),
  } as unknown as SupabaseClient;
  const admin = {
    from: (table: string) =>
      chain(
        table === 'event_vendors'
          ? opts.picks === null
            ? { data: null, error: { message: 'refused' } }
            : { data: opts.picks ?? [], error: null }
          : { data: opts.events ?? [], error: null },
      ),
  } as unknown as SupabaseClient;
  return { session, admin };
}

test('an open booking locks the card; finished, cancelled and deleted-event bookings do not', async () => {
  const free = clients({
    picks: [
      { service_id: 's1', status: 'complete', event_id: 'e1' },
      { service_id: 's1', status: 'considering', event_id: 'e2' },
      { service_id: 's1', status: 'contracted', event_id: null },
    ],
  });
  assert.equal(await refuseEditOfBookedCard(free.session, free.admin, 'shop', 's1'), null, 'nothing open → the card may be edited');

  const locked = clients({
    picks: [{ service_id: 's1', status: 'deposit_paid', event_id: 'e1' }],
    events: [{ event_id: 'e1', display_name: 'Maria & Juan’s Wedding', event_date: '2026-12-12' }],
  });
  assert.equal(
    await refuseEditOfBookedCard(locked.session, locked.admin, 'shop', 's1'),
    `A booked client is using this card. Nothing was saved.\nMaria & Juan’s Wedding · 12 Dec 2026\n${CARD_IN_USE_LOCK.solution}`,
  );

  const notMine = clients({ own: false, picks: [{ service_id: 's1', status: 'contracted', event_id: 'e1' }] });
  assert.equal(await refuseEditOfBookedCard(notMine.session, notMine.admin, 'shop', 's1'), null, 'another shop’s card is left to the action’s own not-found');
});

test('the Solution names only doors that exist — a booking never moves between cards', () => {
  assert.match(CARD_IN_USE_LOCK.problem, /^A booked client is using this card\.$/);
  assert.match(CARD_IN_USE_LOCK.solution, /finished/);
  assert.match(CARD_IN_USE_LOCK.solution, /start a new card from this one/);
  assert.doesNotMatch(CARD_IN_USE_LOCK.solution, /move/i, 'there is no way to move a booking to another card');
  assert.doesNotMatch(`${CARD_IN_USE_LOCK.name} ${CARD_IN_USE_LOCK.problem} ${CARD_IN_USE_LOCK.solution} ${CARD_EDIT_UNREAD}`, /vendor/i);
  assert.equal(cardEditLockRefusal(cardEditLockOf({ picked: 2, open: [] })), null);
});
