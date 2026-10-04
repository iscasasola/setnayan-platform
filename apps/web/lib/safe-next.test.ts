/**
 * safe-next.test.ts — THE ONE RULE for a user-controlled "where next" path.
 *
 * FOUND by the independent audit of train #6333 (2026-10-04): the old rule was
 * "starts with `/`, not with `//`", and the WHATWG parser — the browser's, and
 * Node's — reads a backslash as a slash and strips TAB/CR/LF anywhere:
 *
 *   new URL('/\\evil.com',  origin) → https://evil.com/
 *   new URL('/\t/evil.com', origin) → https://evil.com/
 *
 * Both passed. This file holds the table: every hostile value collapses to the
 * fallback, every real path passes through VERBATIM, and every other sanitiser
 * that used to carry its own copy of the rule now asks this one.
 *
 * SABOTAGES (each run, each red, each restored — see the PR):
 *   · isSafeNext back to the old "starts with / and not //"          → table RED
 *   · drop the RAW_FORBIDDEN test                                    → table RED (`/\t/evil.com`)
 *   · skip the decoded-forms loop                                    → table RED (`/%5cevil.com`)
 *   · drop the origin check AND the backslash from both classes      → table RED (`/\evil.com`)
 *     (a backslash is caught by three layers; any one of them suffices)
 *   · editor-return.ts: back to its own `!startsWith('//')`          → callers RED
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeNext, safeNext } from './safe-next';
import { isSafeInternalPath } from './editor-return';
import { eventSlugFromNext } from './sign-in-for-a-guest';
import { appUrlToPath } from './app-url-path';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every one of these must collapse to the fallback. */
const HOSTILE_NEXT: readonly string[] = [
  '/\\evil.com',
  '/\t/evil.com',
  '/\n/evil.com',
  '/\r\n/evil.com',
  '\t//evil.com',
  ' //evil.com',
  '//evil.com',
  '///evil.com',
  '/%5cevil.com',
  '/%5Cevil.com',
  '/%2f%2fevil.com',
  '/%2F%2Fevil.com',
  '/%252f%252fevil.com',
  '/%255cevil.com',
  '/%09/evil.com',
  '/%0d%0aLocation:%20https://evil.com',
  '/%0aSet-Cookie:x=1',
  '/x\\y',
  '/x\u0000y',
  '/x\u007fy',
  '/x\u0085y',
  '/x y',
  '/x y',
  'https://evil.com',
  'HTTPS://evil.com',
  'http:evil.com',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'evil.com',
  './/evil.com',
  '',
  '/%',
  '/%zz',
];

/** Every one of these is a real page of ours and must come back unchanged. */
const GOOD_NEXT: readonly string[] = [
  '/',
  '/maria-and-jose',
  '/dashboard/x?tab=y#z',
  '/dashboard/S89E-ABCDEFGHJK/guests?inspect=g-1',
  '/join/S89E-ABC/connect',
  '/vendors?q=lights%20and%20sound',
  '/search?q=caf%C3%A9',
  '/x?pct=100%25',
  '/u/ana/ana-and-ben',
  '/papic/buy?tier=full',
];

test('every hostile `next` collapses to the safe default', () => {
  for (const raw of HOSTILE_NEXT) {
    assert.equal(isSafeNext(raw), false, `accepted ${JSON.stringify(raw)}`);
    assert.equal(safeNext(raw), '/', `${JSON.stringify(raw)} did not collapse to /`);
    assert.equal(safeNext(raw, '/papic'), '/papic', `${JSON.stringify(raw)} ignored the fallback`);
  }
});

test('the two shapes the audit found really do leave the site under the old rule', () => {
  // Pins WHY: if the parser ever stopped doing this, the table would still be
  // right, but this test documents what the rule is defending against.
  const origin = 'https://www.setnayan.com';
  assert.equal(new URL('/\\evil.com', origin).origin, 'https://evil.com');
  assert.equal(new URL('/\t/evil.com', origin).origin, 'https://evil.com');
});

