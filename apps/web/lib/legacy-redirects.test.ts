/**
 * legacy-redirects.test.ts — a retired redirect-only page is GONE as a route
 * and its old URL STILL FORWARDS, through the middleware, for free.
 *
 * Slice C1 of the 2026-10-02 cleanup deleted ten `page.tsx` files whose only job
 * was `redirect(...)`. Each was a deployed route against Vercel's 2,048 cap, and
 * a `next.config` `redirects()` rule would have cost one too. The old paths live
 * on in other people's emails, bookmarks and stored notification links, so the
 * forward has to survive the deletion. These tests hold the three halves:
 *   1. the map says where each old path goes (the destinations the stubs had),
 *   2. the middleware actually calls it, as a 308, ahead of the session work,
 *      and its matcher covers every old path,
 *   3. the pages really are gone and no next.config rule re-spends the route.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { LEGACY_REDIRECT_OLD_PATHS, legacyRedirectTarget } from './legacy-redirects';

const WEB = path.resolve(import.meta.dirname, '..');
const EID = 'S89E-ABCDEFGHIJ';

/** [old path, the destination the deleted stub redirected to]. */
const FORWARDS: readonly (readonly [string, string])[] = [
  [`/dashboard/${EID}/for-you`, `/dashboard/${EID}/vendors`],
  [`/dashboard/${EID}/design`, `/dashboard/${EID}/studio`],
  [`/dashboard/${EID}/today`, `/dashboard/${EID}`],
  [`/dashboard/${EID}/studio/animated-monogram`, `/dashboard/${EID}/monogram`],
  [`/dashboard/${EID}/website/launch`, `/dashboard/${EID}/website/editor`],
  ['/admin/refinements', '/admin/categories'],
  // "Categories & event types" (2026-10-02) — the six doors it replaced.
  ['/admin/taxonomy/aliases', '/admin/categories?show=words'],
  ['/admin/event-types', '/admin/categories?list=event-types'],
  ['/admin/wedding-traditions', '/admin/categories?list=religions'],
  ['/admin/wedding-types', '/admin/categories?list=religions'],
  ['/admin/taxonomy', '/admin/categories'],
  ['/admin/event-types/birthday/categories', '/admin/categories?list=event-types&open=birthday'],
  ['/admin/event-types/simple_event/profile', '/admin/categories?list=event-types&open=simple_event'],
  ['/admin/event-types/wake/onboarding', '/admin/categories?list=event-types&open=wake'],
  ['/admin/marketing', '/admin/studio'],
  ['/vendor-dashboard/funnel', '/vendor-dashboard/performance'],
  ['/vendor-dashboard/tax-documents', '/vendor-dashboard'],
  ['/explore/categories', '/explore'],
];

/** The page file each old path used to be (relative to app/). */
const DELETED_PAGES: readonly string[] = [
  'dashboard/[eventId]/for-you/page.tsx',
  'dashboard/[eventId]/design/page.tsx',
  'dashboard/[eventId]/today/page.tsx',
  'dashboard/[eventId]/studio/animated-monogram/page.tsx',
  'dashboard/[eventId]/website/launch/page.tsx',
  'admin/refinements/page.tsx',
  'admin/taxonomy/aliases/page.tsx',
  'admin/event-types/page.tsx',
  'admin/wedding-traditions/page.tsx',
  'admin/wedding-types/page.tsx',
  'admin/taxonomy/page.tsx',
  'admin/event-types/[eventType]/categories/page.tsx',
  'admin/event-types/[eventType]/profile/page.tsx',
  'admin/event-types/[eventType]/onboarding/page.tsx',
  'admin/marketing/page.tsx',
  'vendor-dashboard/funnel/page.tsx',
  'vendor-dashboard/tax-documents/page.tsx',
  'explore/categories/page.tsx',
];

test('every retired path forwards to the destination its stub had', () => {
  for (const [from, to] of FORWARDS) {
    assert.equal(legacyRedirectTarget(from), to, `${from} no longer forwards to ${to}`);
  }
});

