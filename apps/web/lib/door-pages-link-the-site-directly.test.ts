/**
 * door-pages-link-the-site-directly.test.ts — re-walk on live 307925d, 24 Nov, fault 5 (controller GO).
 *
 * /for-suppliers is also supplier.setnayan.com's front page and /for-coordinators is coordinator.setnayan.com's. On a
 * door host a relative "/open-shop" is a 308 to the site before the page loads (~0.25 s measured). Every open-shop
 * link on those two pages is ABSOLUTE, built by `onSiteHref` from `siteOrigin()` and the door map's
 * `doorOpenShopHref`, so the coordinator door keeps `?as=coordinator` and each plan keeps its `?plan=`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { doorOpenShopHref, onSiteHref } from '@/lib/doors';
import { OPEN_SHOP_VERIFIED_HREF, openShopWithPlanHref } from '@/lib/supplier-plan-offer';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('onSiteHref: the site origin plus the path, query kept, one slash', () => {
  assert.equal(onSiteHref(doorOpenShopHref('supplier'), 'https://www.setnayan.com'), 'https://www.setnayan.com/open-shop');
  assert.equal(onSiteHref(doorOpenShopHref('coordinator'), 'https://www.setnayan.com/'), 'https://www.setnayan.com/open-shop?as=coordinator');
  assert.equal(onSiteHref(OPEN_SHOP_VERIFIED_HREF, 'https://www.setnayan.com'), 'https://www.setnayan.com/open-shop?plan=verified');
  assert.equal(onSiteHref(openShopWithPlanHref('pro'), 'https://www.setnayan.com'), `https://www.setnayan.com${openShopWithPlanHref('pro')}`);
});

test('the supplier door page: every open-shop link is absolute', () => {
  const page = read('app/for-suppliers/_components/supplier-front-page.tsx');
  assert.match(page, /const SITE = siteOrigin\(\);/);
  assert.match(page, /const OPEN_SHOP = onSiteHref\(doorOpenShopHref\('supplier'\), SITE\);/);
  assert.match(page, /onSiteHref\(OPEN_SHOP_VERIFIED_HREF, SITE\)/, 'Get verified opens the shop set-up through a 308');
  assert.match(page, /onSiteHref\(openShopWithPlanHref\(t\), SITE\)/, 'a paid plan opens the shop set-up through a 308');
  assert.doesNotMatch(page, /['"`]\/open-shop/, 'a relative /open-shop is back on the door page');
  assert.doesNotMatch(page, /href: (?:OPEN_SHOP_VERIFIED_HREF|openShopWithPlanHref\(t\))\b/, 'a plan card links a relative path');
});

test('the coordinator door page: Start keeps ?as=coordinator and is absolute', () => {
  const page = read('app/(shell)/for-coordinators/page.tsx');
  assert.match(page, /const START = onSiteHref\(doorOpenShopHref\('coordinator'\), siteOrigin\(\)\);/);
  assert.doesNotMatch(page, /['"`]\/open-shop/, 'a relative /open-shop is back on the coordinator door page');
  assert.ok((page.match(/href=\{START\}/g) ?? []).length >= 1, 'anti-vacuity: no Start link reads START');
});
