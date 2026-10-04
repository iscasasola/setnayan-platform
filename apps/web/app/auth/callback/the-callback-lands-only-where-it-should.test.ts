/**
 * /auth/callback LANDS ONLY WHERE IT SHOULD — and the phone app's `?native=1`
 * landing writes only behind the marker the app's own Apple sheet minted.
 *
 * FOUND by the independent audit of train #6333 (2026-10-04):
 *   1. With NO `code`, this route still redirects to `?next=` — so the old
 *      prefix-only `safeNext` (`/\evil.com`, `/<TAB>/evil.com` slipped through)
 *      made it an open redirect with no sign-in at all.
 *   2. Within five minutes of a sign-in, a crafted
 *      `/auth/callback?native=1&as=vendor` ran the landing's writes — the
 *      vendor promotion and the RSVP terms stamp — for a brand-new customer.
 *
 * This file runs the REAL route handler (GET) against stub Supabase clients
 * that record every write, and reads the Location it answers.
 *
 * SABOTAGES (each run, each red, each restored — see the PR):
 *   · route.ts: drop the `nativeMarkerMatches(…)` gate             → test 3 RED
 *   · route.ts: `spend` no longer clears the cookie                 → test 5 RED
 *   · safe-next.ts: back to "starts with / and not //"              → test 1 RED
 *   · native-oauth.ts: assign the landing without the marker        → test 6 RED
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';

// ── stubs: server-only, the two Supabase clients, the last-login stamp ────────

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const WEB = process.cwd();

function stubModule(filename: string, exports: unknown): void {
  const m = new CjsModule(filename);
  m.filename = filename;
  m.loaded = true;
  m.exports = exports;
  m.paths = [];
  CjsModule._cache[filename] = m;
}

const SERVER_ONLY_STUB = join(WEB, '__server_only_stub_auth_callback__.js');
stubModule(SERVER_ONLY_STUB, {});
{
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return SERVER_ONLY_STUB;
    return original.call(this, request, ...rest);
  };
}

/** Every write the route attempts, in order. */
const writes: string[] = [];
type FakeUser = { id: string; created_at: string; last_sign_in_at: string };
let currentUser: FakeUser | null = null;

function chain(table: string): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => ({ data: { account_type: 'customer' }, error: null });
      }
      return (..._args: unknown[]) => {
        if (prop === 'update' || prop === 'insert' || prop === 'upsert' || prop === 'delete') {
          writes.push(`${table}.${String(prop)}`);
        }
        return proxy;
      };
    },
  };
  const proxy: object = new Proxy({}, handler);
  return proxy;
}

function fakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      exchangeCodeForSession: async () => ({ data: { user: currentUser }, error: null }),
    },
    from: (table: string) => chain(table),
    rpc: async (fn: string) => {
      writes.push(`rpc.${fn}`);
      return { data: null, error: null };
    },
  };
}

stubModule(join(WEB, 'lib/supabase/server.ts'), { createClient: async () => fakeClient() });
stubModule(join(WEB, 'lib/supabase/admin.ts'), { createAdminClient: () => fakeClient() });
stubModule(join(WEB, 'lib/login-activity.ts'), {
  stampLastLogin: async () => {
    writes.push('stampLastLogin');
  },
});

// ── helpers ─────────────────────────────────────────────────────────────────

const ORIGIN = 'https://www.setnayan.com';
const MARKER = 'a'.repeat(64);

async function hit(query: string, cookies: Record<string, string> = {}) {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('./route');
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const req = new NextRequest(`${ORIGIN}/auth/callback${query}`, {
    headers: cookie ? { cookie } : {},
  });
  const res = await GET(req);
  return { res, location: res.headers.get('location') ?? '' };
}

function freshNewCustomer(): FakeUser {
  const now = new Date().toISOString();
  return { id: 'u-new', created_at: now, last_sign_in_at: now };
}

// ── 1 · a bad `next` with no code lands on the default ──────────────────────

test('1 · a hostile `next` with NO code lands on our own default, never off-site', async () => {
  const { signInDestination } = await import('@/lib/sign-in-landing');
  const expected = new URL(signInDestination('/'), ORIGIN).toString();
  for (const bad of [
    '/\\evil.com',
    '/\t/evil.com',
    '//evil.com',
    '/%5cevil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/%0d%0aLocation:%20https://evil.com',
  ]) {
    writes.length = 0;
    currentUser = null;
    const { res, location } = await hit(`?next=${encodeURIComponent(bad)}`);
    assert.ok(res.status >= 300 && res.status < 400, `${JSON.stringify(bad)}: not a redirect`);
    assert.equal(location, expected, `${JSON.stringify(bad)} landed on ${location}`);
    assert.equal(new URL(location).origin, ORIGIN);
    assert.deepEqual(writes, [], `${JSON.stringify(bad)}: a write with no sign-in`);
  }
});

test('1 · a good `next` with no code passes through verbatim', async () => {
  currentUser = null;
  const { location } = await hit(`?next=${encodeURIComponent('/dashboard/x?tab=y#z')}`);
  assert.equal(location, `${ORIGIN}/dashboard/x?tab=y#z`);
});

// ── 2/3 · ?native=1 without the marker writes nothing ────────────────────────

const NATIVE_CRAFTED = `?native=1&as=vendor&next=${encodeURIComponent('/join/S89E-ABC/connect')}`;

