/**
 * Unit suite + wiring guard for the venue-door throttle.
 *
 * Load-bearing invariants:
 *   • it refuses ONLY on a real `ok: false`, and FAILS OPEN on an unreadable
 *     limiter (these doors have no shared ceiling — see the module docblock);
 *   • a raw IP never reaches the limiter identity;
 *   • the claim doors key on the connection, NOT the token (a rotating token
 *     must still meet the same bucket), and guest-pick keys per event;
 *   • at every door the throttle sits behind the flag and BEFORE the anonymous
 *     mint — a throttle placed after `signInAnonymously` protects nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  allowVenueDoorAttempt,
  venueDoorIdent,
  VENUE_DOORS,
  VENUE_DOOR_LIMIT,
  VENUE_DOOR_WINDOW_SECS,
  VENUE_DOOR_STATE,
} from '@/lib/venue-door-throttle';
import { JOIN_DOOR_LIMIT, JOIN_DOOR_WINDOW_SECS } from '@/lib/join-door-throttle';
import { stripComments } from '@/lib/strip-comments';

const IP = { 'x-vercel-forwarded-for': '203.0.113.7' };
const hdrs = (init: Record<string, string>) => new Headers(init);

type Call = { bucket: string; ident: string | null; opts: { limit: number; windowSecs: number } };
function recording(result: unknown) {
  const calls: Call[] = [];
  const limiter = async (bucket: string, ident: string | null, opts: Call['opts']) => {
    calls.push({ bucket, ident, opts });
    return result as { ok: boolean; retryAfterSecs: number; remaining: number };
  };
  return { calls, limiter };
}

// ── the decision ─────────────────────────────────────────────────────────────

test('allowed when the limiter says ok, and it asks with the venue sizing', async () => {
  const { calls, limiter } = recording({ ok: true, retryAfterSecs: 0, remaining: 5 });
  const d = await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, hdrs(IP), { limiter });
  assert.deepEqual(d, { allowed: true, retryAfterSecs: 0, reason: 'ok' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.bucket, VENUE_DOORS.papicSeatClaim);
  assert.deepEqual(calls[0]!.opts, { limit: VENUE_DOOR_LIMIT, windowSecs: VENUE_DOOR_WINDOW_SECS });
});

test('refused on a real ok:false, carrying the limiter\'s retry-after', async () => {
  const { limiter } = recording({ ok: false, retryAfterSecs: 46.2, remaining: 0 });
  const d = await allowVenueDoorAttempt(VENUE_DOORS.guestPick, 'evt-a', hdrs(IP), { limiter });
  assert.deepEqual(d, { allowed: false, retryAfterSecs: 47, reason: 'throttled' });
});

test('refused with no usable retry-after falls back to the window, never 0', async () => {
  const { limiter } = recording({ ok: false, retryAfterSecs: Number.NaN, remaining: 0 });
  const d = await allowVenueDoorAttempt(VENUE_DOORS.guestPick, 'evt-a', hdrs(IP), { limiter });
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfterSecs, VENUE_DOOR_WINDOW_SECS);
});

test('FAILS OPEN when the limiter throws — a limiter outage must not lock the crew out', async () => {
  const d = await allowVenueDoorAttempt(VENUE_DOORS.panoodCameraClaim, null, hdrs(IP), {
    limiter: async () => {
      throw new Error('pg down');
    },
  });
  assert.deepEqual(d, { allowed: true, retryAfterSecs: 0, reason: 'limiter_unavailable' });
});

test('FAILS OPEN on an unreadable limiter result', async () => {
  for (const junk of [null, undefined, 'nope', {}, { ok: 'false' }]) {
    const { limiter } = recording(junk);
    const d = await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, hdrs(IP), { limiter });
    assert.equal(d.allowed, true, `junk ${JSON.stringify(junk)}`);
    assert.equal(d.reason, 'limiter_unavailable');
  }
});

test('no client IP → allowed WITHOUT consuming a slot (IP-less callers must not share one bucket)', async () => {
  const { calls, limiter } = recording({ ok: false, retryAfterSecs: 10, remaining: 0 });
  const d = await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, hdrs({}), { limiter });
  assert.deepEqual(d, { allowed: true, retryAfterSecs: 0, reason: 'no_client_ip' });
  assert.equal(calls.length, 0);
});

// ── the identity ─────────────────────────────────────────────────────────────

test('the limiter identity never carries the raw IP', async () => {
  const { calls, limiter } = recording({ ok: true, retryAfterSecs: 0, remaining: 1 });
  for (const door of Object.values(VENUE_DOORS)) {
    await allowVenueDoorAttempt(door, 'evt-a', hdrs(IP), { limiter });
  }
  assert.equal(calls.length, 3);
  for (const c of calls) assert.ok(!String(c.ident).includes('203.0.113.7'), String(c.ident));
});

test('the claim doors key on the connection, never the token: a new token meets the same bucket', async () => {
  // allowVenueDoorAttempt has no token parameter at all — the claim call sites
  // pass `null` scope. Pin that the resulting identity depends only on door + IP.
  const { calls, limiter } = recording({ ok: true, retryAfterSecs: 0, remaining: 1 });
  await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, hdrs(IP), { limiter });
  await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, hdrs(IP), { limiter });
  assert.equal(calls[0]!.ident, calls[1]!.ident);
});

test('doors, events and connections each get their own bucket', () => {
  const ip = '198.51.100.1';
  const ids = new Set([
    venueDoorIdent(VENUE_DOORS.papicSeatClaim, null, ip),
    venueDoorIdent(VENUE_DOORS.panoodCameraClaim, null, ip),
    venueDoorIdent(VENUE_DOORS.guestPick, 'evt-a', ip),
    venueDoorIdent(VENUE_DOORS.guestPick, 'evt-b', ip),
    venueDoorIdent(VENUE_DOORS.guestPick, 'evt-a', '198.51.100.2'),
  ]);
  assert.equal(ids.size, 5);
});

test('the venue sizing IS the join door\'s — one number for "a room behind one IP"', () => {
  assert.equal(VENUE_DOOR_LIMIT, JOIN_DOOR_LIMIT);
  assert.equal(VENUE_DOOR_WINDOW_SECS, JOIN_DOOR_WINDOW_SECS);
});

// ── the wiring: behind the flag, before the mint, at all three doors ─────────

const WEB = join(__dirname, '..');
/** Comments stripped so a docblock mentioning a call can never satisfy the guard. */
const code = (src: string): string => stripComments(src);
function indices(src: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = src.indexOf(needle); i !== -1; i = src.indexOf(needle, i + 1)) out.push(i);
  return out;
}

