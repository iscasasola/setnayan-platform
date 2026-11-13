/**
 * /dev/shop-plan-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL shop
 * page pieces and decides them with the page's own rules, not copies. Since ruling 5735 (13 Nov 2026) the lab draws
 * them through `SampleShopPage`, the one drawing /for-suppliers also scales into its plan-card miniatures — so the
 * "real pieces, real rules" assertions now read that file, and the lab must mount it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { shopAlsoInLine } from '@/lib/shop-page-plan';
import { tierCaps } from '@/lib/vendor-tier-caps';
import {
  SAMPLE_BRANCH_CITIES,
  SAMPLE_SHOP_PLAN_TIER,
  SAMPLE_SHOP_PLANS,
  samplePlanBranchCities,
} from '@/app/v/[slug]/_components/sample-shop-plan';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const DRAWING = stripComments(readFileSync(join(HERE, '../../v/[slug]/_components/sample-shop-page.tsx'), 'utf8'));
/** The drawing's pure plan rules (split out 13 Nov 2026 so tests read them without the page's CSS). */
const RULES = stripComments(readFileSync(join(HERE, '../../v/[slug]/_components/sample-shop-plan.ts'), 'utf8'));

test('the shop plan lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopPlanLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the one sample drawing', () => {
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/sample-shop-page';/);
  assert.match(LAB, /<SampleShopPage plan=\{plan\}/);
  assert.match(LAB, /branchCities=\{branchCities\}/, 'the lab no longer hands the drawing its branches (PR #7561)');
});

test('the drawing mounts the real plan pieces and the real rules', () => {
  assert.match(DRAWING, /from '\.\/shop-reach';/);
  assert.match(DRAWING, /from '\.\/shop-addresses';/);
  assert.match(DRAWING, /from '\.\/shop-branches-line';/);
  assert.match(DRAWING, /from '\.\/pinned-review-card';/);
  assert.match(DRAWING, /from '\.\/sample-shop-plan';/);
  assert.match(RULES, /from '@\/lib\/shop-page-plan';/);
  assert.match(RULES, /from '@\/lib\/vendor-tier-caps';/);
  assert.match(DRAWING, /<ShopReachMap reach=\{d\.reach\}/);
  assert.match(DRAWING, /<ShopAddresses setnayanAddress=/);
});

test('🔑 the /for-suppliers Pro and Ultra previews draw their branches — owner 13 Nov 2026, "Show the branches as needed"', () => {
  const front = stripComments(readFileSync(join(HERE, '../../for-suppliers/_components/supplier-front-page.tsx'), 'utf8'));
  // The plan card hands the drawing that plan's own branches — never a typed list, never none.
  assert.match(front, /<SampleShopPage plan=\{plan\} branchCities=\{samplePlanBranchCities\(plan\)\} \/>/);
  assert.doesNotMatch(front, /<SampleShopPage plan=\{plan\} \/>/, 'a plan card mounts the drawing without its branches');
  // The drawing draws them with the shipped line, the same one /v/[slug] renders.
  assert.match(DRAWING, /\{branchCities\.length > 0 \? <ShopBranchesLine cities=\{branchCities\} hqCity=\{SAMPLE\.city\} \/> : null\}/);

  // Executed: the count is each plan's own `branchesIncluded` — Pro and Ultra draw "Also in …", the rest draw nothing.
  for (const plan of SAMPLE_SHOP_PLANS) {
    const cities = samplePlanBranchCities(plan);
    const included = tierCaps(SAMPLE_SHOP_PLAN_TIER[plan]).branchesIncluded;
    assert.equal(cities.length, included, `${plan}: draws ${cities.length} branches, the plan includes ${included}`);
    const line = shopAlsoInLine(cities, 'Tagaytay');
    if (plan === 'pro' || plan === 'ultra') {
      assert.ok(included > 0, `${plan} includes no branches any more — re-read the owner's ruling`);
      assert.equal(line, `Also in ${cities.join(' · ')}`, `${plan}: the preview does not draw "Also in <city>"`);
    } else {
      assert.equal(line, null, `${plan}: a plan with no branches draws an "Also in" line`);
    }
  }
  // The sample has enough cities for the top plan — a shorter list would silently draw fewer than the plan includes.
  const most = Math.max(...SAMPLE_SHOP_PLANS.map((p) => tierCaps(SAMPLE_SHOP_PLAN_TIER[p]).branchesIncluded));
  assert.ok(SAMPLE_BRANCH_CITIES.length >= most, `the sample lists ${SAMPLE_BRANCH_CITIES.length} branch cities, a plan includes ${most}`);
  assert.ok(!SAMPLE_BRANCH_CITIES.some((c) => c.toLowerCase() === 'tagaytay'), 'a branch city is the HQ city, so the line would drop it');
});
