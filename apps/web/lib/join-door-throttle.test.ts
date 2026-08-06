/**
 * Unit suite for the guest-list self-join door throttle.
 *
 * The load-bearing invariants: the bucket is keyed per-event AND per-connection
 * (one wedding can never spend another's budget, one connection can never spend
 * the room's), a raw IP never reaches the limiter identity, and an unreadable
 * limiter FAILS CLOSED — a door that mints an identity behind a ceiling shared
 * by every guest must not open just because we could not get a decision.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rateLimit } from '@/lib/rate-limit';
import {
  allowGuestSelfJoinAttempt,
  guestSelfJoinDoorIsThrottled,
  joinDoorIdent,
  joinDoorL1Key,
  readJoinDoorIp,
  JOIN_DOOR_BUCKET,
  JOIN_DOOR_LIMIT,
  JOIN_DOOR_WINDOW_SECS,
} from '@/lib/join-door-throttle';

const okLimiter = async () => ({ ok: true, retryAfterSecs: 0, remaining: 1 });
const denyLimiter = async () => ({ ok: false, retryAfterSecs: 47, remaining: 0 });

function hdrs(init: Record<string, string>): Headers {
  return new Headers(init);
}

// ── readJoinDoorIp — prefer the header the caller CANNOT write ──────────────

test('readJoinDoorIp: platform headers outrank the client-writable one', () => {
  // A caller who forges x-forwarded-for to rotate buckets must not win.
  assert.equal(
    readJoinDoorIp(hdrs({ 'x-forwarded-for': '1.1.1.1', 'x-vercel-forwarded-for': '9.9.9.9' })),
    '9.9.9.9',
  );
  assert.equal(
    readJoinDoorIp(hdrs({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '8.8.8.8' })),
    '8.8.8.8',
  );
  // XFF is still used when nothing better exists — better weak than nothing.
  assert.equal(readJoinDoorIp(hdrs({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1' })), '1.1.1.1');
  assert.equal(readJoinDoorIp(hdrs({})), null);
  assert.equal(readJoinDoorIp(hdrs({ 'x-forwarded-for': '   ' })), null);
});

// ── joinDoorIdent — per event AND per IP, and never the raw address ─────────

test('joinDoorIdent: same connection, different events → different buckets', () => {
  assert.notEqual(joinDoorIdent('evt-a', '1.2.3.4'), joinDoorIdent('evt-b', '1.2.3.4'));
});

test('joinDoorIdent: same event, different connections → different buckets', () => {
  assert.notEqual(joinDoorIdent('evt-a', '1.2.3.4'), joinDoorIdent('evt-a', '5.6.7.8'));
});

test('joinDoorIdent: stable for the same pair (a throttle that never accumulates is not a throttle)', () => {
  assert.equal(joinDoorIdent('evt-a', '1.2.3.4'), joinDoorIdent('evt-a', '1.2.3.4'));
});

test('joinDoorIdent: the raw IP never appears — only a digest reaches rate_limit_hits', () => {
  const ident = joinDoorIdent('evt-a', '203.0.113.77');
  assert.ok(!ident.includes('203.0.113.77'));
  assert.equal(ident.startsWith('evt-a:'), true);
});

// ── the consuming check ────────────────────────────────────────────────────

test('allowGuestSelfJoinAttempt: allows while the limiter says there is budget', async () => {
  const d = await allowGuestSelfJoinAttempt('evt-a', hdrs({ 'x-real-ip': '1.2.3.4' }), {
    limiter: okLimiter,
  });
  assert.deepEqual(d, { allowed: true, retryAfterSecs: 0, reason: 'ok' });
});

test('allowGuestSelfJoinAttempt: denies with the limiter’s retry hint once spent', async () => {
  const d = await allowGuestSelfJoinAttempt('evt-a', hdrs({ 'x-real-ip': '1.2.3.4' }), {
    limiter: denyLimiter,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'throttled');
  assert.equal(d.retryAfterSecs, 47);
});

test('allowGuestSelfJoinAttempt: passes the event+IP ident and this bucket to the limiter', async () => {
  const seen: Array<[string, string | null, { limit: number; windowSecs: number }]> = [];
  await allowGuestSelfJoinAttempt('evt-x', hdrs({ 'x-real-ip': '1.2.3.4' }), {
    limiter: async (bucket, ident, opts) => {
      seen.push([bucket, ident, opts]);
      return { ok: true, retryAfterSecs: 0, remaining: 1 };
    },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]![0], JOIN_DOOR_BUCKET);
  assert.equal(seen[0]![1], joinDoorIdent('evt-x', '1.2.3.4'));
  assert.deepEqual(seen[0]![2], { limit: JOIN_DOOR_LIMIT, windowSecs: JOIN_DOOR_WINDOW_SECS });
});

// ── fail CLOSED — the branch this whole module exists to get right ──────────

test('allowGuestSelfJoinAttempt: FAILS CLOSED when the limiter throws', async () => {
  const d = await allowGuestSelfJoinAttempt('evt-a', hdrs({ 'x-real-ip': '1.2.3.4' }), {
    limiter: async () => {
      throw new Error('limiter down');
    },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'limiter_unavailable');
  assert.equal(d.retryAfterSecs, JOIN_DOOR_WINDOW_SECS);
});

test('allowGuestSelfJoinAttempt: FAILS CLOSED on a result it cannot read', async () => {
  // A truthy object with no boolean `ok` is the realistic shape drift: it would
  // read as "not denied" under a naive `if (!res.ok)` and silently open the door.
  for (const bad of [undefined, null, 'ok', 42, {}, { ok: 'yes' }, { allowed: true }]) {
    const d = await allowGuestSelfJoinAttempt('evt-a', hdrs({ 'x-real-ip': '1.2.3.4' }), {
      limiter: async () => bad as never,
    });
    assert.equal(d.allowed, false, `expected fail-closed for ${JSON.stringify(bad)}`);
    assert.equal(d.reason, 'limiter_unavailable');
  }
});

// ── the ONE documented fail-open ────────────────────────────────────────────

test('allowGuestSelfJoinAttempt: fails OPEN with no client IP, without consuming budget', async () => {
  let called = 0;
  const d = await allowGuestSelfJoinAttempt('evt-a', hdrs({}), {
    limiter: async () => {
      called += 1;
      return { ok: false, retryAfterSecs: 1, remaining: 0 };
    },
  });
  // Every IP-less caller would share one bucket, so throttling it would let one
  // script lock out all of them — the outage this module prevents.
  assert.equal(d.allowed, true);
  assert.equal(d.reason, 'no_client_ip');
  assert.equal(called, 0);
});

// ── the read-only peek used by the join page ───────────────────────────────

test('guestSelfJoinDoorIsThrottled: false until the L1 budget is spent, then true', () => {
  const eventId = `evt-peek-${Math.random().toString(36).slice(2)}`;
  const h = hdrs({ 'x-real-ip': '1.2.3.4' });
  const key = joinDoorL1Key(joinDoorIdent(eventId, '1.2.3.4'));

  assert.equal(guestSelfJoinDoorIsThrottled(eventId, h), false);
  for (let i = 0; i < JOIN_DOOR_LIMIT; i += 1) {
    rateLimit(key, JOIN_DOOR_LIMIT, JOIN_DOOR_WINDOW_SECS * 1000);
  }
  assert.equal(guestSelfJoinDoorIsThrottled(eventId, h), true);
});

test('guestSelfJoinDoorIsThrottled: peeking never spends the guest’s own budget', () => {
  const eventId = `evt-nospend-${Math.random().toString(36).slice(2)}`;
  const h = hdrs({ 'x-real-ip': '1.2.3.4' });
  // A guest reloading the join page 200× must still be able to submit.
  for (let i = 0; i < 200; i += 1) assert.equal(guestSelfJoinDoorIsThrottled(eventId, h), false);
  const key = joinDoorL1Key(joinDoorIdent(eventId, '1.2.3.4'));
  assert.equal(rateLimit(key, JOIN_DOOR_LIMIT, JOIN_DOOR_WINDOW_SECS * 1000).remaining,
    JOIN_DOOR_LIMIT - 1);
});

test('guestSelfJoinDoorIsThrottled: an exhausted connection does not throttle another event', () => {
  const spent = `evt-spent-${Math.random().toString(36).slice(2)}`;
  const other = `evt-other-${Math.random().toString(36).slice(2)}`;
  const h = hdrs({ 'x-real-ip': '1.2.3.4' });
  for (let i = 0; i < JOIN_DOOR_LIMIT; i += 1) {
    rateLimit(joinDoorL1Key(joinDoorIdent(spent, '1.2.3.4')), JOIN_DOOR_LIMIT, 60_000);
  }
  assert.equal(guestSelfJoinDoorIsThrottled(spent, h), true);
  assert.equal(guestSelfJoinDoorIsThrottled(other, h), false);
});

// ── derived guard: the peek key must match what enforceRateLimit builds ────

test('joinDoorL1Key still matches how with-rate-limit composes its L1 key', () => {
  // Two hand-typed formats drift together and CI stays green, so read the real
  // source instead of restating it. If enforceRateLimit stops composing
  // `${bucket}:${key}`, the page's peek would silently read an empty bucket and
  // never warn anyone — this goes red the day that happens.
  const src = readFileSync(join(import.meta.dirname, 'with-rate-limit.ts'), 'utf8');
  assert.match(
    src,
    /rateLimit\(\s*`\$\{bucket\}:\$\{key\}`/,
    'with-rate-limit.ts no longer builds its L1 key as `${bucket}:${key}` — update joinDoorL1Key',
  );
  assert.equal(joinDoorL1Key('ident-1'), `${JOIN_DOOR_BUCKET}:ident-1`);
});

// ── derived guard: the ceiling this throttle protects still exists ─────────

test('the shared per-event self-join ceiling still exists (this throttle protects it)', () => {
  // If SELF_JOIN_CEILING is ever removed or made per-caller, the "one script
  // closes the door for everyone" risk changes shape and this module's sizing
  // needs rethinking. Read the action, do not restate its number.
  const src = readFileSync(
    join(import.meta.dirname, '..', 'app', 'join', '[eventId]', 'actions.ts'),
    'utf8',
  );
  assert.match(src, /const SELF_JOIN_CEILING = \d+/);
  assert.match(src, /error=join_closed/);
});
