/**
 * GUARD — SHOP ON A COMPUTER IS LAYOUT A, AND THE PHONE IS UNCHANGED (owner 16 Nov, DECISION_LOG "SUPPLIER DESKTOP MAIN
 * PAGES APPROVED", picks 3 · 4 · 5; P1 drawing `prototypes/supplier_desktop_main_2026-11-16/`).
 *
 *   1. One side column holds Analytics → Badges → Makers, in that order; the service list follows it inside one wrapper.
 *   2. Below 1280 both wrappers draw nothing (`display: contents` at the top level of the stylesheet).
 *   3. From 1280: side column 400px beside the cards; the analytics carousel is a grid; cards 2 across.
 *   4. From 1600: side column 440px; cards 3 across. Both widths are ONE token (`--shop-desk-side`).
 *   5. The thumb row starts right of the side column, from the same tokens.
 *
 * Sabotage: move `<ShopMakers` out of the side column (1 red) · wrap the `contents` rule in a media query (2 red) ·
 * drop the 2-across rule (3 red) · drop the 1600 block (4 red) · drop the thumb row's `left` (5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const PAGE = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(import.meta.dirname, '../_components/supplier-frame.css'), 'utf8'));
const SHOP = CSS.slice(CSS.indexOf('[data-shop-desk],'));

test('1 · the side column is Analytics → Badges → Makers, then the services, all in one wrapper', () => {
  const at = (s: string) => PAGE.indexOf(s);
  const order = [at('data-shop-desk=""'), at('data-shop-desk-side=""'), at('<OneAnalyticsSection'), at('<ShopBadgeRow'), at('<ShopMakers'), at('data-shop-services=""')];
  assert.ok(order.every((i) => i > 0), `a Shop part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the Shop parts are out of the shipped order');
  const side = PAGE.slice(at('data-shop-desk-side=""'), at('data-shop-services=""'));
  assert.equal((side.match(/<\/div>/g) ?? []).length - (side.match(/<div\b/g) ?? []).length, 1, 'the side column does not close right before the services');
});

test('2 · below 1280 the wrappers draw nothing', () => {
  const i = CSS.search(/\[data-shop-desk\],\s*\[data-shop-desk-side\]\s*\{\s*display:\s*contents;/);
  assert.ok(i > 0, 'the `display: contents` rule for the Shop wrappers is gone');
  const before = CSS.slice(0, i);
  assert.equal((before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length, 0, 'the rule sits inside a media query');
});

const block = (from: string) => {
  const i = SHOP.indexOf(from);
  if (i < 0) return '';
  let d = 0;
  for (let j = SHOP.indexOf('{', i); j < SHOP.length; j++) {
    if (SHOP[j] === '{') d++;
    else if (SHOP[j] === '}' && --d === 0) return SHOP.slice(i, j + 1);
  }
  return '';
};
const WIDE = block('@media (min-width: 1280px)');
const WIDER = SHOP.slice(SHOP.indexOf(WIDE) + WIDE.length);

test('3 · from 1280: the 400px side column (one token), analytics as a grid, cards 2 across', () => {
  assert.match(CSS, /:root\s*\{[^}]*--desk-gap:\s*28px;[^}]*--shop-desk-side:\s*400px;/, 'the side column is said once, as tokens');
  assert.match(WIDE, /\[data-shop-desk\]\s*\{[^}]*grid-template-columns:\s*var\(--shop-desk-side\) minmax\(0, 1fr\)/);
  assert.match(WIDE, /column-gap:\s*var\(--desk-gap\)/);
  assert.match(WIDE, /\[data-shop-analytics\] \[data-snap-track\]\s*\{[^}]*display:\s*grid/);
  assert.match(WIDE, /\[data-shop-card-list\]\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(WIDE, /\[data-shop-card-group\]\s*\{\s*grid-column:\s*1 \/ -1;/, 'a group name does not span the row');
});

test('4 · from 1600: the 440px side column, cards 3 across', () => {
  assert.match(CSS, /@media \(min-width: 1600px\)\s*\{\s*:root\s*\{[^}]*--shop-desk-side:\s*440px;/);
  assert.match(WIDER, /\[data-shop-card-list\]\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(CSS, /grid-template-columns:[^;]*\d+px/, 'a desk column width is typed again instead of read');
  assert.doesNotMatch(CSS, /column-gap:\s*\d+px/, 'a desk gap is typed again instead of read');
});

test('5 · the thumb row starts right of the side column, from the same tokens (owner 17 Nov audit, item 2)', () => {
  const rule = WIDE.match(/html:has\(\[data-shop-desk\]\) \[data-supplier-thumb='services'\]:not\(\[data-thumb-up\]\)\s*\{([^}]*)\}/);
  assert.ok(rule, 'the Shop thumb row no longer moves beside the side column from 1280');
  assert.match(rule[1] ?? '', /left:\s*calc\(var\(--thumb-left, 0px\) \+ var\(--shop-desk-side\) \+ var\(--desk-gap\)\)/);
  const thumb = readFileSync(join(import.meta.dirname, '_components/shop-services-thumb.tsx'), 'utf8');
  assert.match(thumb, /<SupplierThumbRow\s+name="services"/, 'the row this rule moves is not the Shop’s');
});
