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

test('⭐ LIVE_STUDIO has a row on /pricing — otherwise the launch has no paid row', () => {
  // ⚠ CHANGED 2026-10-25 (prototype `pricing_ours_only_2026-10-25` revision 5): /pricing no longer renders an
  // ADDON_GROUPS grid. Live Watch is its own row, read from the LIVE_STUDIO catalogue row and drawn whenever that row
  // is returned — so the same one launch switch (below) lights it.
  assert.match(
    repoFile('app/(shell)/pricing/_pricing-reads.ts'),
    /liveWatch: php\('LIVE_STUDIO'\)/,
    'the unified SKU is no longer read for /pricing, so it can never render',
  );
  assert.match(
    repoFile('app/(shell)/pricing/page.tsx'),
    /\{prices\.liveWatch \? \(\s*<PriceRowShell\s+name="Live Watch"/,
    'the Live Watch row is no longer drawn from the LIVE_STUDIO price',
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

test('the retired Cast SKU is never priced on /pricing', () => {
  // The ADDON_GROUPS list that kept PANOOD_SYSTEM legible (retired by migration 20271005180040) left /pricing with the
  // grid on 2026-10-25. What must stay true: nothing on the page reads the retired code.
  const pricing = repoFile('app/(shell)/pricing/page.tsx') + repoFile('app/(shell)/pricing/_pricing-reads.ts');
  assert.doesNotMatch(pricing, /'PANOOD_SYSTEM'/);
});