test('a trailing slash still forwards; a child path or a live path does not', () => {
  assert.equal(legacyRedirectTarget('/admin/marketing/'), '/admin/studio');
  assert.equal(legacyRedirectTarget(`/dashboard/${EID}/today/`), `/dashboard/${EID}`);
  assert.equal(legacyRedirectTarget('/admin/marketing/extra'), null);
  assert.equal(legacyRedirectTarget(`/dashboard/${EID}/design/extra`), null);
  // live neighbours that merely share a word with a retired path
  for (const live of [
    `/dashboard/${EID}/studio`,
    `/dashboard/${EID}/launch`, // the controller — NOT website/launch
    `/dashboard/${EID}/website/editor`,
    `/dashboard/${EID}/website/what-to-bring`, // still a page (a guarded /website door)
    '/explore',
    '/explore/compare',
    '/vendor-dashboard/performance',
    '/admin/categories',
    '/admin/event-types/birthday', // a type's own address was never a page
    '/admin/event-types/birthday/categories/extra',
    '/admin/taxonomy/other',
    '/',
  ]) {
    assert.equal(legacyRedirectTarget(live), null, `${live} is live and must not be forwarded`);
  }
});

test('the Studio’s old deep links keep their query, so they land on the same thing', () => {
  assert.equal(legacyRedirectTarget('/admin/taxonomy', '?view=vocab-event'), '/admin/categories?view=vocab-event');
  assert.equal(legacyRedirectTarget('/admin/taxonomy', '?open=catering&q=lechon'), '/admin/categories?open=catering&q=lechon');
  assert.equal(legacyRedirectTarget('/admin/taxonomy', ''), '/admin/categories');
  // Every other row still drops it, exactly as the stub did.
  assert.equal(legacyRedirectTarget('/admin/marketing', '?x=1'), '/admin/studio');
});

test('the map and this test agree on the full list (nothing forwards unpinned)', () => {
  assert.equal(LEGACY_REDIRECT_OLD_PATHS.length, FORWARDS.length);
  assert.equal(DELETED_PAGES.length, FORWARDS.length);
});

test('the middleware forwards them as a 308, before the session work', () => {
  const src = readFileSync(path.join(WEB, 'middleware.ts'), 'utf8');
  assert.match(src, /from '@\/lib\/legacy-redirects'/);
  const call = src.indexOf('legacyRedirectTarget(pathname, search)');
  assert.ok(call > 0, 'middleware no longer reads the legacy map');
  const after = src.slice(call, call + 400);
  assert.match(after, /NextResponse\.redirect\(new URL\(retiredTarget, request\.url\), 308\)/);
  assert.ok(
    call < src.indexOf('await updateSession(request)'),
    'the forward must run before updateSession — a retired URL needs no session work',
  );
});

test('the middleware matcher covers every retired path', () => {
  const src = readFileSync(path.join(WEB, 'middleware.ts'), 'utf8');
  const m = /matcher:\s*\[\s*'([^']+)'/.exec(src);
  assert.ok(m, 'could not find the middleware matcher');
  // Next anchors a matcher source to the whole path.
  const re = new RegExp(`^${m![1]!.replace(/\\\\/g, '\\')}$`);
  for (const [from] of FORWARDS) {
    assert.ok(re.test(from), `the middleware matcher skips ${from}, so it would 404 instead of forward`);
  }
});

test('the pages are gone, and no next.config rule re-spends the route', () => {
  for (const f of DELETED_PAGES) {
    assert.ok(!existsSync(path.join(WEB, 'app', f)), `app/${f} is back — a redirect-only page is a route`);
  }
  const cfg = readFileSync(path.join(WEB, 'next.config.ts'), 'utf8');
  for (const [from] of FORWARDS) {
    const generic = from.replace(EID, ':eventId');
    assert.ok(
      !cfg.includes(`'${generic}'`) && !cfg.includes(`"${generic}"`) && !cfg.includes(`\`${generic}\``),
      `next.config.ts redirects ${generic} — that costs a Vercel route; add the pair to lib/legacy-redirects.ts instead`,
    );
  }
});
