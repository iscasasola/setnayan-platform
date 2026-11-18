/**
 * W1-B21 (supplier walk, 16 Nov 2026): "Start on Plus / Pro / Ultra" on /for-suppliers all went to a bare /open-shop and
 * the plan was lost. The buttons now carry `?plan=`, the reading side whitelists it, and the plan sheet opens that
 * plan's row (its existing "Upgrade to …" offer).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openShopWithPlanHref,
  parseSupplierPlan,
  planOfferPath,
  supplierPlanQueryOf,
  supplierPlanTier,
} from './supplier-plan-offer';
import { TIER_LABEL } from './vendor-tier-caps';

test('?plan= is whitelisted to plus · pro · ultra', () => {
  assert.equal(parseSupplierPlan('plus'), 'plus');
  assert.equal(parseSupplierPlan(' PRO '), 'pro');
  assert.equal(parseSupplierPlan('ultra'), 'ultra');
  for (const bad of [undefined, null, '', 'free', 'solo', 'enterprise', 'verified', 'pro#x', ['pro'], 3]) {
    assert.equal(parseSupplierPlan(bad), null, `${JSON.stringify(bad)} must read as no plan`);
  }
});

test('each public word maps to the tier whose label it is', () => {
  for (const [q, tier] of [['plus', 'solo'], ['pro', 'pro'], ['ultra', 'enterprise']] as const) {
    assert.equal(supplierPlanTier(q), tier);
    assert.equal(TIER_LABEL[tier].toLowerCase(), q, 'the word on the button is the plan the sheet names');
    assert.equal(supplierPlanQueryOf(tier), q);
    assert.equal(openShopWithPlanHref(tier), `/open-shop?plan=${q}`);
  }
  assert.equal(supplierPlanTier('nope'), null);
});

test('the landing after opening is the plan sheet with that row anchored, never an open redirect', () => {
  assert.equal(planOfferPath('pro'), '/vendor-dashboard/subscription?plan=pro#plan-sheet-pro');
  assert.equal(planOfferPath('ultra'), '/vendor-dashboard/subscription?plan=ultra#plan-sheet-enterprise');
  assert.equal(planOfferPath('//evil.example'), null);
  assert.equal(planOfferPath(undefined), null);
});

test('/for-suppliers paid-plan buttons carry the plan; the picker uses each card’s own door', () => {
  const front = readFileSync('app/for-suppliers/_components/supplier-front-page.tsx', 'utf8');
  const grow = front.slice(front.indexOf('...GROW_TIERS.map('), front.indexOf('const fold = foldGroups()'));
  assert.match(grow, /cta: `Start on \$\{growName\(t\)\}`/, 'anti-vacuity: the Grow cards moved');
  assert.match(grow, /href: openShopWithPlanHref\(t\)/, 'a "Start on <plan>" card is back to a bare /open-shop');
  const client = readFileSync('app/for-suppliers/_components/supplier-front-client.tsx', 'utf8');
  assert.match(client, /s\.pickCta\}`\} href=\{c\.href \?\? href\}/, 'the picker ignores the card’s own door');
});

test('the plan sheet opens the offered plan’s row', () => {
  const screen = readFileSync('app/vendor-dashboard/subscription/_components/plan-screen.tsx', 'utf8');
  assert.match(screen, /offer=\{supplierPlanTier\(search\.plan\)\}/);
  const sheet = readFileSync('app/vendor-dashboard/subscription/_components/plan-sheet.tsx', 'utf8');
  assert.match(sheet, /defaultOpen=\{isCurrent \|\| p\.key === offer\}/);
  assert.match(sheet, /anchor=\{`plan-sheet-\$\{p\.key\}`\}/, 'planOfferPath’s #plan-sheet-<tier> no longer has a target');
});
