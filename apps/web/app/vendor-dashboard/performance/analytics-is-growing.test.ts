/**
 * analytics-is-growing.test.ts — Shop › Analytics is the owner-approved "Analytics, growing" content (6 Nov 2026), drawn
 * since 11 Nov as the Shop tab's one carousel (owner: *"Analytics should be the carousel"*), and the owner's calls stay true:
 *
 *   1. TWO windows — 30 days · 12 months — chosen INSIDE each card (owner 11 Nov: *"inside each card"*), both built from
 *      the same reads (no refetch when a switch slides);
 *   2. the headline numbers are the three count cards' own figures, and they COUNT there (`HeldCount`) — the graphs
 *      never re-draw them;
 *   3. the recommendations are `buildGrowthRecs`' output, per window — never a hard-coded list (owner: "where are the
 *      recommendations?"), and reply advice waits for a couple to ask in that window;
 *   4. every read stays honest — a refused stats / benchmark / radar read reaches the view as "unread", never as zero;
 *   5. reduced motion shows the final values at once (the section reveal is told to play still).
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { GROWTH_WINDOWS } from '@/lib/analytics-growing';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = 'app/vendor-dashboard/performance/_components/one-analytics-section.tsx';
const TREE = 'app/vendor-dashboard/performance/_components/analytics-growing.tsx';
const CAROUSEL = 'app/vendor-dashboard/performance/_components/analytics-carousel.tsx';
const TILE = 'app/vendor-dashboard/performance/_components/graph-tile.tsx';

test('1 · two windows, chosen inside each card, built once from the same reads', () => {
  assert.deepEqual(GROWTH_WINDOWS.map((w) => [w.key, w.label.replace(/^Last /, '')]), [['30', '30 days'], ['12', '12 months']]);
  const car = read(CAROUSEL);
  assert.match(car, /= GROWTH_WINDOWS\.map\(/, 'the switch types its own windows');
  assert.match(car, /const \[wins, setWins\] = useState<Partial<Record<CardKey, GrowthWindow>>>\(\{\}\);/, 'the window is not per card');
  assert.match(
    car,
    /\{ '30': graphSpecsFor\(\{ view: props\.view, graphs: props\.graphs\['30'\], win: '30' \}\), '12': graphSpecsFor\(\{ view: props\.view, graphs: props\.graphs\['12'\], win: '12' \}\) \}/,
    'both windows are not built up front — a switch would refetch',
  );
  assert.doesNotMatch(read(PAGE), /GrowthWindowScope|initialWindow/, 'a page-wide window is back');
});

test('2 · the headline numbers are the count cards’ own, and they count there — the graphs never re-draw them', () => {
  assert.match(read(CAROUSEL), /<HeldCount value=\{n\} id=\{`ag:fig:\$\{word\}`\}/);
  assert.doesNotMatch(read(TREE), /figures\.views|figures\.inquiries|figures\.booked|funnel\[0\]|funnel\[1\]|funnel\[3\]/, 'a graph re-draws the count cards’ numbers');
});

test('3 · the recommendations are buildGrowthRecs, per window — never a hard-coded list', () => {
  const page = read(PAGE);
  // Build 6 Lane I: each window also hands its own five new graphs' numbers (`recOptsFor(w)`, read off `readNewGraphs`).
  assert.match(page, /const growthRecs = buildGrowthRecs\(recStats, \{ askedInWindow: pinNow\.totals \? pinNow\.totals\.inquiries : null, \.\.\.recOptsFor\('30'\) \}\);/);
  assert.match(page, /const growthRecsYear = buildGrowthRecs\(recStats, \{ askedInWindow: pinYear\.totals \? pinYear\.totals\.inquiries : null, \.\.\.recOptsFor\('12'\) \}\);/);
  // Both windows pass the shipped "Link up" filter (main, owner 2026-11-06) before they reach a card.
  assert.match(page, /const shownGrowthRecs = withoutPartnershipRecWhenNobodyToLink\(growthRecs, eligiblePartners\);/);
  assert.match(page, /const shownGrowthRecsYear = withoutPartnershipRecWhenNobodyToLink\(growthRecsYear, eligiblePartners\);/);
  assert.match(page, /recs: \{ '30': shownGrowthRecs, '12': shownGrowthRecsYear \}/);
  // The rec copy lives in lib/vendor-growth-recs.ts ONCE — no title or CTA is typed into the screen.
  for (const file of [TREE, CAROUSEL, TILE]) {
    for (const copy of ['Reply within the hour', 'Add recent photos', 'Ask for reviews', 'Open messages', 'Open partnerships']) {
      assert.ok(!read(file).includes(copy), `"${copy}" is typed into ${file} — read it from buildGrowthRecs`);
    }
  }
  assert.match(read(TILE), /Nothing to fix right now\./);
});

test('4 · every read stays honest — refused is "unread", never zero', () => {
  const page = read(PAGE);
  assert.match(page, /healthUnread: !statsRead\.measured/);
  assert.match(page, /benchUnread: funnelBenchmarkUnreadable/);
  assert.match(page, /radar: demandRadarUnreadable \? null : demandRadar/);
  assert.match(page, /totals30: pinNow\.totals/);
  assert.match(page, /totals12: pinYear\.totals/);
  // The funnel picture says "Couldn’t load" on a refused read and names what fills an empty stage — never a zero bar.
  const funnel = read('app/vendor-dashboard/performance/_components/funnel-preview-card.tsx');
  assert.match(funnel, /if \(steps === null\) return <p className="ag-one">Couldn’t load your funnel just now\.<\/p>;/);
  assert.match(funnel, /<GhostTrack line=/);
  // A refused read never wears a NEW shop's copy (found on the lab's `&fail=1`, 6 Nov): the calendar, the stars and the
  // habit dots each have an unread state, and the view feeds it.
  const view = read('app/vendor-dashboard/performance/_components/growth-view.ts');
  assert.match(view, /unread: !cap && !up,/);
  assert.match(view, /unread: inp\.rating === COULDNT_LOAD,/);
  // Build 6 Lane I: each graph is a card, and the card's state carries the refusal — an unread card draws
  // "Couldn’t load." and never the Example picture (graph-tile.tsx). A count card's refused total is "—", never 0.
  const tree = read(TREE);
  assert.match(tree, /state: st\(view\.ahead\.unread,/);
  assert.match(tree, /state: st\(view\.rep\.unread,/);
  assert.match(read(CAROUSEL), /n === null \? <b>—<\/b> :/);
  assert.match(read(CAROUSEL), /const line = n === null \? 'Couldn’t load\.' :/);
  assert.match(read('app/vendor-dashboard/performance/_components/graph-tile.tsx'), /g\.state === 'unread' \? \(\s*<span className="ag-ln" role="status">\s*Couldn’t load\./);
  assert.match(read('app/vendor-dashboard/performance/_components/calendar-strip.tsx'), /unread \? \([\s\S]{0,120}Couldn’t load your calendar just now\./);
  assert.match(read('app/vendor-dashboard/performance/_components/stars-fill.tsx'), /unread \? \(\s*'Couldn’t load your reviews just now'/);
  assert.match(read('app/vendor-dashboard/performance/_components/reply-gauge.tsx'), /\{unread \? null : <HabitDots on=\{on\} \/>\}/);
});

test('5 · reduced motion shows the final values at once', () => {
  const reanimate = read('app/vendor-dashboard/performance/_components/reanimate.tsx');
  assert.match(reanimate, /still/);
  assert.match(reanimate, /prefers-reduced-motion/);
});
