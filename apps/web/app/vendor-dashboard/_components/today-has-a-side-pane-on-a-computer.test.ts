/**
 * GUARD — TODAY'S SIDE PANE ON A COMPUTER (owner 17 Nov audit of #7902, item 1; P1 drawing
 * `prototypes/supplier_desktop_main_2026-11-16/`, `.rp`).
 *
 *   1. The side pane holds, in the drawing's order: Next events → the numbers → the Shop block (with its three small
 *      cards after How is business) → Setnayan Verified — and comes after the work pane, so the phone's order is kept.
 *   2. The side pane's Next events and numbers are the SAME props the top draws (no second read), and the phone's copy
 *      sits in `data-today-top-only`.
 *   3. Below 1280 the pane draws nothing of its own and its computer-only parts are hidden; from 1280 it is column 2,
 *      sticky, and the top copy steps aside.
 *   4. Verified is claimed only once Setnayan has checked the papers (never while the pill says Checking), and links to
 *      the one paper place.
 *   5. The small cards come from the stats Today already read (`todayStatsOf`) — never a new request, never a 0 for an
 *      unread figure.
 *
 * Sabotage: move Verified above the Shop block (1 red) · hand the pane a different node than `nextEvents` (2 red) · drop
 * `position: sticky` (3 red) · show Verified while Checking (4 red) · type a figure into a small card (5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const TSX = stripComments(readFileSync(join(import.meta.dirname, 'supplier-today-first-screen.tsx'), 'utf8'));
const STATS = stripComments(readFileSync(join(import.meta.dirname, 'today-stats.tsx'), 'utf8'));
const HOST = stripComments(readFileSync(join(import.meta.dirname, 'supplier-today-screen.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(import.meta.dirname, 'supplier-frame.css'), 'utf8'));

const at = (s: string) => TSX.indexOf(s);
const SIDE = TSX.slice(at('<aside data-today-side=""'), at('</aside>'));

test('1 · the side pane: Next events → numbers → Shop (small cards after How is business) → Verified, after the work pane', () => {
  const order = [
    at('data-today-coming-up'),
    at('<aside data-today-side=""'),
    at('data-today-side-only=""'),
    at('data-today-shop'),
    at('label="How is business"'),
    at('data-today-side-minis=""'),
    at('data-today-side-verified=""'),
    at('</aside>'),
  ];
  assert.ok(order.every((i) => i > 0), `a side pane part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the side pane is out of the drawing’s order');
});

test('2 · the side copies are the same props the top draws — no second read', () => {
  const top = TSX.slice(at('<div data-today-top-only=""'), at('<div data-today-top-only=""') + 200);
  const side = SIDE.slice(SIDE.indexOf('data-today-side-only'), SIDE.indexOf('data-today-side-only') + 200);
  for (const part of [top, side]) {
    assert.match(part, /\{nextEvents\}\s*\{stats\}/, 'each copy must draw the very `nextEvents` and `stats` props');
  }
});

test('3 · below 1280 the pane is contents and its own parts hidden; from 1280 it is column 2, sticky', () => {
  const depth = (i: number) => {
    const before = CSS.slice(0, i);
    return (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
  };
  const contents = CSS.search(/\[data-today-top-only\],\s*\[data-today-side\]\s*\{\s*display:\s*contents;/);
  const hidden = CSS.search(/\[data-today-side-only\],\s*\[data-today-side-minis\],\s*\[data-today-side-verified\]\s*\{\s*display:\s*none;/);
  assert.ok(contents > 0 && depth(contents) === 0, 'the pane must be `display: contents` outside any media query');
  assert.ok(hidden > 0 && depth(hidden) === 0, 'the pane’s computer-only parts must be hidden outside any media query');
  const wide = CSS.slice(CSS.indexOf('@media (min-width: 1280px)'));
  const rule = wide.match(/\[data-today-first-screen\] > \[data-today-side\]\s*\{([^}]*)\}/);
  assert.ok(rule, 'no 1280 rule for the side pane');
  assert.match(rule[1] ?? '', /grid-column:\s*2/);
  assert.match(rule[1] ?? '', /position:\s*sticky/);
  assert.match(rule[1] ?? '', /top:\s*0/);
  assert.match(wide, /\[data-today-first-screen\] > \[data-today-top-only\]\s*\{\s*display:\s*none;/, 'the top copy must step aside from 1280');
});

test('4 · Verified only once checked, and it opens the one paper place', () => {
  const v = SIDE.slice(SIDE.indexOf('shop.pill'), SIDE.indexOf('</aside>'));
  assert.match(v, /shop\.pill === 'Checking' \? null :/, 'Verified must never show while the papers are being checked');
  assert.match(v, /href=\{PERMIT_PAPERS_HREF\}/);
});

test('5 · the small cards are the stats already read, never a typed figure', () => {
  assert.match(HOST, /minis=\{<TodayShopMinis stats=\{view\.stats\} \/>\}/, 'the host must hand the stats it already read');
  const fn = STATS.slice(STATS.indexOf('export function TodayShopMinis'));
  assert.match(fn, /todayStatsOf\(stats\)/);
  assert.match(fn, /\{s\.figure \?\? '—'\}/, 'an unread figure shows a dash, never 0');
  assert.doesNotMatch(fn, />\s*\d[\d,]*\s*</, 'no figure is typed into a small card');
});