const DOORS: Array<{ file: string; door: keyof typeof VENUE_DOORS; scope: string }> = [
  { file: 'app/papic/actions.ts', door: 'papicSeatClaim', scope: 'null' },
  { file: 'app/panood/actions.ts', door: 'panoodCameraClaim', scope: 'null' },
  { file: 'app/panood/guest-pick-actions.ts', door: 'guestPick', scope: 'clean' },
];

for (const d of DOORS) {
  test(`${d.file}: exactly one throttle, behind the flag, before its one anonymous mint`, () => {
    const src = code(readFileSync(join(WEB, d.file), 'utf8'));
    const mint = indices(src, 'signInAnonymously(');
    const call = indices(src, 'allowVenueDoorAttempt(');
    const flag = indices(src, 'venueDoorThrottleEnabled()');
    // Print the counts: a zero here must never be mistaken for a pass.
    console.log(`  ${d.file}: mints=${mint.length} throttles=${call.length} flag-reads=${flag.length}`);
    assert.equal(mint.length, 1, 'expected exactly one anonymous mint');
    assert.equal(call.length, 1, 'expected exactly one venue throttle');
    assert.equal(flag.length, 1, 'expected exactly one flag read');
    assert.ok(flag[0]! < call[0]!, 'the flag must be asked before the throttle runs');
    assert.ok(call[0]! < mint[0]!, 'the throttle must run BEFORE signInAnonymously');
    // …and it must be THIS door's bucket and scope, not a copy-pasted sibling's.
    const args = src.slice(call[0]!, src.indexOf(')', call[0]!));
    assert.match(args, new RegExp(`VENUE_DOORS\\.${d.door}\\s*,\\s*${d.scope}\\s*,`));
  });
}

test('the claim doors run the throttle BEFORE the admin token lookup', () => {
  for (const [file, lookup] of [
    ['app/papic/actions.ts', 'seatClaimability(token)'],
    ['app/panood/actions.ts', 'cameraClaimability(token)'],
  ] as const) {
    const src = code(readFileSync(join(WEB, file), 'utf8'));
    const call = indices(src, 'allowVenueDoorAttempt(');
    const look = indices(src, lookup);
    assert.equal(look.length, 1, `${file}: ${lookup} count`);
    assert.ok(call[0]! < look[0]!, `${file}: throttle must precede ${lookup}`);
  }
});

test('both claim pages render the throttled state (an unknown ?state= renders NOTHING)', () => {
  for (const file of ['app/papic/claim/[token]/page.tsx', 'app/panood/cam/[token]/page.tsx']) {
    const src = code(readFileSync(join(WEB, file), 'utf8'));
    assert.equal(indices(src, 'state === VENUE_DOOR_STATE').length, 1, `${file}: state check`);
    assert.equal(indices(src, '{VENUE_DOOR_THROTTLED_MESSAGE}').length, 1, `${file}: message mount`);
  }
  assert.equal(VENUE_DOOR_STATE, 'throttled');
});