test('a real path passes through VERBATIM', () => {
  for (const raw of GOOD_NEXT) {
    assert.equal(isSafeNext(raw), true, `refused ${JSON.stringify(raw)}`);
    assert.equal(safeNext(raw), raw);
  }
});

test('non-strings are refused', () => {
  for (const raw of [null, undefined, 42, {}, ['/x'], new String('/x')]) {
    assert.equal(isSafeNext(raw), false);
    assert.equal(safeNext(raw), '/');
  }
});

test('the scoped helpers add their prefix ON TOP of the rule, never instead of it', () => {
  // editor-return: under /dashboard/ AND the rule.
  assert.equal(isSafeInternalPath('/dashboard/e-1/launch'), true);
  assert.equal(isSafeInternalPath('/dashboard/e-1/%5c%5cevil.com'), false);
  assert.equal(isSafeInternalPath('/dashboard/e-1/\tx'), false);
  // the guest's sign-in card: no slug from a path that is not ours.
  assert.equal(eventSlugFromNext('/maria-and-jose'), 'maria-and-jose');
  assert.equal(eventSlugFromNext('/\\evil.com'), null);
  assert.equal(eventSlugFromNext('/\t/evil.com'), null);
  // the phone app's deep links: a custom-scheme link cannot steer the web view off-site.
  assert.equal(appUrlToPath('setnayan:////evil.com'), null);
  assert.equal(appUrlToPath('setnayan://auth/callback?code=abc&next=%2Fx'), '/auth/callback?code=abc&next=%2Fx');
});

test('no second sanitiser: every redirect helper that used to carry its own copy asks the one rule', () => {
  const callers: [string, RegExp][] = [
    ['lib/auth.ts', /from '@\/lib\/safe-next'/],
    ['lib/editor-return.ts', /isSafeNext\(value\)/],
    ['lib/sign-in-for-a-guest.ts', /if \(!isSafeNext\(next\)\) return null;/],
    ['lib/app-url-path.ts', /return isSafeNext\(mapped\) \? mapped : null;/],
    ['lib/notification-actions.ts', /if \(isSafeNext\(returnTo\)\)/],
    ['lib/chat-actions.ts', /isSafeNext\(returnTo\)/],
    ['lib/desktop-oauth.ts', /window\.location\.assign\(safeNext\(next\)\)/],
    ['app/_components/appointments-actions.ts', /safeNext\(str\(v, 300\), '\/dashboard'\)/],
    ['app/_components/negotiation-actions.ts', /isSafeNext\(p\) \? p : null/],
    ['app/papic/buy/actions.ts', /!isSafeNext\(v\)/],
    ['app/admin/work/actions.ts', /safeNext\(formData\.get\('back'\), '\/admin\/work'\)/],
    ['app/dashboard/[eventId]/guests/[guestId]/actions.ts', /isSafeNext\(requestedReturn\)/],
    ['app/vendor-dashboard/subscription/photo-challenge-actions.ts', /isSafeNext\(s\)/],
    ['app/join/[eventId]/set-password/page.tsx', /safeNext\(sp\.next, /],
  ];
  for (const [rel, pattern] of callers) {
    assert.match(code(rel), pattern, `${rel} no longer routes through lib/safe-next.ts`);
  }
  // …and none of them keeps the old hand-rolled check alongside.
  for (const rel of [
    'lib/chat-actions.ts',
    'lib/notification-actions.ts',
    'lib/sign-in-for-a-guest.ts',
    'app/_components/appointments-actions.ts',
    'app/_components/negotiation-actions.ts',
    'app/papic/buy/actions.ts',
    'app/dashboard/[eventId]/guests/[guestId]/actions.ts',
  ]) {
    assert.doesNotMatch(
      code(rel),
      /(returnTo|requestedReturn|next|\bp|\bv)\.startsWith\('\/\/'\)|returnTo\.startsWith\('\/'\)|p\.startsWith\('\/'\)/,
      `${rel} carries a second, hand-rolled copy of the rule`,
    );
  }
});
