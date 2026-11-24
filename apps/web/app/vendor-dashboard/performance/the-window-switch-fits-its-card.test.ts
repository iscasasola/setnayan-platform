/**
 * 📏 THE WINDOW SWITCH FITS ITS CARD (supplier re-walk on live, 24 Nov 2026; controller GO).
 *
 * Measured on live at 1280: the Shop's side column draws the Analytics cards two across (171 px, 135 px inside), and
 * "30 days · 12 months" (~149 px) plus the figure (~41 px) ran past the card; the next card cut "12 months" off.
 * At 390 the card is 340 wide and both fit.
 *
 * Fails if:
 *   · the card is no longer a size container, or the narrow rule is gone;
 *   · the narrow rule stops hiding the figure / showing the short faces / letting the switch fill the row;
 *   · a button loses its full words (its name) or its short face;
 *   · the switch stops reading the one window list.
 *
 * SABOTAGE (seen red, restored): drop `container-type: inline-size` · drop the `@container` block · pass
 * `options={WINDOW_OPTIONS}` again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, '_components/analytics-growing.css'), 'utf8');
const CAROUSEL = readFileSync(join(__dirname, '_components/analytics-carousel.tsx'), 'utf8');

test('the card is a size container, and the narrow card gives the switch the row', () => {
  assert.match(CSS, /\[data-growth\] \.ag-card-in \{ container-type: inline-size; \}/);
  assert.match(CSS, /\[data-growth\] \.ag-ws \{ display: none; \}/, 'the short face shows on a wide card');
  const at = CSS.indexOf('@container (max-width: 200px) {');
  assert.ok(at > 0, 'the narrow rule is gone');
  const narrow = CSS.slice(at, CSS.indexOf('\n}', at));
  assert.match(narrow, /\.ag-ctlrow > \.ag-fig \{ display: none; \}/);
  assert.match(narrow, /\.ag-ctlrow > \[data-pill-selector\] \{ flex: 1 1 auto; \}/);
  assert.match(narrow, /\.ag-wl \{ display: none; \}/);
  assert.match(narrow, /\.ag-ws \{ display: inline; \}/);
});

test('each button keeps its full words as its name and carries a short face, from the one window list', () => {
  assert.match(CAROUSEL, /export const WINDOW_SWITCH_OPTIONS = WINDOW_OPTIONS\.map\(\(o\) => \(\{/);
  assert.match(CAROUSEL, /ariaLabel: `Last \$\{o\.label\}`/);
  assert.match(CAROUSEL, /<span className="ag-wl">\{o\.label\}<\/span>/);
  assert.match(CAROUSEL, /<span className="ag-ws">\{WINDOW_SHORT\[o\.key\]\}<\/span>/);
  assert.match(CAROUSEL, /const WINDOW_SHORT: Record<GrowthWindow, string> = \{ '30': 'Month', '12': 'Year' \};/);
  assert.match(CAROUSEL, /options=\{WINDOW_SWITCH_OPTIONS\}/);
});

test('the figure the narrow card hides is said in the line under the graph', () => {
  // The foot line is `countLine(k, n, win, vs)` from the SAME `n` the figure draws; an unread n says "Couldn’t load."
  assert.match(CAROUSEL, /const line = n === null \? 'Couldn’t load\.' : empty \? [^:]+: countLine\(k, n, win, vs\);/);
});
