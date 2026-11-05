/**
 * A signed-out deep link into the Shop console comes back to THAT page after
 * sign-in.
 *
 * Until 2026-11-05 the layout's bounce was `loginRedirectPath('/vendor-dashboard')`
 * — a literal — so a supplier tapping an email link to a chat or a booking signed
 * in and landed on Today, with the thread they came for nowhere on screen.
 * Layouts are not handed their URL, so the middleware stamps the requested path
 * on the request (`REQUEST_PATH_HEADER`) and the layout reads it back through
 * `shopConsolePath` (same-origin + console-only, executed in
 * lib/shop-console-path.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '../../lib/strip-comments';

const LAYOUT = stripComments(readFileSync('app/vendor-dashboard/layout.tsx', 'utf8'));
const MIDDLEWARE = stripComments(readFileSync('middleware.ts', 'utf8'));

test('the sign-in bounce carries the requested console page, not a literal', () => {
  assert.doesNotMatch(LAYOUT, /loginRedirectPath\('\/vendor-dashboard'\)/, 'the bounce is hard-coded to Today again');
  assert.match(
    LAYOUT,
    /if \(!user\) redirect\(loginRedirectPath\(shopConsolePath\(\(await headers\(\)\)\.get\(REQUEST_PATH_HEADER\)\)\)\);/,
  );
});

test('the middleware stamps the path BEFORE updateSession builds the forwarded request', () => {
  const stamp = MIDDLEWARE.indexOf('request.headers.set(REQUEST_PATH_HEADER, requestPathOf(request.nextUrl));');
  const session = MIDDLEWARE.indexOf('await updateSession(request)');
  assert.ok(stamp >= 0, 'the middleware no longer stamps the requested path — the layout falls back to Today');
  assert.ok(session > stamp, 'the path is stamped after updateSession — NextResponse.next({ request }) has already copied the headers');
});
