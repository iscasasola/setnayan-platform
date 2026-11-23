/**
 * 📅 EVERY DOOR THAT ASKS OR BOOKS ASKS THE SHOP'S WINDOW — AND THE CARD'S ORDER LEAD (supplier-ready walk, 22 Nov 2026).
 *
 * The walk of schedules and service cards found three breaks, each fixed here and held by this file:
 *   A · the shop's At least · At most (`lib/booking-window.ts`, owner 2026-11-19) refused only the supplier-page ask
 *       (`finalizeVendor`). The chat's "Lock this deal", a package lock and the wizard's [Lock this vendor] asked the
 *       supplier for a day Check a date had shown the couple as Not bookable;
 *   B · a Made-to-order card's "Order at least N days" was asked only on the no-slot path, so a card that kept time
 *       slots was asked with no lead check;
 *   C · the Schedule page's days strip drew a month-only event (stored on the 1st) as "Event day" on the 1st.
 *
 * Fails if:
 *   1 · the one helper stops refusing a day outside the window, refuses one inside it, or blocks on a failed read;
 *   2 · the chat lock stops refusing (driven for real), or writes the ask anyway;
 *   3 · any of the four doors stops asking the helper before its write, or computes the window itself;
 *   4 · the order lead moves back below the slot / #2 split;
 *   5 · the days strip draws a placeholder day, or hides the day when the precision could not be read.
 *
 * SABOTAGE (each seen red, restored): see the PR body.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { eventDayForStrip } from '@/lib/schedule-days';

/* `server-only` shim — same as lib/a-closed-day-takes-no-ask-and-no-yes.test.ts. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_booking_window__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}
// The ask (handshake ON) is the press this is about; pinned so the test measures it, not the runner's env.
process.env.NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED = 'true';

let bookingWindowRefusal: typeof import('./booking-window.server').bookingWindowRefusal;
let bookVendorAtChatLock: typeof import('./chat-lock-booking.server').bookVendorAtChatLock;
before(async () => {
  ({ bookingWindowRefusal } = await import('./booking-window.server'));
  ({ bookVendorAtChatLock } = await import('./chat-lock-booking.server'));
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Noon in Manila on 22 Nov 2026. */
const NOW = new Date('2026-11-22T04:00:00Z');
const DAY = '2026-11-25';

/** A service-role client whose vendor_profiles read answers `row`, an error, or throws. */
function windowAdmin(answer: { row?: Record<string, unknown> | null; error?: boolean; throws?: boolean }) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = async () => {
    if (answer.throws) throw new Error('socket hang up');
    return answer.error ? { data: null, error: { message: 'refused', code: '42501' } } : { data: answer.row ?? null, error: null };
  };
  return { from: () => b } as unknown as SupabaseClient;
}

test('1 · the one helper: outside the window is refused in the shop’s words; inside, unread or not a day is not', async () => {
  const shop = windowAdmin({ row: { booking_min_days: 7, booking_max_months: 6 } });
  const soon = await bookingWindowRefusal({ vendorProfileId: 'vp1', day: DAY, admin: shop, now: NOW });
  assert.match(soon ?? '', /at least 7 days before the date/, '3 days away on a 7-day shop is too soon');
  const far = await bookingWindowRefusal({ vendorProfileId: 'vp1', day: '2027-08-01', admin: shop, now: NOW });
  assert.match(far ?? '', /up to 6 months ahead/, 'past At most is too far');
  assert.equal(await bookingWindowRefusal({ vendorProfileId: 'vp1', day: '2026-12-10', admin: shop, now: NOW }), null, 'inside');
  assert.equal(
    await bookingWindowRefusal({ vendorProfileId: 'vp1', day: '2026-12-10T00:00:00+08:00', admin: shop, now: NOW }),
    null,
    'a timestamp is read as its civil day',
  );
  const unset = windowAdmin({ row: { booking_min_days: null, booking_max_months: null } });
  assert.equal(await bookingWindowRefusal({ vendorProfileId: 'vp1', day: '2026-11-22', admin: unset, now: NOW }), null, 'no setting = same day');
  // Fails OPEN on a read the couple cannot act on (the deposit gate and the supplier's yes still stand).
  assert.equal(await bookingWindowRefusal({ vendorProfileId: 'vp1', day: DAY, admin: windowAdmin({ error: true }), now: NOW }), null);
  assert.equal(await bookingWindowRefusal({ vendorProfileId: 'vp1', day: DAY, admin: windowAdmin({ throws: true }), now: NOW }), null);
  assert.equal(await bookingWindowRefusal({ vendorProfileId: null, day: DAY, admin: shop, now: NOW }), null, 'no shop, nothing to ask');
  assert.equal(await bookingWindowRefusal({ vendorProfileId: 'vp1', day: null, admin: shop, now: NOW }), null, 'no day, nothing to ask');
});

/** The couple's client: the ask row, then the event's day; captures any UPDATE. */
function stubAuthed(sink: { wrote: boolean }) {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.not = () => b;
    b.update = () => {
      sink.wrote = true;
      return b;
    };
    b.maybeSingle = async () =>
      table === 'events'
        ? { data: { event_date: DAY, event_date_precision: 'day' }, error: null }
        : { data: { status: 'considering', lock_request_state: null, service_id: 'card', service_time_slot_id: null }, error: null };
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [{ vendor_id: 'ev1' }], error: null }).then(resolve);
    return b;
  };
  return { from: (table: string) => builder(table) } as unknown as SupabaseClient;
}
function stubAdmin() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = async () => ({
    data: { verification_state: 'verified', public_visibility: 'verified', fraud_suspended_at: null, fraud_banned_at: null, paused_at: null },
    error: null,
  });
  return { from: () => b, rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient;
}
const ARGS = { eventId: 'e1', eventVendorId: 'ev1', marketplaceVendorId: 'vp1', agreedTotalPhp: 85_000 };

