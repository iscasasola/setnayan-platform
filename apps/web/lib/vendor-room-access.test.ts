/**
 * ONE HONEST ANSWER TO "IS THIS SHOP BOOKED?" — the rule, and the wiring.
 *
 * Two halves, because either one alone passes while the product is broken:
 *
 *   1. THE RULE. `admitRoomBookings` is pure, so the two booking paths that
 *      write no schedule-pool row can be proved without a database.
 *   2. THE WIRING. Every rule in this file would still pass if the day-of
 *      screens quietly went back to asking the pool — which is the exact state
 *      this piece exists to end. So the ten call sites are counted, and the two
 *      readers that must NEVER widen are counted too.
 *
 * Source scans strip comments FIRST: this change deliberately writes the words
 * `fetchVendorPoolBookings` and `fetchVendorRoomEvents` into prose at the very
 * files it is counting, so a raw-source match would report the defect it just
 * fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  admitRoomBookings,
  dedupe,
  type BookingRow,
  type RoomEventRow,
  type VendorRoomEvent,
} from './vendor-room-access-rule';
import { BOOKED_VENDOR_STATUSES } from './vendors';

const ROOT = join(import.meta.dirname, '..');
const code = (p: string) =>
  readFileSync(join(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DAY = (over: Partial<RoomEventRow> = {}): RoomEventRow => ({
  display_name: 'Ana & Marco',
  event_date: '2026-12-12',
  event_date_precision: 'day',
  ...over,
});

const events = (m: Record<string, RoomEventRow>) => new Map(Object.entries(m));
const threads = (m: Record<string, string> = {}) => new Map(Object.entries(m));

// ── 1 · THE RULE ───────────────────────────────────────────────────────────

test('ARM 2 — a supplier who pressed Agree is booked, with no pool row anywhere', () => {
  const rows: BookingRow[] = [
    { vendor_id: 'ev-1', event_id: 'e-1', lock_request_state: 'agreed' },
  ];
  const out = admitRoomBookings(rows, new Set(), events({ 'e-1': DAY() }), threads());
  assert.equal(out.length, 1);
  const [only] = out;
  assert.ok(only);
  assert.equal(only.via, 'lock_agreed');
  assert.equal(only.eventId, 'e-1');
  assert.equal(only.bookedDate, '2026-12-12');
  assert.equal(only.poolBookingId, null, 'an agreed booking holds no pool row');
});

test('ARM 3 — a claimed Locked QR books the shop, and this is the arm the build note MISSED', () => {
  // vendor_claim_locked_qr (read out of prod) writes status='deposit_paid' and
  // NEVER writes lock_request_state. The specified arm 2 alone would leave this
  // supplier invisible with money already moved.
  const rows: BookingRow[] = [
    { vendor_id: 'ev-2', event_id: 'e-2', lock_request_state: null },
  ];
  const viaArm2Only = admitRoomBookings(rows, new Set(), events({ 'e-2': DAY() }), threads());
  assert.equal(viaArm2Only.length, 0, 'arm 2 cannot see a Locked QR booking — this is why arm 3 exists');

  const out = admitRoomBookings(rows, new Set(['ev-2']), events({ 'e-2': DAY() }), threads());
  assert.equal(out.length, 1);
  assert.equal(out[0]?.via, 'locked_qr');
});

test('a claimed token pointing at a booking that does NOT name this shop admits nothing', () => {
  // A shop can write its own vendor_locked_qr_tokens rows (the RLS policy is
  // FOR ALL on vendor_profile_id), so the token alone is not the proof. The
  // candidate set is scoped in SQL to marketplace_vendor_id = this shop, so a
  // token naming a foreign booking has no candidate row to match.
  const out = admitRoomBookings([], new Set(['someone-elses-ev']), events({}), threads());
  assert.equal(out.length, 0);
});

test('a booking the couple merely typed in is NOT booked', () => {
  // event_vendors_couple_write is FOR ALL with no column list, so a couple can
  // set any status they like. Status alone is never the answer.
  const rows: BookingRow[] = [
    { vendor_id: 'ev-3', event_id: 'e-3', lock_request_state: null },
    { vendor_id: 'ev-4', event_id: 'e-4', lock_request_state: 'pending' },
    { vendor_id: 'ev-5', event_id: 'e-5', lock_request_state: 'declined' },
    { vendor_id: 'ev-6', event_id: 'e-6', lock_request_state: 'cancelled' },
    { vendor_id: 'ev-7', event_id: 'e-7', lock_request_state: 'expired' },
  ];
  const out = admitRoomBookings(
    rows,
    new Set(),
    events(Object.fromEntries(rows.map((r) => [r.event_id, DAY()]))),
    threads(),
  );
  assert.deepEqual(out, [], 'only the shop saying yes admits a booking');
});

test('an event with no SETTLED day is refused — a placeholder date is not a booking day', () => {
  // Production holds a 'year'-precision event carrying an event_date right now.
  // Without this filter a supplier would get a full day-of console on a date
  // nobody has agreed to.
  const rows: BookingRow[] = [
    { vendor_id: 'ev-8', event_id: 'e-8', lock_request_state: 'agreed' },
    { vendor_id: 'ev-9', event_id: 'e-9', lock_request_state: 'agreed' },
    { vendor_id: 'ev-10', event_id: 'e-10', lock_request_state: 'agreed' },
  ];
  const out = admitRoomBookings(
    rows,
    new Set(),
    events({
      'e-8': DAY({ event_date_precision: 'year' }),
      'e-9': DAY({ event_date_precision: 'month' }),
      'e-10': DAY({ event_date: null }),
    }),
    threads(),
  );
  assert.deepEqual(out, []);
});

test('an event row that could not be read admits nothing rather than guessing a date', () => {
  const rows: BookingRow[] = [
    { vendor_id: 'ev-11', event_id: 'e-missing', lock_request_state: 'agreed' },
  ];
  assert.deepEqual(admitRoomBookings(rows, new Set(), events({}), threads()), []);
});

test('the chat thread rides along when there is one, and null is not an error', () => {
  const rows: BookingRow[] = [
    { vendor_id: 'ev-12', event_id: 'e-12', lock_request_state: 'agreed' },
    { vendor_id: 'ev-13', event_id: 'e-13', lock_request_state: 'agreed' },
  ];
  const out = admitRoomBookings(
    rows,
    new Set(),
    events({ 'e-12': DAY(), 'e-13': DAY() }),
    threads({ 'e-12': 't-12' }),
  );
  assert.equal(out.find((e) => e.eventId === 'e-12')?.threadId, 't-12');
  assert.equal(out.find((e) => e.eventId === 'e-13')?.threadId, null);
});

test('an unnamed event still reads as a Setnayan event, never as empty', () => {
  const out = admitRoomBookings(
    [{ vendor_id: 'ev-14', event_id: 'e-14', lock_request_state: 'agreed' }],
    new Set(),
    events({ 'e-14': DAY({ display_name: null }) }),
    threads(),
  );
  assert.equal(out[0]?.eventName, 'A Setnayan event');
});

// ── dedupe: a pool row and an agreed row for the same day are ONE booking ───

test('a pool booking WINS over an agreed row for the same day, so poolId survives', () => {
  const pool: VendorRoomEvent = {
    poolBookingId: 'pb-1',
    poolId: 'p-1',
    eventId: 'e-1',
    bookedDate: '2026-12-12',
    eventName: 'Ana & Marco',
    threadId: null,
    via: 'schedule_pool',
    eventVendorId: null,
  };
  const agreed = admitRoomBookings(
    [{ vendor_id: 'ev-1', event_id: 'e-1', lock_request_state: 'agreed' }],
    new Set(),
    events({ 'e-1': DAY() }),
    threads(),
  );
  const out = dedupe([pool, ...agreed]);
  assert.equal(out.length, 1, 'one booking, not two');
  assert.equal(out[0]?.poolId, 'p-1', 'the pool row must not be replaced by a null-pool one');
});

test('a multi-day celebration keeps every day it is booked for', () => {
  const mk = (date: string): VendorRoomEvent => ({
    poolBookingId: `pb-${date}`,
    poolId: 'p-1',
    eventId: 'e-1',
    bookedDate: date,
    eventName: 'Ana & Marco',
    threadId: null,
    via: 'schedule_pool',
    eventVendorId: null,
  });
  const out = dedupe([mk('2026-12-13'), mk('2026-12-12')]);
  assert.equal(out.length, 2, 'dedupe is on (event, date), never on event alone');
  assert.deepEqual(out.map((e) => e.bookedDate), ['2026-12-12', '2026-12-13'], 'sorted by day');
});

// ── 2 · THE WIRING ─────────────────────────────────────────────────────────

const ROOM_SITES: ReadonlyArray<readonly [string, number]> = [
  ['app/vendor-dashboard/on-the-day/page.tsx', 1],
  ['app/vendor-dashboard/on-the-day/actions.ts', 4],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx', 2],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/papic/page.tsx', 1],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts', 1],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions.ts', 1],
];

test('every day-of screen asks the room read, and none of them still asks the pool', () => {
  let total = 0;
  for (const [file, expected] of ROOM_SITES) {
    const src = code(file);
    const calls = [...src.matchAll(/fetchVendorRoomEvents\(/g)].length;
    assert.equal(calls, expected, `${file} should call fetchVendorRoomEvents ${expected}×, got ${calls}`);
    assert.equal(
      [...src.matchAll(/fetchVendorPoolBookings\(/g)].length,
      0,
      `${file} went back to the raw pool read — an agreed or Locked-QR booking is invisible again`,
    );
    total += calls;
  }
  assert.equal(total, 10, 'ten day-of call sites in six files');
});

test('⛔ THE PUBLIC SHOP PAGE MUST NEVER USE THE ROOM READ', () => {
  // The room read admits an AGREED-but-unpaid booking. app/v/[slug] is served to
  // strangers, so widening it here publishes weddings nobody has paid a
  // downpayment on.
  const src = code('app/v/[slug]/page.tsx');
  assert.equal([...src.matchAll(/fetchVendorRoomEvents/g)].length, 0);
  assert.equal([...src.matchAll(/fetchVendorPoolBookings\(/g)].length, 1);
});

test('the interconnection probe keeps watching the pool reader it was written for', () => {
  const src = code('lib/interconnect/probes.ts');
  assert.equal([...src.matchAll(/fetchVendorRoomEvents/g)].length, 0);
  assert.equal([...src.matchAll(/fetchVendorPoolBookings\(/g)].length, 1);
});

test('every reader left on the pool read carries a stated reason', () => {
  // A leave-behind with no reason is indistinguishable from one that was missed.
  const LEFT = [
    'app/vendor-dashboard/calendar/surface.tsx',
    'app/vendor-dashboard/calendar/[date]/page.tsx',
    'app/vendor-dashboard/customers/page.tsx',
    'app/vendor-dashboard/clients/surface.tsx',
    'app/vendor-dashboard/shop/page.tsx',
    'app/vendor-dashboard/recaps/page.tsx',
    'app/vendor-dashboard/real-stories/page.tsx',
    'app/vendor-dashboard/proposals/surface.tsx',
    'app/vendor-dashboard/services/_components/services-manager.tsx',
    'app/v/[slug]/page.tsx',
    'lib/vendor-overview.ts',
    'lib/interconnect/probes.ts',
  ];
  assert.equal(LEFT.length, 12, 'twelve readers stay on the pool read — measured, not remembered');
  for (const file of LEFT) {
    const raw = readFileSync(join(ROOT, file), 'utf8');
    const idx = raw.indexOf('fetchVendorPoolBookings(');
    assert.ok(idx > 0, `${file} no longer reads the pool at all — update this list`);
    const preamble = raw.slice(Math.max(0, idx - 900), idx);
    assert.match(
      preamble,
      /\/\/[^\n]*(CAPACITY|DEMAND|LEFT|MUST NEVER)/,
      `${file} stays on the pool read with no stated reason`,
    );
  }
});

test('the room read imports the TYPED status set and never retypes the four strings', () => {
  const src = code('lib/vendor-room-access.ts');
  assert.match(
    src,
    /import \{ BOOKED_VENDOR_STATUSES \} from '@\/lib\/vendors'/,
    "the typed copy in lib/vendors is the one to import — a second, untyped copy lives in lib/event-deletion-gate",
  );
  assert.match(src, /\.in\('status', BOOKED_VENDOR_STATUSES/, 'the query stopped using it');
  for (const s of ['contracted', 'deposit_paid', 'delivered', 'complete']) {
    assert.ok(
      !new RegExp(`'${s}'`).test(src),
      `'${s}' is retyped in vendor-room-access — import the set instead`,
    );
  }
  assert.deepEqual(
    [...BOOKED_VENDOR_STATUSES].sort(),
    ['complete', 'contracted', 'delivered', 'deposit_paid'],
    'the imported set changed shape — re-read what "booked" now means',
  );
});

test('the RULE file stays pure — no client, no io, so it can keep being imported here', () => {
  // This test file imports vendor-room-access-rule directly. The moment that
  // file reaches for a Supabase client or `server-only`, every behaviour test
  // above dies with MODULE_NOT_FOUND rather than a useful failure.
  const src = code('lib/vendor-room-access-rule.ts');
  assert.ok(!/server-only/.test(src), 'the rule file must never import server-only');
  assert.ok(
    !/createAdminClient|SupabaseClient|createClient\(/.test(src),
    'the rule file must never touch a database client',
  );
});

test('the room read is scoped in SQL by the id it was handed, and resolves no session', () => {
  const src = code('lib/vendor-room-access.ts');
  // The grantee path in on-the-day/live passes an admin client and a vendor id
  // derived from an access GRANT. Resolving the caller from the session in here
  // would break that role silently.
  assert.ok(!/auth\.getUser|fetchOwnVendorProfile|createClient\(/.test(src),
    'fetchVendorRoomEvents must take the shop id in, never resolve it from the session');
  assert.match(
    src,
    /\.eq\('marketplace_vendor_id', vendorProfileId\)/,
    'the authorization read must be scoped in SQL to the id the caller proved',
  );
  assert.match(
    src,
    /\.eq\('vendor_profile_id', vendorProfileId\)/,
    'the token read must be scoped to this shop too',
  );
});

test('a failed widening degrades to the pool and is logged, never swallowed', () => {
  const src = code('lib/vendor-room-access.ts');
  assert.equal(
    [...src.matchAll(/logQueryError\(/g)].length,
    3,
    'each of the three added reads must report its own failure',
  );
});
