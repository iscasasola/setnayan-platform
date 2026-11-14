/**
 * ⬜ A DAY THE SUPPLIER CLOSED IS GREY — NO ASKING, NO BOOKING (owner 2026-11-14: *"Grey: no ask, no book"*,
 * DECISION_LOG "A DAY THE SUPPLIER CLOSED IS GREY — NO ASKING, NO BOOKING"). Before this, a card with no time slots
 * was refused on a closed day only when the deposit was recorded (`acquire_schedule_pools`).
 *
 * Fails if:
 *   1 · the rule stops reading a day the supplier closed (a manual or synced block, a held day) as closed — or starts
 *       reading a day that is merely FULL (a booking, an outside client, the automatic booked-date block) as closed,
 *       which would take the waiting list away from exactly the days it exists for;
 *   2 · the couple's ask stops being refused on a closed day (the chat lock, driven for real), or writes the row anyway;
 *   3 · any of the four ask doors or the supplier's yes stops asking the closed-day check BEFORE its write / the RPC;
 *   4 · the check stops reading the date sheet's own source (`readShopDateFacts` + `checkDateAnswer`).
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
import { isClosedDay, type ClosedDayFacts } from '@/lib/closed-day';

/* `server-only` shim — same as lib/a-locked-deal-reaches-the-budget.test.ts: the module the bundler supplies does not
 * exist in node_modules, so the server module is imported dynamically after this is registered. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_closed_day__.js');
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
// The ask (handshake ON) is the press this ruling is about; pinned so the test measures it, not the runner's env.
process.env.NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED = 'true';

let bookVendorAtChatLock: typeof import('./chat-lock-booking.server').bookVendorAtChatLock;
before(async () => {
  ({ bookVendorAtChatLock } = await import('./chat-lock-booking.server'));
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const TODAY = '2026-11-14';
const DAY = '2026-12-12';
const facts = (over: Partial<ClosedDayFacts> = {}): ClosedDayFacts => ({
  pools: [{ poolId: 'cater', capacity: 1 }],
  bookings: [],
  blocks: [],
  dayStates: [],
  services: [{ serviceId: 'card', poolIds: ['cater'] }],
  ...over,
});
const block = (source: 'manual' | 'synced_calendar' | 'setnayan_booking' | 'external_client', poolId: string | null = null) => ({
  poolId,
  source,
  startDate: DAY,
  endDate: DAY,
  repeat: 'once' as const,
  repeatUntil: null,
  dayPart: 'all_day' as const,
});
const closed = (f: ClosedDayFacts, serviceId: string | null = 'card', day = DAY) => isClosedDay(f, { serviceId, day, today: TODAY });

test('1 · a day the supplier closed is closed: a manual block, a synced calendar block, a held day', () => {
  assert.equal(closed(facts()), false, 'an open day is open');
  assert.equal(closed(facts({ blocks: [block('manual')] })), true, 'a manual all-day "Not available"');
  assert.equal(closed(facts({ blocks: [block('synced_calendar')] })), true, 'a day busy on the synced calendar');
  assert.equal(closed(facts({ dayStates: [{ poolId: null, stateDate: DAY, dayState: 'locked' }] })), true, 'a held day');
  assert.equal(closed(facts({ dayStates: [{ poolId: null, stateDate: DAY, dayState: 'whitelist' }] })), false, 'approve-first is not closed');
  assert.equal(closed(facts({ blocks: [block('manual')] }), null), true, 'closed for the shop as a whole too');
  assert.equal(closed(facts({ blocks: [block('manual')] }), 'card', '2026-11-01'), false, 'a past day is never answered');
});

test('1b · a FULL day is not closed — the waiting list keeps it', () => {
  assert.equal(closed(facts({ bookings: [{ poolId: 'cater', bookedDate: DAY }] })), false, 'a Setnayan booking fills the day');
  assert.equal(closed(facts({ blocks: [block('setnayan_booking', 'cater')] })), false, 'the automatic booked-date block');
  assert.equal(closed(facts({ blocks: [block('external_client', 'cater')] })), false, 'a client booked outside');
});

test('1c · per card: a day closed on one schedule is closed for the card on it, not for a card elsewhere', () => {
  const two = facts({
    pools: [
      { poolId: 'cater', capacity: 1 },
      { poolId: 'lights', capacity: 1 },
    ],
    services: [
      { serviceId: 'card', poolIds: ['cater'] },
      { serviceId: 'other', poolIds: ['lights'] },
    ],
    blocks: [block('manual', 'cater')],
  });
  assert.equal(closed(two, 'card'), true);
  assert.equal(closed(two, 'other'), false);
  assert.equal(closed(two, null), false, 'the shop as a whole is not closed while another card is open');
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
    data: { verification_state: 'verified', public_visibility: 'verified', fraud_suspended_at: null, fraud_banned_at: null },
    error: null,
  });
  return { from: () => b, rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient;
}
const ARGS = { eventId: 'e1', eventVendorId: 'ev1', marketplaceVendorId: 'vp1', agreedTotalPhp: 85_000 };

test('2 · the ask (chat lock) on a closed day is refused and writes nothing; on an open day it asks', async () => {
  const seen: unknown[] = [];
  const shut = {
    bookingsOpen: async () => true,
    closedDay: async (a: unknown) => {
      seen.push(a);
      return 'closed' as const;
    },
  };
  const sink = { wrote: false };
  const refused = await bookVendorAtChatLock(stubAuthed(sink), stubAdmin(), ARGS, shut);
  assert.equal(refused.status, 'date_closed');
  assert.equal(sink.wrote, false, 'a closed day must not record the ask');
  assert.deepEqual(
    { ...(seen[0] as Record<string, unknown>), admin: undefined },
    { vendorProfileId: 'vp1', serviceId: 'card', day: DAY, slotted: false, admin: undefined },
    'the check is asked about THIS card on THIS event day',
  );

  const open = { bookingsOpen: async () => true, closedDay: async () => null };
  const sink2 = { wrote: false };
  const asked = await bookVendorAtChatLock(stubAuthed(sink2), stubAdmin(), ARGS, open);
  assert.equal(asked.status, 'requested');
  assert.equal(sink2.wrote, true);
});

/** The first index of `needle` after `from` in `src`, asserting it is there. */
function at(src: string, needle: string | RegExp, from = 0, what = String(needle)): number {
  const i = typeof needle === 'string' ? src.indexOf(needle, from) : src.slice(from).search(needle) + from;
  assert.ok(i >= from && (typeof needle === 'string' ? i >= 0 : src.slice(from).search(needle) >= 0), `${what} not found`);
  return i;
}

