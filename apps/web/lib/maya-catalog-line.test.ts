/**
 * ⭐ A COUPLE MUST NEVER PAY FOR A PRODUCT THAT NO LONGER EXISTS.
 *
 * `/api/v1/billing/initialize-maya` derived the line-item PRICE from the admin
 * catalog but the line-item TITLE from a hardcoded `TITLE_BOOK` that was never
 * demo-fenced — so the live Maya / manual-QR checkout printed `PAPIC_SEATS` as
 * "Papic Professional 5 Seats Pass", a retired product, on the payment line the
 * couple sees and the reference an admin reconciles against.
 *
 * Two things are pinned here:
 *   1. the pure fail-closed rule — a row is billable only with BOTH a real
 *      title and a real price, and we never prettify a service_code into a name;
 *   2. that the route keeps reading the title from the same row as the price,
 *      with the hardcoded book reachable only behind DEMO_MODE.
 *
 * Its own file on purpose: a brand-new test file cannot conflict with a
 * concurrent PR, the same reason `changelog.d/` fragments are per-PR files.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogLineFromRow } from './maya-catalog-line';

const HERE = dirname(fileURLToPath(import.meta.url));
const routeSrc = () =>
  readFileSync(
    resolve(HERE, '..', 'app/api/v1/billing/initialize-maya/route.ts'),
    'utf8',
  );

// ── the pure rule ───────────────────────────────────────────────────────────

test('a real catalog row bills its own title and its own price', () => {
  assert.deepEqual(
    catalogLineFromRow({ title: 'Papic Pool 3,000 points', retail_price_php: 1000 }),
    { title: 'Papic Pool 3,000 points', price: 1000 },
  );
});

test('NUMERIC arrives as a string from the driver and still bills', () => {
  assert.deepEqual(
    catalogLineFromRow({ title: 'Animated Monogram Maker', retail_price_php: '2499.00' }),
    { title: 'Animated Monogram Maker', price: 2499 },
  );
});

test('a titleless row is REFUSED, never prettified into a product name', () => {
  // The whole point of the fix: no fallback to `PAPIC_SEATS`.replace(/_/g,' ')
  // and no fallback to a hardcoded book — a nameless row is not sellable.
  assert.equal(catalogLineFromRow({ retail_price_php: 2999 }), null);
  assert.equal(catalogLineFromRow({ title: '', retail_price_php: 2999 }), null);
  assert.equal(catalogLineFromRow({ title: '   ', retail_price_php: 2999 }), null);
  assert.equal(catalogLineFromRow({ title: null, retail_price_php: 2999 }), null);
});

test('an unreadable catalog fails closed rather than billing something', () => {
  assert.equal(catalogLineFromRow(null), null);
  assert.equal(catalogLineFromRow(undefined), null);
});

test('a priceless / ₱0 / non-numeric row is refused', () => {
  assert.equal(catalogLineFromRow({ title: 'Papic Guest' }), null);
  assert.equal(catalogLineFromRow({ title: 'Papic Guest', retail_price_php: 0 }), null);
  // Previously a garbage price flowed through as NaN and rendered "NaN" in the
  // Maya payload — NaN <= 0 is false, so the empty-order guard let it past.
  assert.equal(catalogLineFromRow({ title: 'Papic Guest', retail_price_php: 'free' }), null);
});

test('titles are trimmed, so admin whitespace never lands on a receipt', () => {
  assert.deepEqual(
    catalogLineFromRow({ title: '  Live Studio  ', retail_price_php: 2999 }),
    { title: 'Live Studio', price: 2999 },
  );
});

// ── the route keeps using it ─────────────────────────────────────────────────

test('both catalog reads select the title alongside the price', () => {
  const src = routeSrc();
  const selects = [...src.matchAll(/\.select\('title, retail_price_php'\)/g)];
  assert.equal(
    selects.length,
    2,
    'the SKU read and the bundle read must each pull title from the priced row',
  );
});

test('the hardcoded title book is read ONLY from the demo-only helper', () => {
  const src = routeSrc();
  const helper = /function demoLine\([\s\S]*?\n}\n/.exec(src);
  assert.ok(helper, 'demoLine() is gone — re-check where TITLE_BOOK is read');
  const outsideHelper = src.replace(helper[0], '');
  assert.equal(
    [...outsideHelper.matchAll(/TITLE_BOOK\s*\[/g)].length,
    0,
    'TITLE_BOOK is read outside demoLine — a retired name can reach a real charge again',
  );
});

test('demoLine is unreachable on a real charge', () => {
  const src = routeSrc();
  const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);
  const callSites = src
    .split('\n')
    .filter(
      (line) =>
        line.includes('demoLine(') &&
        !line.includes('function demoLine(') &&
        !isComment(line),
    );
  assert.ok(callSites.length >= 2, 'expected the SKU + bundle demo branches');
  for (const line of callSites) {
    assert.match(
      line,
      /DEMO_MODE/,
      `demoLine() called outside a DEMO_MODE fence: ${line.trim()}`,
    );
  }
});
