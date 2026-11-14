import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEATURE_PAGES, featurePage } from '@/lib/feature-pages';
import { resolveFeaturePrice, featurePriceLabel, type CatalogueRow } from '@/lib/feature-pages/price';
import { COUPLE_WEBSITE_PRO_SERVICE_KEY } from '@/lib/couple-website-pro';
import { EVENT_ULTRA_SKU } from '@/lib/event-ultra';
import { customerSkuBuildStatus } from '@/lib/v2-catalog';

/**
 * /features/setnayan-ai IS PRICED BY THE PLANS THAT CARRY IT — NEVER BY AN OFF-SALE ROW (RW-149, W1 re-walk 2026-11-14).
 *
 * The page read "Price From ₱265" — `SETNAYAN_AI_D`, a tier of the AI ladder the 2026-11-04 final price sheet took off
 * sale (migration 20271308555594_the_final_price_sheet refuses to finish while any SETNAYAN_AI* row is active). Setnayan
 * AI is not sold on its own: it comes inside Event Plus, Event Pro and Event Ultra (`AI_INCLUDED_PLAN_SKUS`,
 * lib/sku-activation.ts). So the page names those three and quotes "From" the cheapest of their ACTIVE rows.
 *
 * SABOTAGE (each turns this red): put the SETNAYAN_AI codes back · set `inactiveRowsArePrices` on any page · drop
 * EVENT_ULTRA from the codes or the copy · add a fourth plan to AI_INCLUDED_PLAN_SKUS without pricing the page by it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

/** AI_INCLUDED_PLAN_SKUS, read from source — lib/sku-activation.ts is server code a node test cannot import. */
function aiIncludedPlanSkus(): string[] {
  const src = readFileSync(join(WEB, 'lib', 'sku-activation.ts'), 'utf8');
  const m = src.match(/export const AI_INCLUDED_PLAN_SKUS[^=]*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'AI_INCLUDED_PLAN_SKUS moved — re-point this guard');
  const names: Record<string, string> = {
    COUPLE_WEBSITE_PRO_SERVICE_KEY,
    EVENT_ULTRA_SKU,
  };
  return m[1]!
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("'") ? t.slice(1, -1) : names[t] ?? `?${t}`));
}

const ai = () => {
  const f = featurePage('setnayan-ai');
  assert.ok(f, 'the setnayan-ai page is gone — re-point this guard');
  return f;
};

test('the page is priced by exactly the plans that carry Setnayan AI', () => {
  const f = ai();
  assert.notEqual(f.price.kind, 'free');
  if (f.price.kind === 'free') return;
  assert.equal(f.price.catalogue, 'retail');
  assert.deepEqual([...f.price.codes].sort(), aiIncludedPlanSkus().sort());
  assert.ok(!f.price.codes.some((c) => c.startsWith('SETNAYAN_AI')), 'a Setnayan AI tier row prices the page again');
});

test('no feature page reads an off-sale row as a public price', () => {
  for (const f of FEATURE_PAGES) {
    if (f.price.kind === 'free') continue;
    assert.ok(!f.price.inactiveRowsArePrices, `${f.slug} reads inactive catalogue rows as its price`);
  }
});

test('an inactive, cheaper AI tier can never become the "From" price', () => {
  const rows: CatalogueRow[] = [
    { catalogue: 'retail', code: 'SETNAYAN_AI_D', php: 265, period: 'one_time', active: false },
    { catalogue: 'retail', code: 'EVENT_PLUS', php: 2990, period: 'one_time', active: true },
    { catalogue: 'retail', code: 'COUPLE_WEBSITE_PRO', php: 5690, period: 'one_time', active: true },
    { catalogue: 'retail', code: 'EVENT_ULTRA', php: 9990, period: 'one_time', active: true },
  ];
  const p = resolveFeaturePrice(ai().price, rows);
  assert.equal(p.kind, 'paid');
  if (p.kind !== 'paid') return;
  assert.equal(p.lowPhp, 2990, 'the cheapest ACTIVE plan is the "From"');
  assert.equal(featurePriceLabel(p, 'en'), 'From ₱2,990');
});

test('the words name all three plans, in both languages, and never sell an unlock of its own', () => {
  const f = ai();
  for (const l of ['en', 'tl'] as const) {
    const text = [f.answer[l], ...f.steps[l], ...f.faq[l].map((x) => `${x.q} ${x.a}`)].join(' ');
    for (const plan of ['Event Plus', 'Event Pro', 'Event Ultra']) {
      assert.ok(text.includes(plan), `${l}: the page does not name ${plan}`);
    }
    assert.doesNotMatch(text, /depends on the type of event|nakadepende ang presyo sa uri ng event/i);
    assert.doesNotMatch(text, /One unlock covers|Isang unlock para sa buong event/i);
  }
});

test('/pricing calls every plan that carries the AI live — never a PreOrder', () => {
  for (const sku of aiIncludedPlanSkus()) assert.equal(customerSkuBuildStatus(sku), 'live', `${sku} is not 'live' in BUILD_STATUS`);
});
