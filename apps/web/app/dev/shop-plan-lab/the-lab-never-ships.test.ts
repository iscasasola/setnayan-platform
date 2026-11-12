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

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const DRAWING = stripComments(readFileSync(join(HERE, '../../v/[slug]/_components/sample-shop-page.tsx'), 'utf8'));

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
  assert.match(DRAWING, /from '@\/lib\/shop-page-plan';/);
  assert.match(DRAWING, /from '@\/lib\/vendor-tier-caps';/);
  assert.match(DRAWING, /<ShopReachMap reach=\{d\.reach\}/);
  assert.match(DRAWING, /<ShopAddresses setnayanAddress=/);
});

test('the /for-suppliers plan cards draw NO branches — an open owner question (ruling 5735)', () => {
  const front = stripComments(readFileSync(join(HERE, '../../for-suppliers/_components/supplier-front-page.tsx'), 'utf8'));
  assert.match(front, /<SampleShopPage plan=\{plan\} \/>/, 'the plan card no longer mounts the sample drawing bare');
  assert.doesNotMatch(front, /branchCities/, 'the plan cards now draw branches — that needs the owner first');
});
