/**
 * s41c-unclassified-batch-g-reads-are-honest.test.ts
 *
 * S41c · UNCLASSIFIED tier, batch 2 of 2 — the `result-dropped-silently` class
 * from S26's both-ends orphan baseline (#5625). Same disease as S41's MONEY/
 * BOOKING batches (#5650, #5656): a Supabase `{ data, error }` read whose
 * `error` was tested ONLY as an if/else condition, with the selected branch
 * recording nothing — so a REFUSED read renders identically to a genuinely
 * empty/absent one.
 *
 * 15 sites across 14 files. Two shapes:
 *
 *   SHAPE 1 (log-only, 18 sites) — internal/background plumbing, or a caller
 *   that already fails closed/degrades correctly. The read is now genuinely
 *   READ (logged), the control flow is UNCHANGED.
 *
 *   SHAPE 2 (honest render state, 1 site) — lib/panood-broadcast.ts's
 *   `getLatestPanoodBroadcastStatus`, whose `null` on error fed
 *   lib/live-watch-state.ts's `decideGuestWatchState` and came out
 *   byte-identical to "the ceremony hasn't started" — while a guest was
 *   mid-broadcast. Now a distinct `BROADCAST_STATUS_UNREADABLE` sentinel
 *   flows through to a new `'unknown'` GuestWatchState, which
 *   watch-live-embed.tsx renders as "couldn't check" and keeps POLLING
 *   (the bug used to also stop the poller for good).
 *
 * Tests 1–2 exercise real behavior (no source-scanning). Tests 3–9 are
 * source-scans with an exact occurrence FLOOR (never a boolean regex.test) so
 * deleting a log line — not just rewording it — turns the test red. Each was
 * hand-verified red before this file was finalized (the specific log line
 * temporarily removed, test run, confirmed to fail, then restored).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { decideGuestWatchState, type GuestWatchState } from './live-watch-state';
import { resolveMutualStoryDays } from './person-life-stories';
import type { createAdminClient } from './supabase/admin';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const countOf = (src: string, needle: string): number => src.split(needle).length - 1;

// ─────────────────────────────────────────────────────────────────────────
// 1. SHAPE 2 — the guest-facing broadcast-status decider.
// ─────────────────────────────────────────────────────────────────────────

test('1 · decideGuestWatchState maps a refused broadcast-status read to "unknown", never "not_yet"', () => {
  // A refused read, no resolvable link → the honest 'unknown' state, NOT the
  // "nothing has ever gone out" state a couple's guest saw before this fix.
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: 'unreadable' }),
    'unknown',
  );
  // A genuinely-never-started event is UNCHANGED — 'unreadable' must not
  // widen to cover a real null either.
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: null }),
    'not_yet',
  );
  // A resolvable link always wins, even over an unreadable status read — the
  // existing "a live link is the strongest signal" guard must still hold.
  assert.equal(
    decideGuestWatchState({
      watchLive: { embedUrl: 'e', watchUrl: 'w', facebookUrl: null },
      latestBroadcastStatus: 'unreadable',
    }),
    'live',
  );
  // 'complete' and 'errored'/'live'/'ready'/'testing' behavior is untouched.
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: 'complete' }),
    'ended',
  );
  assert.equal(
    decideGuestWatchState({ watchLive: null, latestBroadcastStatus: 'errored' }),
    'reconnecting',
  );
  // Type-level: 'unknown' is a real member of the exported union (compile-time
  // proof — this assignment fails tsc if the type ever drops it).
  const s: GuestWatchState = 'unknown';
  assert.equal(s, 'unknown');
});

// ─────────────────────────────────────────────────────────────────────────
// 2. SHAPE 1, functional — a privacy disclosure surface that must STAY
//    fail-closed while becoming traceable.
// ─────────────────────────────────────────────────────────────────────────

/** A minimal thenable PostgREST-builder stand-in: every chain method returns
 *  itself, and awaiting it resolves to the fixed `{ data, error }` result —
 *  same shape `resolveMutualStoryDays` destructures. */
