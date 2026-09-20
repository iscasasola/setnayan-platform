import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { shouldOfferReload, servingVersionFrom } from './build-version';

/**
 * The bar this decides is the LAST thing standing between a silent blank page
 * and a couple concluding the site is down — the owner did exactly that on
 * 2026-09-20, on a site that was serving perfectly.
 *
 * Its two failure modes pull in opposite directions and both are bad:
 *   · never firing → we shipped a mitigation that mitigates nothing;
 *   · firing when the page is fine → a bar that cries wolf, ignored on the one
 *     day it is right.
 * So the silent cases are tested as hard as the loud one.
 */

// ── it fires, exactly once it should ───────────────────────────────────────
test('two different real versions offer a reload', () => {
  assert.equal(shouldOfferReload('496bdc4', '06f9ab2'), true);
});

// ── and stays quiet everywhere else ────────────────────────────────────────
test('the same version never offers a reload', () => {
  assert.equal(shouldOfferReload('496bdc4', '496bdc4'), false);
  // Whitespace is not a new deploy.
  assert.equal(shouldOfferReload(' 496bdc4 ', '496bdc4'), false);
});

test("'dev' on either side is silence, not a mismatch", () => {
  // Both the health route and the build-time fallback use 'dev' when there is
  // no commit sha. Treating it as a version would make every local page and
  // every non-Vercel build nag on load.
  assert.equal(shouldOfferReload('dev', '06f9ab2'), false);
  assert.equal(shouldOfferReload('496bdc4', 'dev'), false);
  assert.equal(shouldOfferReload('dev', 'dev'), false);
});

test('an unknown side is silence — we do not guess', () => {
  for (const [a, b] of [
    ['', '06f9ab2'],
    ['496bdc4', ''],
    ['   ', '06f9ab2'],
    [undefined, '06f9ab2'],
    ['496bdc4', null],
    [42, '06f9ab2'],
    ['496bdc4', { version: '06f9ab2' }],
  ] as [unknown, unknown][]) {
    assert.equal(
      shouldOfferReload(a, b),
      false,
      `offered a reload from ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
    );
  }
});

// ── reading the health payload ─────────────────────────────────────────────
test('the serving version is read only from a real string field', () => {
  assert.equal(servingVersionFrom({ ok: true, version: '06f9ab2' }), '06f9ab2');
  assert.equal(servingVersionFrom({ ok: true, version: '  06f9ab2 ' }), '06f9ab2');
  for (const bad of [null, undefined, 'a string', 42, {}, { version: '' }, { version: 7 }]) {
    assert.equal(servingVersionFrom(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

// ── the two halves must keep talking to each other ─────────────────────────
test('🪤 the health route still reports the field this reads', () => {
  // The whole mechanism hangs on /api/health returning `version`. That route
  // exists for Better Stack pings, not for us, and nothing over there knows
  // this depends on it — a rename would leave the bar permanently silent with
  // every test here still green.
  const route = readFileSync('app/api/health/route.ts', 'utf8');
  assert.match(route, /version:\s*process\.env\.VERCEL_GIT_COMMIT_SHA/);
  // And it must not be cached, or a stale 200 would report the old build
  // forever — which would make the bar fire on a page that is perfectly fresh.
  assert.match(route, /no-store/);
  assert.match(route, /force-dynamic/);
});

test('🪤 the build version is inlined by next.config, not left to a dashboard toggle', () => {
  // NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA only exists when "Automatically expose
  // System Environment Variables" is on — a setting nobody here controls. If
  // this inlining is dropped, LOADED_BUILD_VERSION becomes '' and the notice
  // silently never renders again.
  const config = readFileSync('next.config.ts', 'utf8');

  // 🪤 A FILE-LEVEL MATCH CANNOT SAY WHICH SITE. `VERCEL_GIT_COMMIT_SHA` also
  // appears in this file's Sentry release config, so asserting it is merely
  // PRESENT passed a sabotage that replaced the inlined value with a literal
  // 'dev' — the exact break this test exists to catch. Anchor on the binding.
  const binding = /NEXT_PUBLIC_BUILD_VERSION:\s*([^,]*),/.exec(config);
  assert.ok(binding, 'next.config.ts no longer defines NEXT_PUBLIC_BUILD_VERSION');
  assert.match(
    binding[1] ?? '',
    /VERCEL_GIT_COMMIT_SHA/,
    `NEXT_PUBLIC_BUILD_VERSION is bound to \`${(binding[1] ?? '').trim()}\`, ` +
      'not to the commit sha — the notice would never fire again',
  );
});

test('🪤 the notice is mounted, exactly once, in the ROOT layout', () => {
  // A component nothing renders is a component that cannot fire. Root, so it
  // covers the couple's dashboard, the supplier workspace AND a guest on an
  // invitation — all three are pages people leave open across a deploy.
  const layout = readFileSync('app/layout.tsx', 'utf8');
  const mounts = layout.match(/<StaleTabNotice\s*\/>/g) ?? [];
  assert.equal(mounts.length, 1, `expected 1 mount, found ${mounts.length}`);
  assert.match(layout, /import \{ StaleTabNotice \}/);
});
