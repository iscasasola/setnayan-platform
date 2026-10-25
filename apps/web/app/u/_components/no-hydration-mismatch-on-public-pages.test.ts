/**
 * The two React #418 hydration errors the live quality sweep found (2026-10-13,
 * item 4) stay fixed.
 *
 * 1. /u/<slug> (profile + chapter): the view beacon was a SERVER ACTION that set
 *    a cookie. A cookie-setting action re-renders the page, and the refreshed
 *    tree ("11 views") hydrated against the server HTML ("10 views") on every
 *    first visit. The beacon is now `POST /api/u/view` (no re-render).
 *    Rule: the beacon imports no server action, posts to the route, and the
 *    route exists; `audience-actions.ts` sets no cookie (any action there that
 *    did would be the same bug again for whoever calls it on mount).
 *
 * 2. /tour/vendors: the scripted chat printed `new Date()` in the viewer's zone
 *    during hydration — the server (UTC) printed another time. The time now
 *    joins the line only once hydrated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the /u view beacon is a route fetch, not a cookie-setting server action', () => {
  const beacon = read('app/u/_components/view-beacon.tsx');
  assert.ok(!/from\s+['"][^'"]*_actions\//.test(beacon), 'view-beacon.tsx imports a server action again');
  assert.ok(beacon.includes("fetch('/api/u/view'"), 'view-beacon.tsx no longer posts to /api/u/view');
  assert.ok(existsSync(join(WEB, 'app/api/u/view/route.ts')), 'app/api/u/view/route.ts is gone');
  assert.ok(/export async function POST\b/.test(read('app/api/u/view/route.ts')), '/api/u/view has no POST');
  const actions = read('app/u/_actions/audience-actions.ts');
  assert.ok(!/\.set\(/.test(actions) || !/cookies\(\)/.test(actions), 'audience-actions.ts sets a cookie — a cookie-setting server action re-renders the page (React #418 when fired on mount)');
});

test('the tour chat prints its clock time only after hydration', () => {
  const src = read('app/tour/_components/tour-chat-thread.tsx');
  const calls = [...src.matchAll(/formatTs\(m\.at\)/g)].length;
  assert.ok(calls > 0, 'tour-chat-thread.tsx no longer formats a time — did it change shape?');
  const guarded = [...src.matchAll(/hydrated\s*\?\s*`[^`]*\$\{formatTs\(m\.at\)\}/g)].length;
  assert.equal(guarded, calls, 'tour-chat-thread.tsx prints new Date() in the viewer’s zone during hydration (React #418 on /tour/vendors)');
});
