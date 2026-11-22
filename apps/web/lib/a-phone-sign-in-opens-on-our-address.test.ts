/**
 * 🏷 THE PHONE APP'S GOOGLE SIGN-IN OPENS ON OUR ADDRESS — AND /auth/go CAN ONLY EVER GO TO OUR SUPABASE AUTHORIZE.
 *
 * Owner screenshot, iPhone app, 22 Nov 2026: the sheet read "Setnayan" Wants to Use
 * "njrupjnvkjkitfctetvi.supabase.co" to Sign In. iOS names the host of the first URL; the app handed it the
 * Supabase authorize URL. It now hands `www.setnayan.com/auth/go?…`, which 302s on (lib/oauth-front-door.ts).
 *
 * Held here:
 *   1. the only host /auth/go will name is `https://<ref>.supabase.co` from NEXT_PUBLIC_SUPABASE_URL — lookalikes,
 *      http, ports and userinfo are refused, and NO query can move the target's host or path;
 *   2. the client half refuses any URL that is not this project's authorize endpoint (another host, another path);
 *   3. PKCE survives the hop: code_challenge, code_challenge_method and redirect_to arrive unchanged;
 *   4. the app's OAuth start never hands a raw supabase.co URL to `openAuthSession`, and the route reads only the
 *      query and the env — never a host or path from the request.
 *
 * SABOTAGE (run 22 Nov 2026, each RED, then restored):
 *   · `supabaseAuthOrigin`'s host test loosened to `/supabase\.co$/`             → test 1 RED (lookalike accepted)
 *   · `native-oauth.ts` back to `url: data.url`                                → test 4 RED
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  OAUTH_FRONT_DOOR_PATH,
  SUPABASE_AUTHORIZE_PATH,
  authorizeTarget,
  frontDoorAuthorizeUrl,
  supabaseAuthOrigin,
} from '@/lib/oauth-front-door';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (p: string) => {
  const raw = readFileSync(resolve(WEB, p), 'utf8');
  assert.ok(raw.length > 300, `${p} is missing or a stub — a guard pointed at the wrong file passes forever.`);
  return stripComments(raw);
};

const SUPA = 'https://abcdefghijklmnop.supabase.co';
const APP = 'https://www.setnayan.com';
const AUTHORIZE =
  `${SUPA}/auth/v1/authorize?provider=google` +
  `&redirect_to=${encodeURIComponent('setnayan://auth/callback?next=%2F')}` +
  '&code_challenge=Zk9_kLm-2xQ&code_challenge_method=s256&login_hint=ana%40example.com';

test('1 · the only host is https://<ref>.supabase.co, and no query can move the target', () => {
  assert.equal(supabaseAuthOrigin(SUPA), SUPA);
  assert.equal(supabaseAuthOrigin(`${SUPA}/`), SUPA);
  for (const bad of [
    'http://abcdefghijklmnop.supabase.co',
    'https://abcdefghijklmnop.supabase.co:8443',
    'https://user:pw@abcdefghijklmnop.supabase.co',
    'https://evil.com',
    'https://abcdefghijklmnop.supabase.co.evil.com',
    'https://evilsupabase.co',
    'https://a.b.supabase.co',
    'http://127.0.0.1:54321',
    '',
    undefined,
    'not a url',
  ]) {
    assert.equal(supabaseAuthOrigin(bad), null, `must refuse ${String(bad)}`);
    assert.equal(authorizeTarget('?provider=google', bad), null, `route must refuse env ${String(bad)}`);
  }
  for (const q of [
    '?provider=google',
    '?provider=google&redirect_to=https%3A%2F%2Fevil.com',
    '?provider=google&next=//evil.com/x',
    '?provider=google&to=https://evil.com/auth/v1/authorize',
    '?provider=google&@evil.com',
    '?provider=google&x=%2F..%2F..%2Frest%2Fv1%2Fusers',
  ]) {
    const t = authorizeTarget(q, SUPA);
    assert.ok(t, `refused a plain query ${q}`);
    const u = new URL(t);
    assert.equal(u.origin, SUPA, `${q} moved the host`);
    assert.equal(u.pathname, SUPABASE_AUTHORIZE_PATH, `${q} moved the path`);
  }
  assert.equal(authorizeTarget('', SUPA), null, 'no query → refuse');
  assert.equal(authorizeTarget('?redirect_to=x', SUPA), null, 'no provider → refuse');
  assert.equal(authorizeTarget(`?provider=google&x=${'a'.repeat(5000)}`, SUPA), null, 'an oversized query → refuse');
});

test('2 · the client half opens our address only for this project’s authorize URL', () => {
  const door = frontDoorAuthorizeUrl(APP, AUTHORIZE, SUPA);
  assert.ok(door, 'refused the real authorize URL');
  assert.equal(new URL(door).origin, APP, 'the sheet must name setnayan.com');
  assert.equal(new URL(door).pathname, OAUTH_FRONT_DOOR_PATH);
  assert.equal(frontDoorAuthorizeUrl(`${APP}/`, AUTHORIZE, SUPA), door, 'a trailing slash on the origin is harmless');
  for (const other of [
    AUTHORIZE.replace(SUPA, 'https://evil.com'),
    AUTHORIZE.replace(SUPA, 'https://zzzzzzzzzzzzzzzz.supabase.co'),
    AUTHORIZE.replace(SUPABASE_AUTHORIZE_PATH, '/auth/v1/token'),
    AUTHORIZE.replace(SUPABASE_AUTHORIZE_PATH, '/rest/v1/users'),
    `${SUPA}/auth/v1/authorize`,
    'not a url',
  ]) {
    assert.equal(frontDoorAuthorizeUrl(APP, other, SUPA), null, `must refuse ${other}`);
  }
  assert.equal(frontDoorAuthorizeUrl(APP, AUTHORIZE, 'https://evil.com'), null, 'a bad env refuses');
});

test('3 · PKCE survives the hop — the challenge, its method and redirect_to arrive unchanged', () => {
  const door = frontDoorAuthorizeUrl(APP, AUTHORIZE, SUPA)!;
  const target = new URL(authorizeTarget(new URL(door).search, SUPA)!);
  const before = new URL(AUTHORIZE);
  assert.equal(target.origin + target.pathname, before.origin + before.pathname);
  for (const k of ['provider', 'redirect_to', 'code_challenge', 'code_challenge_method', 'login_hint']) {
    assert.equal(target.searchParams.get(k), before.searchParams.get(k), `${k} changed on the way through`);
  }
  assert.deepEqual([...target.searchParams.keys()], [...before.searchParams.keys()], 'a parameter was added or dropped');
});

test('4 · the app never hands a raw supabase.co URL to openAuthSession; the route reads only the query', () => {
  const src = read('lib/native-oauth.ts');
  const calls = [...src.matchAll(/callPlugin\('openAuthSession',\s*\{[\s\S]*?\}\)/g)].map((m) => m[0]);
  assert.ok(calls.length > 0, 'the native flow no longer opens an auth session');
  for (const c of calls) {
    assert.match(c, /url:\s*frontDoor\b/, `openAuthSession must open our address: ${c}`);
    assert.doesNotMatch(c, /data\.url|supabase\.co/, `a raw Supabase URL reaches the sheet: ${c}`);
  }
  assert.match(src, /const frontDoor = frontDoorAuthorizeUrl\(window\.location\.origin, data\.url, process\.env\.NEXT_PUBLIC_SUPABASE_URL\);/);
  assert.match(src, /if \(!frontDoor\) \{\s*fail\(/, 'no front door → refuse, never fall back to the raw URL');

  const route = read('app/auth/go/route.ts');
  assert.match(route, /authorizeTarget\(request\.nextUrl\.search, process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/);
  assert.match(route, /NextResponse\.redirect\(target, 302\)/);
  assert.equal((route.match(/NextResponse\.redirect\(/g) ?? []).length, 1, 'the route has exactly one redirect, to the checked target');
  assert.doesNotMatch(route, /searchParams\.get\(|request\.url|nextUrl\.(host|pathname|origin)/, 'the route must not read a destination from the request');
});
