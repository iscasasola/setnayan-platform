/**
 * GUARD — TODAY ON A COMPUTER IS TWO PANES, AND THE PHONE IS UNCHANGED (owner 16 Nov, DECISION_LOG "SUPPLIER DESKTOP MAIN
 * PAGES APPROVED"; P1 drawing `prototypes/supplier_desktop_main_2026-11-16/`).
 *
 *   1. The work pane holds Needs you today → Also today → Events you run → Coming up, in that order, and the Shop pane
 *      comes after it — so the reading order (and the phone's single column) is the shipped one.
 *   2. Below 1280 the wrappers draw nothing (`display: contents` outside any media query) — the phone cannot move.
 *   3. From 1280 the first screen is a grid: work pane in column 1, Shop in column 2, everything else full width.
 *   4. From 1600 the work pane splits: Needs | Coming up.
 *
 * Sabotage: move `data-today-shop` above the work pane (1 red) · put the `contents` rule inside a media query (2 red) ·
 * drop `grid-column: 2` (3 red) · drop the 1600 block (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const TSX = stripComments(readFileSync(join(import.meta.dirname, 'supplier-today-first-screen.tsx'), 'utf8'));
const CSS = readFileSync(join(import.meta.dirname, 'supplier-frame.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const at = (s: string) => TSX.indexOf(s);

test('1 · the work pane holds Needs → Also → Events you run → Coming up; the Shop pane follows', () => {
  const order = [
    at('data-today-pane="work"'),
    at('data-today-pane-needs=""'),
    at('data-today-needs=""'),
    at('data-today-also-today'),
    at('data-today-events-you-run'),
    at('data-today-coming-up'),
    at('data-today-shop'),
  ];
  assert.ok(order.every((i) => i > 0), `a Today part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'Today’s parts are out of the shipped order');
});

test('2 · below 1280 the wrappers draw nothing — the phone is the shipped one column', () => {
  const i = CSS.search(/\[data-today-pane\],\s*\[data-today-pane-needs\]\s*\{\s*display:\s*contents;/);
  assert.ok(i > 0, 'the `display: contents` rule for the Today panes is gone');
  const before = CSS.slice(0, i);
  const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
  assert.equal(depth, 0, 'the `contents` rule sits inside a media query — the phone would draw the panes');
});

test('3 · from 1280: a grid — work pane column 1, Shop column 2, the rest full width', () => {
  const b = CSS.slice(CSS.indexOf('@media (min-width: 1280px)'), CSS.indexOf('@media (min-width: 1600px)'));
  assert.match(b, /\[data-today-first-screen\]\s*\{[^}]*display:\s*grid/);
  assert.match(b, /\[data-today-first-screen\] > \*\s*\{\s*grid-column:\s*1 \/ -1;/);
  assert.match(b, /> \[data-today-pane='work'\]\s*\{[^}]*grid-column:\s*1;/);
  assert.match(b, /> \[data-today-shop\]\s*\{[^}]*grid-column:\s*2;/);
});

test('4 · from 1600: the work pane splits into Needs | Coming up', () => {
  const b = CSS.slice(CSS.indexOf('@media (min-width: 1600px)'));
  assert.match(b, /> \[data-today-pane='work'\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(b, /\[data-today-pane='work'\] > \[data-today-pane-needs\]\s*\{[^}]*display:\s*block/);
});
