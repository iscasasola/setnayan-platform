import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_PAGES } from '@/lib/feature-pages';
import { customerSkuBuildStatus } from '@/lib/v2-catalog';

/**
 * A FEATURE PAGE THAT SELLS A THING AND /pricing THAT CALLS IT UNFINISHED
 * CANNOT BOTH BE TRUE (sweep 2026-10-19, row B7).
 *
 * /features/live-watch sold "Live Watch · ₱2,500 · Try it" while /pricing
 * chipped the same catalogue row "In build". Both read the same SKU
 * (`LIVE_STUDIO`); they disagreed because the chip comes from a hand-kept map
 * (`BUILD_STATUS` in lib/v2-catalog.ts) whose LIVE_STUDIO line still said
 * "Bump to 'live' at launch" a month after launch. LIVE_WALL shipped the same
 * contradiction in August, and MOODBOARD_RENDER_PACK was simply missing from
 * the map — which defaults to 'not_built', i.e. "Coming soon".
 *
 * THE PROPERTY: every retail SKU a feature page puts a price on (paid or the
 * paid half of free-plus) has the build status 'live'. The feature page is the
 * stronger claim — it carries the buy button — so it is the one the map must
 * agree with. If a feature is genuinely not sellable yet, take its price off
 * the feature page; do not chip it here.
 *
 * `inactiveRowsArePrices` entries name tier rows that are PRICE SOURCES only
 * (Setnayan AI's B/C/D are `is_active = false`; the sellable door is the first
 * code), so only the first code is the thing sold.
 *
 * MUTATION: set LIVE_STUDIO back to 'partial' in BUILD_STATUS → this fails.
 */

function soldCodes(): Array<{ slug: string; code: string }> {
  const out: Array<{ slug: string; code: string }> = [];
  for (const f of FEATURE_PAGES) {
    const p = f.price;
    if (p.kind === 'free' || p.catalogue !== 'retail') continue;
    const codes = p.inactiveRowsArePrices ? p.codes.slice(0, 1) : p.codes;
    for (const code of codes) out.push({ slug: f.slug, code });
  }
  return out;
}

test('the guard reads real feature pages — not an empty registry', () => {
  const sold = soldCodes();
  assert.ok(sold.length >= 5, `only ${sold.length} sold SKU(s) found on the feature pages — has the registry moved?`);
  assert.ok(
    sold.some((s) => s.code === 'LIVE_STUDIO'),
    'Live Watch (LIVE_STUDIO) is no longer sold on a feature page — re-point this guard at the row it was written for',
  );
});

test('every SKU a feature page sells is chipped Live on /pricing (B7)', () => {
  const bad = soldCodes()
    .map((s) => ({ ...s, status: customerSkuBuildStatus(s.code) }))
    .filter((s) => s.status !== 'live')
    .map((s) => `/features/${s.slug} sells ${s.code}, which /pricing chips "${s.status === 'partial' ? 'In build' : 'Coming soon'}"`);
  assert.deepEqual(
    bad,
    [],
    'A feature page sells what /pricing calls unfinished:\n  ' + bad.join('\n  ') +
      '\nIf it ships, set it to \'live\' in BUILD_STATUS (lib/v2-catalog.ts). If it does not, take the price off the feature page.',
  );
});