test('3 · a crafted `?native=1&as=vendor` with NO marker writes nothing — even right after a sign-in', async () => {
  const { RSVP_TERMS_COOKIE, TERMS_VERSION } = await import('@/lib/terms-agreement');
  writes.length = 0;
  currentUser = freshNewCustomer(); // the worst case: a brand-new customer, signed in seconds ago
  const { location } = await hit(NATIVE_CRAFTED, { [RSVP_TERMS_COOKIE]: TERMS_VERSION });
  assert.deepEqual(writes, [], 'the landing wrote without the marker (promotion / terms / last-login)');
  assert.equal(location, `${ORIGIN}/join/S89E-ABC/connect`, 'it should only redirect to safeNext(next)');
});

test('3 · a WRONG marker (cookie and URL disagree, or a malformed one) writes nothing', async () => {
  const { NATIVE_LANDING_COOKIE } = await import('@/lib/native-oauth-plan');
  for (const [held, presented] of [
    [MARKER, 'b'.repeat(64)],
    ['', MARKER],
    [MARKER, ''],
    ['not-hex', 'not-hex'],
  ]) {
    writes.length = 0;
    currentUser = freshNewCustomer();
    const cookies: Record<string, string> = held ? { [NATIVE_LANDING_COOKIE]: held } : {};
    await hit(`${NATIVE_CRAFTED}&native_marker=${presented}`, cookies);
    assert.deepEqual(writes, [], `held=${held} presented=${presented}: the landing ran`);
  }
});

// ── 4 · the positive control: the app's own marker DOES run the landing ──────

test('4 · with the matching marker the landing runs (so the "nothing" above is a real nothing)', async () => {
  const { NATIVE_LANDING_COOKIE } = await import('@/lib/native-oauth-plan');
  writes.length = 0;
  currentUser = freshNewCustomer();
  await hit(`${NATIVE_CRAFTED}&native_marker=${MARKER}`, { [NATIVE_LANDING_COOKIE]: MARKER });
  assert.ok(writes.includes('stampLastLogin'), `no last-login stamp: ${writes.join(', ')}`);
  assert.ok(writes.includes('users.update'), `no vendor promotion: ${writes.join(', ')}`);
});

test('4 · a matching marker on a STALE sign-in still writes nothing', async () => {
  const { NATIVE_LANDING_COOKIE } = await import('@/lib/native-oauth-plan');
  writes.length = 0;
  const old = new Date(Date.now() - 60 * 60_000).toISOString();
  currentUser = { id: 'u-old', created_at: old, last_sign_in_at: old };
  await hit(`${NATIVE_CRAFTED}&native_marker=${MARKER}`, { [NATIVE_LANDING_COOKIE]: MARKER });
  assert.deepEqual(writes, []);
});

// ── 5 · the marker is spent on every native visit ────────────────────────────

test('5 · every native visit clears the marker cookie — matched or not — so it is spent once', async () => {
  const { NATIVE_LANDING_COOKIE } = await import('@/lib/native-oauth-plan');
  for (const presented of [MARKER, 'b'.repeat(64)]) {
    currentUser = freshNewCustomer();
    const { res } = await hit(`${NATIVE_CRAFTED}&native_marker=${presented}`, {
      [NATIVE_LANDING_COOKIE]: MARKER,
    });
    const cleared = res.cookies.get(NATIVE_LANDING_COOKIE);
    assert.ok(cleared, `presented=${presented}: the marker cookie was left in the jar`);
    assert.equal(cleared!.value, '');
    assert.equal(cleared!.maxAge, 0);
    assert.equal(cleared!.path, '/auth/callback');
  }
});

// ── 6 · the app's sheet mints the marker and carries it ──────────────────────

test('6 · the Apple sheet mints the marker AFTER the sign-in and puts it on the landing URL', async () => {
  const { nativeSessionLandingPath, NATIVE_MARKER_PARAM, nativeMarkerMatches } = await import(
    '@/lib/native-oauth-plan'
  );
  assert.equal(
    nativeSessionLandingPath('/maria-and-jose', 'customer', MARKER),
    `/auth/callback?next=%2Fmaria-and-jose&native=1&${NATIVE_MARKER_PARAM}=${MARKER}`,
  );
  assert.equal(nativeMarkerMatches(MARKER, MARKER), true);
  assert.equal(nativeMarkerMatches(MARKER, MARKER.toUpperCase()), false);
  assert.equal(nativeMarkerMatches(undefined, MARKER), false);

  const src = stripComments(readFileSync(join(WEB, 'lib/native-oauth.ts'), 'utf8'));
  const signIn = src.indexOf('signInWithIdToken(');
  const mint = src.indexOf('issueNativeLandingMarker()');
  const land = src.indexOf('nativeSessionLandingPath(next, accountType, marker)');
  assert.ok(signIn > -1 && mint > signIn && land > mint, 'the marker is not minted after the sign-in and carried to the landing');

  const action = stripComments(readFileSync(join(WEB, 'app/auth/native-marker-action.ts'), 'utf8'));
  assert.match(action, /^'use server';/, 'the minter must be a server action (same-origin POST only)');
  assert.match(action, /httpOnly: true/);
  assert.match(action, /path: '\/auth\/callback'/);
  assert.match(action, /randomBytes\(32\)/);
});
