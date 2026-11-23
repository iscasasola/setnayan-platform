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
 *
 * RE-AIMED 23 Nov 2026 (owner, v5 drawing in the website look): the phone's tiles (1) and the md copy (2) are retired —
 * the board's two columns are the ONE copy at every width, stacked under the list below 1280 in the page's own order:
 * Guests · Budget · Schedule, then Suppliers · Event Hub (the drawing's order). Tests 1 and 2 now hold that.
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

// 🎴 Home redraw 2026-11-02 (round 3): the Countdown rides the event card and To do is the list under it.
test('1 · below 1280 the widgets read in the order drawn — Guests · Budget · Schedule · Suppliers · Event Hub', () => {
  const html = drawHome();
  assert.equal(html.split('data-home-control="compact"').length - 1, 0, 'the retired phone tiles are back');
  const board = slice(html, 'data-home-board="middle"', ['data-home-services']);
  assert.deepEqual(order(board, 'data-home-card-key'), ['guests', 'budget', 'sup', 'hub']);
});

test('2 · the list comes first, the widgets after it, the services after them — no second copy', () => {
  const html = drawHome();
  assert.equal(html.split('data-home-control="detail"').length - 1, 0, 'the retired md copy is back');
  assert.ok(html.indexOf('data-home-today=') < html.indexOf('data-event-today=""'), 'Today is not first');
  assert.ok(html.indexOf('data-event-today=""') < html.indexOf('data-home-board="middle"'), 'the widgets come before the list');
  assert.ok(html.indexOf('data-home-board="right"') < html.indexOf('data-home-services'), 'Your services come before the control row');
  // Each board column is a stack at every width — never hidden below 1280.
  for (const side of ['middle', 'right']) assert.doesNotMatch(html, new RegExp(`class="[^"]*\\bhidden\\b[^"]*" data-home-control="board" data-home-board="${side}"`), `the ${side} column hides below 1280`);
});

// 🖥 THE 1280 BOARD (owner-approved 16 Nov 2026, event dashboard drawing v13): three column wrappers, each its own stack,
// so the page order IS the column order — the event card, Next and To do | Guests · Budget · Schedule | Suppliers ·
// Event Hub, then Prints · Your services · Memories. Below 1280 each wrapper is `display: contents`, so the order above
// (tests 1 and 2) is the order the phone and the tablet read. Sabotage: swap 'budget' and 'guests' in HOME_BOARD_COLUMNS.
test('2b · from 1280, three columns read column by column, as seen', () => {
  const html = drawHome();
  const at = (m: string) => html.indexOf(m);
  assert.ok(at('data-home-board-col="left"') < at('data-home-cover'), 'the event card is not in the first column');
  assert.ok(at('data-home-cover') < at('data-home-board="middle"') && at('data-home-board="middle"') < at('data-home-board-col="right"'), 'the middle column is out of order');
  const middle = slice(html, 'data-home-board="middle"', ['data-home-board-col="right"']);
  assert.deepEqual(order(middle, 'data-home-card-key'), ['guests', 'budget'], 'the middle column (the Schedule tile follows them)');
  if (html.includes('data-home-tile="sched"')) assert.ok(middle.includes('data-home-tile="sched"'), 'the middle column ends with the Schedule');
  const right = slice(html, 'data-home-board="right"', ['data-home-services']);
  assert.deepEqual(order(right, 'data-home-card-key'), ['sup', 'hub'], 'the right column opens with Suppliers · Event Hub');
  assert.ok(at('data-home-board="right"') < at('data-home-services'), 'Your services are not under the right column');
  // Each wrapper is a column only from 1280 — below it, it adds nothing to the page.
  for (const side of ['left', 'right']) {
    assert.match(html, new RegExp(`class="contents xl:flex[^"]*" data-home-board-col="${side}"`), `the ${side} wrapper is not display: contents below 1280`);
  }
  // The two-column cards are retired (23 Nov 2026) — the board is the one copy, so nothing must hide where it shows.
  assert.doesNotMatch(html, /data-home-control="detail"/, 'the retired two-column cards are back');
});

test('3 · no Home piece is placed out of the page order, at any width', () => {
  assert.doesNotMatch(CSS, /\[data-home-column\] > \[data-home-[a-z-]+\][^{]*\{[^}]*grid-(column|row)/, 'a Home piece is placed by the grid');
  for (const rule of [...CSS.matchAll(/\.(hc-[a-z-]+)[^{]*\{([^}]*)\}/g)]) {
    assert.doesNotMatch(rule[2]!, /(^|;|\s)order\s*:/, `.${rule[1]} reorders what the page says`);
    assert.doesNotMatch(rule[2]!, /grid-row\s*:/, `.${rule[1]} places a widget on a row`);
  }
  assert.doesNotMatch(CSS, /@media \(min-width: 1024px\) \{\s*\[data-home-column\] \{/, 'the old desktop placement block is back');
  // Today's website sheet (23 Nov 2026) lays pieces side by side but never reorders what the page says.
  const sheet = read('app/dashboard/[eventId]/_components/today-website.css');
  assert.doesNotMatch(sheet, /(^|;|\{|\s)order\s*:/, 'the Today sheet reorders what the page says');
});
