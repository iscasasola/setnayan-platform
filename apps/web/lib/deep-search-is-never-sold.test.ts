/**
 * 🔒 DEEP SEARCH IS NEVER SOLD PER SEARCH AGAIN — it is INCLUDED, monthly, on Plus · Pro · Ultra.
 *
 * ⚖ DECISION_LOG 2026-11-22: ✂️ "DEEP SEARCH IS RETIRED — 'NO ADD-ONS' MEANS NONE" (owner, verbatim: *"Retire it"*) ·
 * 🧰✅ "SPECIAL TOOLS STAY INSIDE THE PLANS" · 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH" (*"Deep Search 1 a month"*).
 * Measured 24 Nov: the ₱499 row still on sale, /llms.txt saying "Deep Search ₱499 a search", /features calling it Paid.
 *
 * THE PROPERTY — every way a per-search sale could come back fails here:
 *   1 · the run action mints no order and no payment, reads no price and sends nobody to a payment page;
 *   2 · nothing can price it: no add-on band row, no price reader, no fallback figure exported;
 *   3 · the SKU code is named only where an order bought BEFORE the retirement is approved and run;
 *   4 · every public line — the plan table (and so /llms.txt), /for-suppliers' line, /features, the Plans page row, the
 *       card's ⓘ and the runner — prints no peso and no "a search" / "per search" price words;
 *   5 · no migration after the retirement puts the row back on sale;
 *   6 · the allowance is the admin's (platform_settings), read — never a typed count — and Free/Verified get none.
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-24): `requested_total_php` put back into the run action (red: 1) ·
 *   `deep_search_about_you` put back in the band map (red: 2) · a "₱499 a search" cell in the plan table (red: 4) ·
 *   `price: 'paid'` on /features' C30 (red: 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import * as addon from '@/lib/vendor-deep-search-addon';
import { VENDOR_ADDON_BAND_SKU_CODES } from '@/lib/vendor-addon-tier-pricing';
import { planTable, TABLE_TIERS } from '@/app/for-suppliers/_components/plan-table-data';
import { buyMoreLine } from '@/app/for-suppliers/_components/supplier-front-data';
import { FEATURE_ROWS, PRICE_WORDS } from '@/lib/features-page';
import { deepSearchAllowanceWords } from '@/lib/deep-search-findings';
import { renderLlmsTxt } from '@/lib/llms-txt';
import { INPUT_FOR_GUARDS } from '@/lib/llms-txt-guard-input';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ACTION = 'app/vendor-dashboard/deep-search/actions.ts';

/** Price words a per-search sale would need. */
const SALE = /₱|\bper[- ]search\b|\ba search\b|\bone search per purchase\b|\bpayPath\b/i;

test('1 · the run action sells nothing: no order, no payment, no price, no payment page', () => {
  const s = code(ACTION);
  for (const [re, why] of [
    [/\.from\('orders'\)/, 'it writes an order'],
    [/\.from\('payments'\)/, 'it writes a payment'],
    [/vendor_billing_catalog/, 'it reads a price row'],
    [/requested_total_php|amount_php|pricePhp/, 'it carries an amount'],
    [/payPath|railForNewOrder|createMoneyWriterClient/, 'it sends the shop to pay'],
    [/VENDOR_DEEP_SEARCH_SKU_CODE|service_key/, 'it names the retired SKU as a service'],
  ] as const) {
    assert.doesNotMatch(s, re, `the Deep Search run action ${why} — Deep Search is never sold per search (owner 2026-11-22)`);
  }
  // …and it runs through the month's claim, nothing else.
  assert.match(s, /claimIncludedDeepSearchRun\(admin,/, 'the run no longer claims one of the month’s included runs');
  assert.match(s, /fetchDeepSearchRunsPerMonth\(admin\)/, 'the run no longer reads the admin’s allowance');
});

test('2 · nothing can price it — no band row, no price reader, no fallback figure', () => {
  assert.equal('deep_search_about_you' in VENDOR_ADDON_BAND_SKU_CODES, false, 'Deep Search has a price row in the band map again');
  for (const gone of ['VENDOR_DEEP_SEARCH_FALLBACK_PHP', 'resolveDeepSearchPricePhp', 'fetchVendorDeepSearchPricePhp']) {
    assert.equal(gone in addon, false, `${gone} is exported again — a Deep Search price is back`);
  }
});

test('3 · the retired SKU is named only where an order bought before 2026-11-24 still runs', () => {
  const ALLOWED = new Set([
    'lib/vendor-deep-search-addon.ts', // the constant itself
    'lib/sku-activation.ts', // runs a search an order already paid for
    'app/admin/payments/actions.ts', // approving that order
  ]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' || rel === 'app/dev') continue;
        walk(rel);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$|\.lab\.tsx$|\.generated\./.test(e.name)) {
        if (!ALLOWED.has(rel) && /VENDOR_DEEP_SEARCH_SKU_CODE/.test(code(rel))) hits.push(rel);
      }
    }
  };
  walk('app');
  walk('lib');
  walk('components');
  assert.deepEqual(hits, [], `the retired Deep Search SKU is used outside the paid-before path:\n  ${hits.join('\n  ')}`);
});

