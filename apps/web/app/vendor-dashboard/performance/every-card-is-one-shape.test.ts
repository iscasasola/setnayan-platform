/**
 * 🔒📐 EVERY ANALYTICS CARD IS ONE SHAPE, COLOURED BY MEANING, AND THE COUNT CARDS COMPARE WITH LAST YEAR.
 *
 *   · Owner 21 Nov 2026, *"graphs look better and balance"* (DECISION_LOG "ANALYTICS CARDS, ONE SHAPE — LOOK APPROVED";
 *     drawing `prototypes/analytics_one_shape_2026-11-21/`): every card 340 × 320 on every screen — head 24 · number row
 *     44 · picture FIXED 144 · line ≤ 2 lines (36), 12 between, padding 18; 2–3 cards side by side on a desktop.
 *   · Owner 22 Nov 2026, *"don't use theme color for the graphs. use what colors are appropriate for each graph"*
 *     (DECISION_LOG "ANALYTICS GRAPHS: COLOUR BY MEANING, NOT THE THEME COLOUR"): named chart tokens, light + dark, never
 *     a hex in the feature; opened blue · asked amber · booked green · last year grey dashed; buttons keep the theme.
 *   · Owner 21 Nov 2026, *"Yes, add it"* (vs last year): the dashed line only with a percent; the rules in one module.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 * 🛡 SABOTAGE (seen RED, then restored — 22 Nov 2026): the picture row set to 160px; `--color-chart-booked` deleted from
 * the dark block; the carousel's `drawsLastYearLine(vs) &&` gate removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(raw(rel));
const C = 'app/vendor-dashboard/performance/_components/';
const CSS = code(`${C}analytics-growing.css`);
const GLOBALS = raw('app/globals.css');

/** One CSS rule's body, by its exact selector. */
function rule(sel: string): string {
  const at = CSS.indexOf(`${sel} {`);
  assert.ok(at >= 0, `no rule for ${sel}`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

test('1 · the card is 340 × 320: head 24 · row 44 · picture 144 · line 36, 12 between, padding 18', () => {
  const card = rule('[data-growth] .ag-card-in');
  assert.match(card, /height: 320px;/);
  assert.match(card, /grid-template-rows: 24px 44px 144px 36px;/);
  assert.match(card, /row-gap: 12px;/);
  assert.match(card, /padding: 18px;/);
  assert.doesNotMatch(card, /border:/, 'no card border (the house look uses space, not lines)');
  assert.match(rule('[data-growth] .ag-card .ag-gp'), /height: 144px;[\s\S]*overflow: hidden;/, 'the picture box is FIXED — a tall picture can never stretch the row');
  assert.match(rule('[data-growth] .ag-card .ag-ln'), /-webkit-line-clamp: 2;/);
  assert.match(CSS, /\[data-snap-track\] > \[data-snap-slide\],\s*\[data-shop-analytics\] \[data-snap-track\] > \[data-snap-copy\] \{ flex: 0 0 min\(340px, 100%\); \}/, 'every slide is 340 wide, so a desktop shows 2–3');
  assert.match(rule('[data-growth] .ag-fig b, [data-growth] .ag-fig .ag-fig-n'), /font-size: 22px;/, 'the big number is 22 (on the scale)');
});

test('2 · every chart colour is a named token with a light AND a dark value — never a hex in the feature', () => {
  const TOKENS = ['opened', 'asked', 'booked', 'last', 'quiet', 'src-1', 'src-2', 'src-3', 'src-4', 'src-5'];
  for (const t of TOKENS) {
    const hits = GLOBALS.match(new RegExp(`--color-chart-${t}: \\d+ \\d+ \\d+;`, 'g')) ?? [];
    assert.equal(hits.length, 2, `--color-chart-${t} needs exactly one light and one dark value`);
  }
  for (const f of ['analytics-growing.css', 'new-graph-pics.tsx', 'three-years.tsx', 'source-bars.tsx', 'calendar-strip.tsx']) {
    assert.doesNotMatch(code(`${C}${f}`), /#[0-9a-fA-F]{3,8}\b/, `${f} types a hex`);
  }
  assert.doesNotMatch(code('lib/chart-source-hues.ts'), /#[0-9a-fA-F]{3,8}\b/);
});

test('3 · the graphs wear their meaning, not the theme colour', () => {
  assert.match(rule('[data-growth] .ag-plot .ag-line'), /stroke: rgb\(var\(--color-chart-opened\)\)/);
  assert.match(rule('[data-growth] .ag-plot .ag-bar-asked'), /--color-chart-asked/);
  assert.match(rule('[data-growth] .ag-plot .ag-bar-booked'), /--color-chart-booked/);
  assert.match(rule('[data-growth] .ag-plot .ag-ly'), /--color-chart-last[\s\S]*stroke-dasharray/);
  assert.match(rule('[data-growth] .ag-key .ag-up'), /--color-ok/);
  assert.match(rule('[data-growth] .ag-key .ag-down'), /--color-danger/);
  assert.match(rule('[data-growth] .ag-col .ag-full'), /--color-chart-asked/, 'a date lost to "full" is the asked-not-free amber');
  assert.match(rule('[data-growth] .ag-cc.ag-wait::after'), /--color-chart-asked/);
  assert.match(code(`${C}source-bars.tsx`), /background: sourceHueColor\(r\.key\)/, 'one fixed hue per source');
  // The pictures the one shape draws carry no theme colour of their own.
  const pics = code(`${C}new-graph-pics.tsx`) + code(`${C}three-years.tsx`);
  assert.doesNotMatch(pics, /--m-orange|--sn-accent|--color-mulberry/);
});

test('4 · vs last year: one module decides; the dashed line only with a percent; a shop under a year sees nothing', () => {
  const car = code(`${C}analytics-carousel.tsx`);
  assert.match(car, /vsLastYear\(n, ly \? ly\.total\[win\] : null, view\.lastYear\.yearOld\)/);
  assert.match(car, /lastYear=\{drawsLastYearLine\(vs\) && ly \? ly\.lane\[win\] : null\}/);
  const view = code(`${C}growth-view.ts`);
  assert.match(view, /yearOld: shopIsAYearOld\(inp\.shopCreatedAt, inp\.nowMs\)/);
  const page = code(`${C}one-analytics-section.tsx`);
  assert.match(page, /fetchBookedSeries\(bookingsAdmin as unknown as SeriesClient/, 'booked rows on the admin client (no vendor SELECT on event_vendors)');
  assert.match(page, /shopCreatedAt: profile\.created_at \?\? null/);
});
