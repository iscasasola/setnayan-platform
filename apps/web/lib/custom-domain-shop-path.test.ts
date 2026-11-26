/** FINAL CHECK A1-124: every link on a shop's own domain opens its screen. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { customDomainShopPath, setnayanAddressFor } from './custom-domain-shop-path';
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

test('every other path is not the shop’s, and leaves the shop’s domain for Setnayan’s own', () => {
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

test('🔒 sign-in, the dashboard and other shops are redirected to setnayan.com, never served on the shop’s domain', () => {
  assert.equal(setnayanAddressFor('/login', '?next=%2F'), 'https://www.setnayan.com/login?next=%2F');
  assert.equal(setnayanAddressFor('/dashboard', ''), 'https://www.setnayan.com/dashboard');
  const src = stripComments(readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8'));
  const branch = src.slice(src.indexOf("if (target.startsWith('/v/'))"));
  assert.match(
    branch.slice(0, 1500),
    /if \(internalShopPath\) \{[\s\S]{0,120}return NextResponse\.rewrite\(rewrite\);\s*\}\s*return NextResponse\.redirect\(setnayanAddressFor\(pathname, request\.nextUrl\.search\), 307\);/,
    'a non-shop path on a shop’s own domain falls through again (a sign-in under the supplier’s domain)',
  );
});
