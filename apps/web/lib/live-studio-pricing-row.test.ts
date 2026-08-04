/**
 * ⭐ CAN THE PAID LIVE STUDIO SKU ACTUALLY APPEAR AT LAUNCH?
 *
 * `/pricing` renders `ADDON_GROUPS.map(...)` and OMITS any item the catalog does
 * not return, so **a SKU listed in no group is invisible no matter what the
 * catalog says.** That trap is already recorded in the page itself, in
 * COUPLE_WEBSITE_PRO's comment ("must be LISTED here or the reactivated umbrella
 * never appears"), and Live Studio was walking straight into it: the only Live
 * Studio code in any group was `PANOOD_SYSTEM`, which migration
 * `20271005180040` (PR #3716) retired. So at the flag flip the Studio tile and
 * the buy drawer would light up while `/pricing` showed **no paid
 * live-broadcast row at all** — the public price page omitting the product being
 * launched.
 *
 * Its own file on purpose: a brand-new test file cannot conflict with a
 * concurrent PR, the same reason `changelog.d/` fragments are per-PR files.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

test('⭐ LIVE_STUDIO is listed on /pricing — otherwise the launch has no paid row', () => {
  assert.match(
    repoFile('app/pricing/page.tsx'),
    /\{ code: 'LIVE_STUDIO' \}/,
    'the unified ₱2,999 SKU is in no /pricing group, so it can never render',
  );
});

test('the LIVE_STUDIO name-exclusion stays INSIDE the flag gate', () => {
  // Listing it above is theatre if the catalog reader excludes it unconditionally —
  // the row could never come back. The exclusion must remain flag-scoped so one
  // owner switch lights up /pricing and the Studio tile together.
  const reader = repoFile('lib/v2-catalog.ts');
  const gateAt = reader.indexOf('if (!liveStudioRoamEnabled())');
  const excludeAt = reader.indexOf("neq('service_code', 'LIVE_STUDIO')");
  assert.ok(gateAt > -1, 'the flag gate in fetchV2CustomerCatalog is gone');
  assert.ok(excludeAt > gateAt, 'LIVE_STUDIO is excluded from /pricing unconditionally');
});

test('the retired Cast SKU stays legible, not silently deleted', () => {
  // Convention in this file (see LIVE_BACKGROUND): a retired code stays listed with a
  // comment, so the retirement reads as deliberate rather than as a lost line.
  const pricing = repoFile('app/pricing/page.tsx');
  assert.match(pricing, /\{ code: 'PANOOD_SYSTEM' \}/);
  assert.match(pricing, /20271005180040/, 'the retirement should name its migration');
});