test('4 · every public line says "included", never a price', () => {
  // The plan table (/for-suppliers and /llms.txt), with a catalogue that STILL holds the retired row at a price.
  const prices = { monthly: {}, bySku: { vendor_deep_search: '₱499' } };
  for (const runs of [1, 3, null, undefined]) {
    const g = planTable({ paywallOn: false, prices, deepSearchRunsPerMonth: runs });
    const row = g.flatMap((x) => x.rows).find((r) => /deep search/i.test(r.label));
    assert.ok(row, 'the plan table has no Deep Search row');
    for (const t of TABLE_TIERS) assert.doesNotMatch(row.cells[t].text, SALE, `the plan table sells Deep Search on ${t}: "${row.cells[t].text}"`);
    assert.equal(row.cells.free.kind, 'no', 'Free is given Deep Search runs (owner: Free/Verified get none)');
  }
  // /llms.txt, end to end, with the retired row in its catalogue.
  const txt = renderLlmsTxt({
    ...INPUT_FOR_GUARDS,
    vendor: [...INPUT_FOR_GUARDS.vendor, { sku_code: 'vendor_deep_search', title: 'Deep Search', price_php: 499, is_active: true }],
    deepSearchRunsPerMonth: 1,
  });
  for (const line of txt.split('\n').filter((l) => /deep search/i.test(l))) {
    assert.doesNotMatch(line, SALE, `/llms.txt sells Deep Search: ${line}`);
  }
  // /for-suppliers' line, the card's ⓘ and the Plans page row (one source of words).
  for (const n of [1, 2, null]) {
    assert.doesNotMatch(buyMoreLine(n), SALE, `/for-suppliers sells Deep Search: ${buyMoreLine(n)}`);
    assert.doesNotMatch(deepSearchAllowanceWords(n), SALE, `the allowance words sell Deep Search: ${deepSearchAllowanceWords(n)}`);
  }
  // /features: C30 is inside the plans, not "Paid".
  assert.equal(FEATURE_ROWS.c30.name, 'Deep Search');
  assert.equal(FEATURE_ROWS.c30.price, 'in-plans', '/features calls Deep Search Paid again');
  assert.doesNotMatch(PRICE_WORDS[FEATURE_ROWS.c30.price], SALE);
  // The supplier surfaces: no peso, no rails, no price read.
  for (const rel of [
    'app/vendor-dashboard/deep-search/_components/deep-search-runner.tsx',
    'app/vendor-dashboard/deep-search/page.tsx',
    'app/vendor-dashboard/profile/_components/deep-search-card.tsx',
    'lib/vendor-deep-search-offer.ts',
  ]) {
    const s = code(rel);
    assert.doesNotMatch(s, /₱|openRails|ourAccountPhrase|fetchVendorAddonBandPrices|vendor_billing_catalog/, `${rel} prices or takes payment for Deep Search`);
  }
  assert.doesNotMatch(code('app/vendor-dashboard/subscription/_components/plan-screen.tsx'), /'deep_search_about_you'/, 'the Plans page prices Deep Search again');
});

test('5 · no migration after the retirement puts the per-search row back on sale', () => {
  const dir = join(WEB, '../../supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const at = files.findIndex((f) => f.endsWith('_deep_search_sale_retired_monthly_allowance.sql'));
  assert.ok(at >= 0, 'the retirement migration is missing');
  const retire = readFileSync(join(dir, files[at]!), 'utf8');
  assert.match(retire, /SET is_active\s+= FALSE[\s\S]*?WHERE sku_code = 'vendor_deep_search';/, 'the retirement no longer takes the row off sale');
  for (const f of files.slice(at + 1)) {
    const sql = readFileSync(join(dir, f), 'utf8').replace(/--.*$/gm, '');
    for (const stmt of sql.split(';').filter((x) => /'vendor_deep_search'/.test(x))) {
      assert.doesNotMatch(stmt, /is_active\s*=\s*TRUE|INSERT\s+INTO\s+public\.vendor_billing_catalog/i, `${f} sells Deep Search per search again`);
    }
  }
});

test('6 · the allowance is the admin’s and only the paid plans get it', () => {
  // Free and Verified get none — whatever the paywall switch says (it is an allowance a plan includes, not a paywall).
  for (const tier of ['free', 'verified', null, 'garbage']) {
    assert.equal(addon.deepSearchIncluded(tier), false, `${String(tier)} is given Deep Search runs`);
    assert.deepEqual(addon.deepSearchEligibility({ tier, verification: 'verified' }), { ok: false, reason: 'tier_too_low' });
  }
  for (const tier of ['solo', 'pro', 'enterprise']) assert.equal(addon.deepSearchIncluded(tier), true, tier);
  // No typed count: the run and the surfaces read platform_settings.
  assert.match(code('lib/vendor-deep-search-addon.ts'), /\.from\('platform_settings'\)\s*\.select\('deep_search_runs_per_month'\)/);
  assert.match(code('app/admin/settings/actions.ts'), /\['deep_search_runs_per_month', '[^']+', 31\]/, 'the admin cannot set the allowance');
  assert.match(code('app/admin/settings/_surfaces/settings-surface.tsx'), /name="deep_search_runs_per_month"[\s\S]{0,120}disabled=\{!deepSearchRuns\.read\}/, 'the admin field is missing or not locked when unread');
  // Not set = no run; unused runs never carry over (the count is this month's only).
  assert.equal(addon.deepSearchRunsLeft(null, 0), 0);
  assert.equal(addon.deepSearchRunsLeft(1, 0), 1);
  assert.equal(addon.deepSearchRunsLeft(1, 1), 0);
  assert.equal(addon.deepSearchRunsLeft(1, 5), 0);
});
