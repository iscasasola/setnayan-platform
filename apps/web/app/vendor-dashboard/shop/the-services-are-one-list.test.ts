/**
 * 🔒 SHOP › YOUR SERVICES IS ONE LIST (Build 3 Lane E items 5–7; owner 9 Nov).
 *   1 · No Coverage · Service cards · Tools picker (`ManagerTabs` is gone) — *"They are all services"*.
 *   2 · Bundles FIRST, then the cards grouped Group › Category (the one taxonomy's path, never typed).
 *   3 · ONE add control with exactly two choices — New bundle · New service — in the head and in the thumb row; no
 *       "Add a service or coverage" dropdown, no "+ Add a service" link.
 *   4 · The head compresses into one sticky row, on the house 0.7 s motion token (no hand-typed duration).
 *   5 · Every tool the old Tools view held keeps a home (the ledger is the PR's; here: none is left drawn on this page).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SUPPLIER = join(process.cwd(), 'app/vendor-dashboard');
const read = (rel: string) => stripComments(readFileSync(join(SUPPLIER, rel), 'utf8'));
const MANAGER = read('services/_components/services-manager.tsx');
const PAGE = read('shop/page.tsx');
const HEAD = read('shop/_components/shop-services-head.tsx');
const THUMB = read('shop/_components/shop-services-thumb.tsx');

test('1 · no section picker — one list', () => {
  assert.ok(!existsSync(join(SUPPLIER, 'services/_components/manager-tabs.tsx')), 'the Coverage · Service cards · Tools picker is back');
  assert.doesNotMatch(MANAGER, /<ManagerTabs\b|label: 'Coverage'|label: 'Tools'|label: 'Service cards'/);
  assert.doesNotMatch(MANAGER, /specialistToolsForCategories|Specialist tools/, 'the per-shop Tools view is back on Shop');
});

test('2 · bundles first, then services grouped Group › Category', () => {
  const at = (re: RegExp) => PAGE.search(re);
  assert.ok(at(/<ShopServicesHead\b/) < at(/<ShopBundles\b/) && at(/<ShopBundles\b/) < at(/<VendorServicesManager\b/), 'bundles do not come first');
  assert.match(MANAGER, /const groupLabelOf = /);
  assert.match(MANAGER, /coverageLabels\.pathLabel\(/, 'the group is not read from the one taxonomy');
  assert.match(MANAGER, /data-shop-card-group-label=""/);
});

test('3 · one add control: New bundle · New service — nothing else', () => {
  assert.match(HEAD, /label: 'New bundle'/);
  assert.match(HEAD, /label: 'New service'/);
  assert.match(THUMB, /addChoices\(bundlesOn\)/, 'the thumb row’s ＋ is not the same two choices');
  assert.doesNotMatch(MANAGER + PAGE, /Add a service or coverage|data-shop-add-service=""/, 'the old add doors are back');
  assert.doesNotMatch(MANAGER, />\s*Add a service\s*</, 'the "+ Add a service" link is back in the list');
});

test('4 · the head compresses into one sticky row on the house motion', () => {
  assert.match(HEAD, /sticky top-11/);
  assert.match(HEAD, /data-shop-services-head=\{stuck \? 'compact' : 'full'\}/);
  assert.match(HEAD, /var\(--sn-pill-dur\) var\(--sn-pill-spring\)/);
  assert.doesNotMatch(HEAD, /\b\d{3,4}ms\b/, 'a hand-typed duration');
});

test('5 · the services list draws its "Tools on every event" line, and the Tools view is gone', () => {
  assert.match(MANAGER, /Tools on every event · /);
  assert.match(PAGE, /toolsByCoverage=\{toolsByCoverage\(data\)\}/);
});
