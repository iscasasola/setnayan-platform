/**
 * guest-session-recent-yes.test.ts — A RECENT "YES" TO THE SESSION CHECK IS
 * REMEMBERED FOR ≤ 30 s, ON ONE INSTANCE, IN A RENDER ONLY — AND NOTHING ELSE
 * IS (event-day load L3, 2026-10-18 · `lib/guest-session.ts` `RECENT_YES_MS`).
 *
 * Every guest page paid one `guests` read for the session check. Inside a
 * render, a token this instance found current moments ago is taken as current:
 *   1 · a second render within the window sends nothing;
 *   2 · OUTSIDE a render (a server action — every write a guest makes) the
 *       database is asked every time;
 *   3 · a MISMATCH (a rotated QR) and a missing row are never remembered — the
 *       revocation is seen on the next check;
 *   4 · a lookup that FAILED (the fail-open answer) is never remembered;
 *   5 · the window ends: after `RECENT_YES_MS` the database is asked again;
 *   6 · a different token is a different key — and the token is not kept.
 * Executed against a counting stand-in for the database, never grepped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789abcdef';

const { guestSessionTokenStillCurrent, forgetRecentGuestSessionChecksForTest, RECENT_YES_MS } =
  require('./guest-session') as typeof import('./guest-session');
const { withRenderScopeForTest } = require('./request-once') as typeof import('./request-once');

const GUEST = '00000000-0000-4000-8000-0000000000a1';
const TOKEN = 'qr_tok_current_aaaaaaaaaaaaaaaa';
const ROTATED = 'qr_tok_rotated_bbbbbbbbbbbbbbbb';

let dbToken: string | null = TOKEN;
let refuse = false;
let reads = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes('/rest/v1/guests?')) return realFetch(input as RequestInfo);
  reads += 1;
  // A refusal the client does not retry (a 503 is retried, and would only slow this file down).
  if (refuse) return new Response('{"code":"42501","message":"permission denied for table guests"}', { status: 401 });
  const body = dbToken === null ? '[]' : JSON.stringify([{ qr_token: dbToken }]);
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const inRender = (token = TOKEN) => withRenderScopeForTest(() => guestSessionTokenStillCurrent(GUEST, token));
const fresh = () => {
  forgetRecentGuestSessionChecksForTest();
  dbToken = TOKEN;
  refuse = false;
  reads = 0;
};

test('1 · a second render within the window asks nothing', async () => {
  fresh();
  assert.equal(await inRender(), true);
  assert.equal(await inRender(), true);
  assert.equal(await inRender(), true);
  assert.equal(reads, 1, 'every render asked the database again');
});

test('2 · outside a render — a server action — the database is asked every time', async () => {
  fresh();
  assert.equal(await inRender(), true); // remembered…
  assert.equal(await guestSessionTokenStillCurrent(GUEST, TOKEN), true);
  assert.equal(await guestSessionTokenStillCurrent(GUEST, TOKEN), true);
  assert.equal(reads, 3, 'an action was answered from memory — a revoked guest could still write');
});

test('3 · a rotated QR is never remembered — the old session is refused on every check', async () => {
  fresh();
  dbToken = ROTATED;
  assert.equal(await inRender(), false);
  assert.equal(await inRender(), false);
  assert.equal(reads, 2, 'a refusal was remembered');
  dbToken = null; // the guest was removed
  assert.equal(await inRender(), false);
  assert.equal(reads, 3);
});

test('4 · a lookup that failed answers open and is never remembered', async () => {
  fresh();
  refuse = true;
  assert.equal(await inRender(), true, 'a blip signed the guest out');
  const afterFirst = reads;
  assert.ok(afterFirst >= 1);
  assert.equal(await inRender(), true);
  assert.ok(reads > afterFirst, 'the fail-open answer was remembered as a real yes');
  // …and once it answers, a rotation it would have hidden is seen at once.
  refuse = false;
  dbToken = ROTATED;
  assert.equal(await inRender(), false);
});

test(`5 · the window is ${RECENT_YES_MS / 1000} s — after it the database is asked again, and a rotation is seen`, async () => {
  fresh();
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    assert.equal(await inRender(), true);
    dbToken = ROTATED; // rotated — this instance still remembers the yes…
    now += RECENT_YES_MS - 1;
    assert.equal(await inRender(), true, 'the window is shorter than it says');
    assert.equal(reads, 1);
    now += 2; // …until the window ends
    assert.equal(await inRender(), false, 'a rotation outlived the stated window');
    assert.equal(reads, 2);
  } finally {
    Date.now = realNow;
  }
  assert.ok(RECENT_YES_MS <= 30_000, 'the window was widened past the 30 s the owner was told');
});

test('6 · a different token is a different key — the rotated token is asked about, not handed the old yes', async () => {
  fresh();
  assert.equal(await inRender(TOKEN), true);
  dbToken = ROTATED;
  assert.equal(await inRender(ROTATED), true);
  assert.equal(reads, 2, 'the new token was answered from the old token’s memory');
  assert.equal(await inRender(ROTATED), true);
  assert.equal(reads, 2);
});
