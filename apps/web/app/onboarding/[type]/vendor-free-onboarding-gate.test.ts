/**
 * vendor-free-onboarding-gate.test.ts — owner 2026-09-25, verbatim: "i noticed
 * that simple event has questions for suppliers. the simple event is only for
 * our own services."
 *
 * `/onboarding/[type]` used to block ONLY 'wedding' (event.type === 'wedding'),
 * so `/onboarding/simple_event` — reachable directly, not through the
 * create-event picker's `onboarding_href` redirect — rendered the FULL generic
 * wizard: vendor-category tiles, the "How much do you want to do?" effort
 * question that sizes them, and the "We'll line up <categories>" reveal. A
 * Simple Event has no vendor marketplace at all (`event-type-profile.ts`
 * `SIMPLE_PROFILE.marketplaceEnabled: false` — Explore/vendors are already
 * hidden on its dashboard, per `lib/vendor-free-surfaces.test.ts`), so asking
 * it to size vendor categories was a live defect.
 *
 * Gated on `profile.marketplaceEnabled`, never on `type === 'simple_event'`,
 * so a future vendor-free type is covered without a second edit to this file.
 *
 * ⚠ SOURCE-LEVEL, same posture as `lib/vendor-free-surfaces.test.ts` and
 * `generic-onboarding-entrance-block.test.ts`: this route is an async Server
 * Component with several Supabase reads (auth, taxonomy, admin-editable
 * onboarding spec), so the invariant worth pinning is "the gate is wired",
 * which reading the real source proves more durably than mocking every read
 * to render it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');
const src = () => stripComments(readFileSync(PAGE, 'utf8'));

test('the gate reads profile.marketplaceEnabled, never the type string', () => {
  const s = src();
  assert.match(
    s,
    /const vendorFree = profile\.marketplaceEnabled !== true/,
    'vendorFree must be derived from the profile column — a future vendor-free ' +
      'type has to be covered without editing this file again',
  );
  assert.doesNotMatch(
    s,
    /vendorFree\s*=\s*type === ['"]simple_event['"]/,
    'must never key the gate on the literal type name',
  );
});

test('a vendor-free type with its own onboarding page is redirected there', () => {
  const s = src();
  assert.match(
    s,
    /if \(vendorFree && row\.onboardingHref[\s\S]{0,80}\)\s*\{\s*redirect\(row\.onboardingHref\)/,
    'must redirect to the type\'s own onboarding_href (e.g. /onboarding/simple) ' +
      'instead of rendering the full wizard under /onboarding/[type]',
  );
});

test('a vendor-free type falling through gets no vendor taxonomy tiles', () => {
  const s = src();
  assert.match(
    s,
    /vendorFree \? Promise\.resolve\(\[\]\) : getOnboardingTiles\(type\)/,
    'tiles must be empty for a vendor-free type reaching the fallback wizard — ' +
      'there is no marketplace to size categories against',
  );
});

test('vendorFree is threaded into the client wizard', () => {
  const s = src();
  assert.match(
    s,
    /<GenericOnboarding[\s\S]{0,600}vendorFree=\{vendorFree\}/,
    'GenericOnboarding must receive vendorFree so it can drop the vendor-sizing ' +
      'screens on its own',
  );
});
