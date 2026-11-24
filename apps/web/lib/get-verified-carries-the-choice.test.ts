/**
 * ✅ "GET VERIFIED" CARRIES THE CHOICE (supplier re-walk of /for-suppliers on live, 24 Nov 2026; controller GO).
 *
 * Measured on live: the Verified plan card's "Get verified" opened a bare `/open-shop`, the same door as Free, so the
 * choice was dropped and nothing took the new shop to its papers. Paid plans already carried `?plan=` (W1-B21).
 *
 * Fails if:
 *   · the Verified card stops opening `/open-shop?plan=verified` (or Free stops opening the bare door);
 *   · `verified` stops being a plan word the wizard and the actions accept;
 *   · `supplierPlanTier('verified')` is anything but null (Verified is not a paid tier row);
 *   · a shop opened with it lands anywhere but the shop's EXISTING papers fold (`VERIFY_DOCS_HREF`);
 *   · a price rides on the Verified door.
 *
 * SABOTAGE (each seen red, restored): put `href: OPEN_SHOP` back for Verified · drop 'verified' from the keys ·
 * map verified to 'solo' in TIER_OF · land it on `/vendor-dashboard/verify`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OPEN_SHOP_VERIFIED_HREF,
  SUPPLIER_PLAN_QUERY_KEYS,
  VERIFY_PAPERS_PATH,
  parseSupplierPlan,
  planOfferPath,
  supplierPlanTier,
} from './supplier-plan-offer';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('the Verified card opens a shop carrying the choice; Free keeps the bare door', () => {
  const front = read('app/for-suppliers/_components/supplier-front-page.tsx');
  assert.match(front, /cta: t === 'free' \? CTA : 'Get verified', href: t === 'free' \? OPEN_SHOP : OPEN_SHOP_VERIFIED_HREF \}/);
  assert.equal(OPEN_SHOP_VERIFIED_HREF, '/open-shop?plan=verified');
  assert.doesNotMatch(OPEN_SHOP_VERIFIED_HREF, /₱|price|amount/i, 'no price rides on the Verified door');
});

test('verified is a plan word, but not a paid tier row', () => {
  assert.ok((SUPPLIER_PLAN_QUERY_KEYS as readonly string[]).includes('verified'));
  assert.equal(parseSupplierPlan('verified'), 'verified');
  assert.equal(parseSupplierPlan(' Verified '), 'verified');
  assert.equal(supplierPlanTier('verified'), null);
  // the paid plans are unchanged
  assert.equal(supplierPlanTier('plus'), 'solo');
  assert.equal(supplierPlanTier('ultra'), 'enterprise');
});

test('a shop opened with "Get verified" lands on its existing papers fold, the same place as Get verified everywhere', () => {
  assert.equal(planOfferPath('verified'), VERIFY_PAPERS_PATH);
  assert.equal(VERIFY_PAPERS_PATH, '/vendor-dashboard/profile#docs');
  const line = read('app/vendor-dashboard/_components/get-verified-line.tsx');
  const anchor = /export const VERIFY_DOCS_ANCHOR = '([^']+)';/.exec(line)?.[1];
  assert.ok(anchor, 'anti-vacuity: VERIFY_DOCS_ANCHOR moved');
  assert.match(line, /export const VERIFY_DOCS_HREF = `\/vendor-dashboard\/profile#\$\{VERIFY_DOCS_ANCHOR\}`;/);
  assert.equal(VERIFY_PAPERS_PATH, `/vendor-dashboard/profile#${anchor}`, 'the plan offer and Get verified point at two places');
  assert.notEqual(planOfferPath('verified'), '/vendor-dashboard/verify', 'never via the retired redirect');
});

test('the wizard and the actions carry the choice through the same reader', () => {
  const page = read('app/open-shop/page.tsx');
  assert.match(page, /plan=\{parseSupplierPlan\(plan\)\}/);
  const wizard = read('app/open-shop/_components/open-shop-wizard.tsx');
  assert.match(wizard, /\{plan \? <input type="hidden" name="plan" value=\{plan\} \/> : null\}/);
  const actions = read('app/open-shop/actions.ts');
  assert.match(actions, /parseSupplierPlan\(formData\.get\('plan'\)\)/);
  assert.match(actions, /planOfferPath\(plan\)/);
});
