/** FINAL CHECK A1-124: every link on a shop's own domain opens its screen. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { customDomainShopPath } from './custom-domain-shop-path';
import { stripComments } from './strip-comments';

const T = '/v/liwanag';

test("the shop's own root-path links lose the repeated name", () => {
  assert.equal(customDomainShopPath(T, '/'), T);
  assert.equal(customDomainShopPath(T, '/liwanag'), T);
  assert.equal(customDomainShopPath(T, '/Liwanag'), T);
  assert.equal(customDomainShopPath(T, '/liwanag/story/ana-and-ben'), '/v/liwanag/story/ana-and-ben');
});

test('sub-pages from the domain root stay under the shop', () => {
  assert.equal(customDomainShopPath(T, '/story/ana-and-ben'), '/v/liwanag/story/ana-and-ben');
  assert.equal(customDomainShopPath(T, '/dates'), '/v/liwanag/dates');
});

test('every other path is a real route and routes normally', () => {
  assert.equal(customDomainShopPath(T, '/another-shop'), null);
  assert.equal(customDomainShopPath(T, '/login'), null);
  assert.equal(customDomainShopPath(T, '/liwanagx'), null);
  assert.equal(customDomainShopPath('/u/ana', '/x'), null);
});

test('🔒 the middleware asks the helper, never prefixes every path', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8'));
  assert.match(src, /customDomainShopPath\(target, pathname\)/);
  assert.doesNotMatch(src, /rewrite\.pathname = `\$\{target\}\$\{pathname\}`/);
});
