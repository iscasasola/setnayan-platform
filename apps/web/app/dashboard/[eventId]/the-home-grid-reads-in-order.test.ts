/**
 * GUARD — HOME IS READ IN THE ORDER IT IS SEEN (2026-10-23; RE-AIMED 2026-10-24 to the control center).
 *
 * A CSS grid can draw a piece anywhere, but a screen reader and the Tab key follow the page's own order — so a piece
 * placed above one that comes before it in the page reads out of order (review of #6858). The control center
 * (owner-approved `home_control_center_2026-10-24_fable.html`) gets its order from the DOM alone, never from placement:
 *
 *   1. COMPACT (below md): the tiles sit in the grid in the order drawn — Countdown / Guests · Event Hub / Suppliers ·
 *      Checklist / Budget — row by row, which IS the reading order (no `order`, no `grid-row`).
 *   2. DETAIL (from md): two independent stacks, drawn column by column — Countdown · Event Hub · Budget, then Guests ·
 *      Suppliers · Checklist — so Tab walks the left column, then the right, exactly as the eye does.
 *   3. No Home piece is placed by `grid-column` / `grid-row` / `order` at any width — the old ≥1024 placement block is
 *      gone with the pieces it placed (Next card · numbers · money · What's next).
 *
 * Sabotage (2026-10-24): swap Budget and Checklist in the detail columns (2 red); add `order: 2` to `.hc-tile` (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('app/globals.css');
const order = (html: string, marker: string) => [...html.matchAll(new RegExp(`${marker}="([a-z]+)"`, 'g'))].map((m) => m[1]);

test('1 · the phone reads the tiles row by row, in the order drawn', () => {
  const html = drawHome();
  const compact = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  assert.deepEqual(order(compact, 'data-home-tile'), ['count', 'guests', 'hub', 'sup', 'plan', 'budget']);
});

test('2 · from md, the two columns are read column by column, as seen', () => {
  const html = drawHome();
  const detail = slice(html, 'data-home-control="detail"', ['data-home-services']);
  const cols = detail.split('class="hc-col"').slice(1);
  assert.equal(cols.length, 2, 'the detail version is not two columns');
  assert.deepEqual(order(cols[0]!, 'data-home-card-key'), ['count', 'hub', 'budget'], 'the left column');
  assert.deepEqual(order(cols[1]!, 'data-home-card-key'), ['guests', 'sup', 'plan'], 'the right column');
  // The Today line comes first, the services after the control row.
  assert.ok(html.indexOf('data-home-today=') < html.indexOf('data-home-control="compact"'), 'Today is not first');
  assert.ok(html.indexOf('data-home-control="detail"') < html.indexOf('data-home-services'), 'Your services come before the control row');
});

test('3 · no Home piece is placed out of the page order, at any width', () => {
  assert.doesNotMatch(CSS, /\[data-home-column\] > \[data-home-[a-z-]+\][^{]*\{[^}]*grid-(column|row)/, 'a Home piece is placed by the grid');
  for (const rule of [...CSS.matchAll(/\.(hc-[a-z-]+)[^{]*\{([^}]*)\}/g)]) {
    assert.doesNotMatch(rule[2]!, /(^|;|\s)order\s*:/, `.${rule[1]} reorders what the page says`);
    assert.doesNotMatch(rule[2]!, /grid-row\s*:/, `.${rule[1]} places a widget on a row`);
  }
  assert.doesNotMatch(CSS, /@media \(min-width: 1024px\) \{\s*\[data-home-column\] \{/, 'the old desktop placement block is back');
});
