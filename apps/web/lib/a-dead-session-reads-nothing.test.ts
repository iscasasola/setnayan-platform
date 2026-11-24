/**
 * a-dead-session-reads-nothing.test.ts — 🧹 A COOKIE'S NAME IS NOT A SESSION.
 *
 * Live fault (app_telemetry_logs, 19–21 Nov 2026): `GET events` → 42501 "permission denied for table events" as
 * anon, 401. The Supabase gateway log for 21 Nov 19:25Z shows the order: the middleware's
 * `POST auth/v1/token?grant_type=refresh_token` → 400 (a dead refresh token), @supabase/ssr removes the session by
 * writing the auth cookie back EMPTY onto the request, and then the event Home and the Guests page — whose reads start
 * beside the layout's sign-in redirect — sent the event row (and on Guests the role words, the invite's words, the
 * not-counted rows, the song requests and the service counts) with no session. The Guests page's gate matched the
 * cookie's NAME only; the Home page had no gate before its row opened.
 *
 * Holds: (1) an emptied session cookie is not a live one; (2) the Home page and its tab title ask the jar BEFORE the
 * event row opens. The Guests page's half is `the-guests-page-asks-once.test.ts` 6b (the real page, a counted stand-in).
 * Sabotage: make `isLiveSessionCookie` test the name only → (1) red; move Home's gate below `openDashboardEventRow`
 * → (2) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isLiveSessionCookie } from './appearance';
import { stripComments } from './strip-comments';

test('1 · an emptied session cookie (a refresh the middleware could not make) is not a live session', () => {
  assert.equal(isLiveSessionCookie({ name: 'sb-abc123-auth-token', value: 'base64-eyJ4Ijoi' }), true);
  assert.equal(isLiveSessionCookie({ name: 'sb-abc123-auth-token.0', value: 'base64-eyJ4Ijoi' }), true, 'a chunk');
  assert.equal(isLiveSessionCookie({ name: 'sb-abc123-auth-token', value: '' }), false, 'the removal writes it empty');
  assert.equal(isLiveSessionCookie({ name: 'sb-abc123-auth-token.1', value: '   ' }), false);
  assert.equal(isLiveSessionCookie({ name: 'sb-abc123-auth-token-code-verifier', value: 'x' }), false, 'PKCE is not a session');
  assert.equal(isLiveSessionCookie({ name: 'sn-theme', value: 'dark' }), false);
});

test('2 · the event Home and its tab title ask the cookie jar before the event row opens', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'page.tsx'), 'utf8'));
  for (const fn of ['export async function generateMetadata(', 'export default async function EventHomePage(']) {
    const at = src.indexOf(fn);
    assert.ok(at >= 0, `${fn} not found — move this guard with it`);
    const body = src.slice(at, src.indexOf('\n}\n', at));
    const gate = body.indexOf('hasLiveSessionCookie()');
    const open = body.indexOf('openDashboardEventRow(');
    assert.ok(gate >= 0, `${fn} reads before asking whether anybody is signed in`);
    assert.ok(open < 0 || gate < open, `${fn} opens the event row before the session gate — a signed-out request reads as anon`);
  }
});