test('3 · every ask door asks the closed-day check before its write', () => {
  // finalizeVendor — the no-slot path, before the generic ask/lock write.
  const fin = read('app/dashboard/[eventId]/vendors/actions.ts');
  const f0 = at(fin, 'export async function finalizeVendor(');
  const fNoSlot = at(fin, 'if (useSlotPath) {', f0);
  const fCheck = at(fin, 'closedDayRefusal({', fNoSlot);
  const fWrite = at(fin, "lock_request_state: 'pending'", f0);
  assert.ok(fCheck < fWrite, 'finalizeVendor: the closed-day check must come before the ask is written');
  assert.match(fin.slice(fCheck, fCheck + 400), /serviceId: targetVendor\.service_id/, 'finalizeVendor asks about the card on the row');
  assert.match(fin.slice(fCheck, fCheck + 600), /CLOSED_DAY_COUPLE_MESSAGE/, 'finalizeVendor answers with the closed-day words');

  // lockPackage — before the rows are written.
  const pkg = read('app/dashboard/[eventId]/vendors/packages/actions.ts');
  const pCheck = at(pkg, 'closedDayRefusal({');
  assert.ok(pCheck < at(pkg, "lock_request_state: 'pending'"), 'lockPackage: check before the ask is written');

  // The wizard's [Lock this vendor] — before the insert.
  const wiz = read('app/dashboard/[eventId]/wizard-actions.ts');
  const wCheck = at(wiz, 'closedDayRefusal({');
  assert.ok(wCheck < at(wiz, "lock_request_state: 'pending'"), 'wizard: check before the ask is inserted');

  // The chat lock — before its ask and its booking write.
  const chat = read('lib/chat-lock-booking.server.ts');
  const cCheck = at(chat, '?? closedDayRefusal)(');
  assert.ok(cCheck < at(chat, "lock_request_state: 'pending'"), 'chat lock: check before the ask');
  assert.match(chat.slice(cCheck - 700, cCheck), /action === 'book' \|\| action === 'request'/, 'chat lock: an ask AND a booking are checked');
  const deal = read('app/_components/negotiation-actions.ts');
  assert.match(deal, /outcome\.status === 'date_closed'\) \{\s*failBack\(CLOSED_DAY_COUPLE_MESSAGE\)/, 'lockDeal says why');
});

test('3b · the supplier’s yes asks the closed-day check before the RPC that books', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const f0 = at(src, 'export async function vendorAgreeToLock(');
  const check = at(src, 'await closedDayOfAsk(supabase, eventVendorId)', f0);
  const rpc = at(src, "supabase.rpc('vendor_agree_to_lock'", f0);
  assert.ok(check < rpc, 'the yes is refused on a closed day before vendor_agree_to_lock runs');
  assert.match(src.slice(check, check + 200), /lock_agree=day_closed/);
  const notice = read('lib/lock-answer-notice.ts');
  assert.match(notice, /day_closed: \(\) => \(\{\s*tone: 'refused'/, 'the supplier is told why');
});

test('4 · one source: the date sheet’s reads and month builder', () => {
  const server = read('lib/closed-day.server.ts');
  assert.match(server, /readShopDateFacts\(admin, args\.vendorProfileId/);
  assert.match(server, /isClosedDay\(facts,/);
  const rule = read('lib/closed-day.ts');
  assert.match(rule, /checkDateAnswer\(\{[\s\S]*closedOnly: true/);
  const page = read('lib/check-a-date.server.ts');
  assert.match(page, /readShopDateFacts\(admin, id,/, 'the public page reads through the same loader');
});
