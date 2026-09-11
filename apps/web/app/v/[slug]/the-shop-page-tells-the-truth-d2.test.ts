/**
 * D2 (2026-09-11) — "the shop page tells the truth": songs only for
 * musicians, no "0 yrs", a lapsed plan loses its paid look, and the page
 * stops assuming every shop is a wedding shop.
 *
 * Source-scan tests (the established pattern for this file — see
 * `service-card-shows-its-title.test.ts`): a full render of `page.tsx` drags
 * in Supabase clients and the whole public-profile data graph, so the
 * behavioural guards for `yearsInBusiness` and the music-category union live
 * in their own unit tests (`lib/vendor-experience.test.ts`,
 * `lib/vendor-service-tools`/`lib/songs` callers); this file pins that THIS
 * PAGE actually wires them in, and that the raw `vendor.tier_state` column
 * is never read directly for a rendered gate again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'),
);

test('the public songs block is gated on the shared music rule, not just repertoire.length', () => {
  assert.match(
    src,
    /\{repertoire\.length > 0 && isMusicToolCategory\(vendor\.services\) \? \(/,
    'a non-music vendor with stray legacy repertoire rows must not show the songs block',
  );
});

test('the effective (lapse-collapsed) tier is computed once and threaded to every gate', () => {
  assert.match(
    src,
    /const effectiveTierState = effectiveSeoTier\(\{/,
    'renderVendorBySlug must compute the collapsed tier once',
  );
  for (const call of [
    /boothTierCanBrand\(effectiveTierState\)/,
    /tierCaps\(effectiveTierState\)/,
    /micrositeCan\(effectiveTierState\)\.canPersonalize/,
    /micrositeCan\(effectiveTierState\)\.isEnterprise/,
    /isTrueNameTier\(effectiveTierState\)/,
  ]) {
    assert.match(src, call, `${call} must read the collapsed tier, not the raw column`);
  }
});

test('the four gates inside renderVendorBySlug no longer read the raw tier_state column', () => {
  // vendorMetadataBySlug (a separate function, out of this session's scope)
  // keeps its own `vendor.tier_state ?? null` call — this only pins that the
  // ones inside the render body were migrated.
  const renderBodyStart = src.indexOf('export async function renderVendorBySlug');
  assert.ok(renderBodyStart > 0, 'renderVendorBySlug must exist');
  const renderBody = src.slice(renderBodyStart);
  for (const raw of [
    /boothTierCanBrand\(vendor\.tier_state/,
    /tierCaps\(vendor\.tier_state/,
    /micrositeCan\(vendor\.tier_state/,
    /isTrueNameTier\(vendor\.tier_state/,
  ]) {
    assert.doesNotMatch(renderBody, raw, `${raw} must not read the raw column inside the render body`);
  }
});

test('the page no longer assumes every shop is a wedding shop', () => {
  assert.doesNotMatch(src, /Wedding compatibility/);
  assert.doesNotMatch(src, /['"`]Wedding vendors['"`]/);
});