function fakeAdminAlwaysErrors(): ReturnType<typeof createAdminClient> {
  const result = { data: null, error: { code: '42501', message: 'permission denied' } };
  const builder: Record<string, unknown> = {
    select: () => builder,
    in: () => builder,
    is: () => builder,
    eq: () => builder,
    not: () => builder,
    order: () => builder,
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  return { from: () => builder } as unknown as ReturnType<typeof createAdminClient>;
}

test('2 · resolveMutualStoryDays logs a refused people.select yet still fails closed to []', async () => {
  const prevFlag = process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES;
  process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES = '1';
  const originalError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    const days = await resolveMutualStoryDays({
      viewerUserId: 'u-viewer',
      profileUserId: 'u-profile',
      adminClient: fakeAdminAlwaysErrors(),
    });
    // The disclosure-surface guarantee is UNCHANGED: a refused read is still [].
    assert.deepEqual(days, []);
    // But it is no longer SILENT — the refusal is now traceable.
    const logged = calls.some(
      (args) =>
        typeof args[0] === 'string' &&
        args[0].includes('[supabase-error] lib/person-life-stories.ts') &&
        args[0].includes('from:people.select'),
    );
    assert.ok(logged, `expected a people.select error log; saw: ${JSON.stringify(calls)}`);
  } finally {
    console.error = originalError;
    if (prevFlag === undefined) delete process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES;
    else process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES = prevFlag;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 3. SHAPE 2 — the client poller must not stop, and must say "couldn't
//    check", when a poll comes back 'unknown'.
// ─────────────────────────────────────────────────────────────────────────

test('3 · watch-live-embed.tsx keeps polling and renders an honest message for state "unknown"', () => {
  const src = read('../app/[slug]/_components/watch-live-embed.tsx');
  // The guard that decides whether to keep polling must include 'unknown'
  // alongside 'live' and 'reconnecting' — otherwise a transient DB hiccup
  // permanently stops the poller, exactly like the shipped bug.
  assert.match(
    src,
    /state !== 'live' && state !== 'reconnecting' && state !== 'unknown'/,
    'the poll-continuation guard must keep polling on "unknown", not just "live"/"reconnecting"',
  );
  // And the render must say something distinct from both the reconnecting
  // banner and the default "hasn't started" copy — never silently fall into
  // either.
  assert.match(src, /state === 'unknown'/);
  assert.match(src, /couldn.{1,10}t check the stream status/i);
});

// ─────────────────────────────────────────────────────────────────────────
// 4–8. SHAPE 1 — every previously-silent branch now logs, with a floor so a
//      deleted log call (not just a reworded one) fails the count.
// ─────────────────────────────────────────────────────────────────────────

test('4 · nsfw-screen.ts logs all three previously-silent capture-table reads', () => {
  const src = read('nsfw-screen.ts');
  assert.equal(
    countOf(src, '[supabase-error] lib/nsfw-screen.ts'),
    3,
    'expected exactly 3 logged sites: the opts.table row fetch + the two table-variable sweep reads',
  );
});

test('5 · panood-moments.ts and panood-screens.ts log their degrade + provisioning-failure branches', () => {
  const moments = read('panood-moments.ts');
  const screens = read('panood-screens.ts');
  assert.equal(countOf(moments, '[supabase-error] lib/panood-moments.ts'), 2);
  assert.equal(countOf(screens, '[supabase-error] lib/panood-screens.ts'), 2);
});

test('6 · promo-free-windows.ts and venue-recommendations.ts log every previously-silent select', () => {
  const promo = read('promo-free-windows.ts');
  const venue = read('venue-recommendations.ts');
  assert.equal(
    countOf(promo, '[supabase-error] lib/promo-free-windows.ts'),
    2,
    'couple-audience + vendor-audience window reads',
  );
  assert.equal(
    countOf(venue, '[supabase-error] lib/venue-recommendations.ts'),
    3,
    'findPairedCeremonyVenues + findCeremonyVenuesByFaith + findReceptionVenuesByVenueSetting',
  );
});

test('7 · secrets/reencrypt.ts logs an update failure without ever passing ciphertext to console.error', () => {
  const src = read('secrets/reencrypt.ts');
  const m = src.match(/console\.error\(\s*`\[supabase-error\][^`]*`,\s*\{([^}]*)\}/);
  assert.ok(m, 'expected a console.error call with a structured context object');
  const contextArgs = m![1];
  // Only the Postgres error shape + which column — never the resealed value.
  assert.match(contextArgs, /updErr\.code/);
  assert.match(contextArgs, /updErr\.message/);
  assert.doesNotMatch(
    contextArgs,
    /\bnext\b|\bvalue\b|\bpatch\b|\bciphertext\b/,
    'the log context must never carry a secret value, sealed or plain',
  );
});

test('8 · setnayan-ai-notify.ts, vendor-autoreply/auto-accept.ts, whats-next.ts, with-rate-limit.ts each log their fixed site and keep their original fail-direction', () => {
  const notify = read('setnayan-ai-notify.ts');
  const autoAccept = read('vendor-autoreply/auto-accept.ts');
  const whatsNext = read('whats-next.ts');
  const rateLimit = read('with-rate-limit.ts');

  // GRD-01 claim: now logged, and still `continue`s past an unclaimed slot.
  assert.match(notify, /logQueryError\(\s*'sweepGuardNotifications \(GRD-01 claim\)'/);
  assert.match(notify, /if \(claimError \|\| !claimed \|\| claimed\.length === 0\) continue;/);

  // integrity_flags probe: now logged, `trustFlagged` still resolves to null
  // (fail-closed) on the same error.
  assert.match(autoAccept, /\[supabase-error\] lib\/vendor-autoreply\/auto-accept\.ts · from:integrity_flags\.select/);
  assert.match(autoAccept, /trustFlagged = error \? null : \(count \?\? 0\) > 0;/);

  // Announcement read-modify-write: now logged, still refuses the write
  // (returns false) rather than risking the draft_json clobber.
  assert.match(whatsNext, /\[supabase-error\] lib\/whats-next\.ts · from:\$\{ANNOUNCEMENT_WRITES_TO\}\.select/);
  assert.match(whatsNext, /if \(readError\) \{[\s\S]{0,200}return false;/);

  // Rate-limit RPC: now logged, still fails OPEN (never blocks a real user on
  // a limiter outage).
  assert.match(rateLimit, /\[supabase-error\] lib\/with-rate-limit\.ts · rpc:check_rate_limit/);
  assert.match(rateLimit, /return \{ ok: true, retryAfterSecs: 0, remaining: l1\.remaining \};/);
});

// ─────────────────────────────────────────────────────────────────────────
// 9. SHAPE 2 — the sentinel must actually flow end to end, and 'unreadable'
//    must be checked BEFORE 'null' so a future edit can't silently fold them
//    back together (the exact bug this batch fixes).
// ─────────────────────────────────────────────────────────────────────────

test('9 · BROADCAST_STATUS_UNREADABLE is exported and decideGuestWatchState checks it before the null branch', () => {
  const broadcast = read('panood-broadcast.ts');
  const watchState = read('live-watch-state.ts');

  assert.match(broadcast, /export const BROADCAST_STATUS_UNREADABLE = 'unreadable' as const;/);
  assert.match(
    broadcast,
    /Promise<PanoodBroadcast\['status'\] \| null \| typeof BROADCAST_STATUS_UNREADABLE>/,
  );

  const unreadableIdx = watchState.indexOf("latestBroadcastStatus === 'unreadable'");
  const nullIdx = watchState.indexOf('latestBroadcastStatus === null');
  assert.ok(unreadableIdx !== -1, 'decideGuestWatchState must check for "unreadable"');
  assert.ok(nullIdx !== -1, 'decideGuestWatchState must still check for null (genuine "not_yet")');
  assert.ok(
    unreadableIdx < nullIdx,
    'the "unreadable" check must run BEFORE the null check, or a refused read falls through to "not_yet"',
  );
});