test('2 · the chat’s Lock this deal outside the window is refused in the shop’s words and writes nothing', async () => {
  const openSwitch = { bookingsOpen: async () => true };
  const open = async () => null;
  const seen: unknown[] = [];
  const outside = async (a: unknown) => {
    seen.push(a);
    return 'This supplier takes bookings at least 7 days before the date.';
  };
  const sink = { wrote: false };
  const refused = await bookVendorAtChatLock(stubAuthed(sink), stubAdmin(), ARGS, openSwitch, open, outside);
  assert.deepEqual(refused, { status: 'outside_window', message: 'This supplier takes bookings at least 7 days before the date.' });
  assert.equal(sink.wrote, false, 'a day outside the window must not record the ask');
  assert.deepEqual(
    { ...(seen[0] as Record<string, unknown>), admin: undefined },
    { vendorProfileId: 'vp1', day: DAY, admin: undefined },
    'the window is asked about THIS shop on THIS event day',
  );

  const sink2 = { wrote: false };
  const asked = await bookVendorAtChatLock(stubAuthed(sink2), stubAdmin(), ARGS, openSwitch, open, async () => null);
  assert.equal(asked.status, 'requested');
  assert.equal(sink2.wrote, true);
});

/** The first index of `needle` after `from` in `src`, asserting it is there. */
function at(src: string, needle: string, from = 0): number {
  const i = src.indexOf(needle, from);
  assert.ok(i >= 0, `${needle} not found`);
  return i;
}

test('3 · every door asks the ONE helper before its write — and none computes the window itself', () => {
  const doors: { file: string; start?: string; call?: string }[] = [
    { file: 'app/dashboard/[eventId]/vendors/actions.ts', start: 'export async function finalizeVendor(' },
    { file: 'app/dashboard/[eventId]/vendors/packages/actions.ts' },
    { file: 'app/dashboard/[eventId]/wizard-actions.ts' },
    { file: 'lib/chat-lock-booking.server.ts', call: 'await windowRefusal({' },
  ];
  for (const d of doors) {
    const src = read(d.file);
    const from = d.start ? at(src, d.start) : 0;
    const check = at(src, d.call ?? 'bookingWindowRefusal(', from);
    assert.ok(check < at(src, "lock_request_state: 'pending'", from), `${d.file}: the window is asked before the ask is written`);
    assert.doesNotMatch(src, /readBookingWindow\(|outsideBookingWindow\(/, `${d.file}: one helper, never a second reading`);
  }
  const fin = read('app/dashboard/[eventId]/vendors/actions.ts');
  const f0 = at(fin, 'export async function finalizeVendor(');
  assert.ok(at(fin, 'bookingWindowRefusal(', f0) < at(fin, 'let slotPathLocked = false;', f0), 'finalizeVendor: above the slot / #2 split');

  const chat = read('lib/chat-lock-booking.server.ts');
  assert.match(chat, /windowRefusal: typeof bookingWindowRefusal = bookingWindowRefusal/, 'the chat lock defaults to the real helper');
  const cCheck = at(chat, 'await windowRefusal({');
  const branch = chat.lastIndexOf("if (action === 'book' || action === 'request') {", cCheck);
  assert.ok(branch > 0 && chat.indexOf('\n  }\n', branch) > cCheck, 'chat lock: an ask AND a booking are checked');
  const deal = read('app/_components/negotiation-actions.ts');
  assert.match(deal, /outcome\.status === 'outside_window'\) \{\s*failBack\(outcome\.message\)/, 'lockDeal says why');
});

test('4 · the Made-to-order lead is asked above the slot / #2 split, once', () => {
  const fin = read('app/dashboard/[eventId]/vendors/actions.ts');
  const f0 = at(fin, 'export async function finalizeVendor(');
  const body = fin.slice(f0, at(fin, '\nexport async function ', f0 + 10));
  assert.equal((body.match(/'service_card_order_lead_days'/g) ?? []).length, 1, 'one lead check, not one per path');
  assert.ok(at(body, "'service_card_order_lead_days'") < at(body, 'let slotPathLocked = false;'), 'a card with time slots is checked too');
  assert.match(body.slice(at(body, "'service_card_order_lead_days'")), /^[\s\S]{0,500}orderIsTooSoon\(phTodayIso\(\), wd\.event_date, lead\)/);
});

test('5 · the days strip draws only a day-precise event day, and keeps the day when the precision is unread', () => {
  assert.equal(eventDayForStrip('2027-02-14', 'day'), '2027-02-14');
  assert.equal(eventDayForStrip('2027-02-01', 'month'), null, 'a month-only event is not "Event day" on the 1st');
  assert.equal(eventDayForStrip('2027-01-01', 'year'), null);
  assert.equal(eventDayForStrip('2027-02-01', undefined), '2027-02-01', 'an unread precision never hides the day');
  assert.equal(eventDayForStrip(null, 'day'), null);
  const page = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /select\('supplier_requests_auto_agree, event_date, event_date_precision'\)/, 'the precision rides the existing read');
  assert.match(
    page,
    /const agendaEventDate = eventDayForStrip\(brief\.event\.event_date \?\? null, factsEvent\.error \|\| !factsRow \? undefined : \(factsRow\.event_date_precision \?\? null\)\)/,
  );
});
