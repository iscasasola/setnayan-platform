/**
 * analytics-is-growing.test.ts — Shop › Analytics is the owner-approved "Analytics, growing" screen (6 Nov 2026), and
 * the owner's calls on it stay true:
 *
 *   1. ONE window — Last 30 days · Last 12 months — and the pinned row follows it (its 12-month figures are handed in);
 *   2. the headline numbers live in the pinned row only, and they COUNT there (`<Count>` on the figure);
 *   3. Do next is `buildGrowthRecs`' output, per window — never a hard-coded list (owner: "where are the
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

const PAGE = 'app/vendor-dashboard/performance/page.tsx';
const TREE = 'app/vendor-dashboard/performance/_components/analytics-growing.tsx';
const DO_NEXT = 'app/vendor-dashboard/performance/_components/do-next.tsx';
const SEGMENTS = 'app/vendor-dashboard/shop/_components/shop-segments.tsx';
const PIN = 'app/vendor-dashboard/_components/pin-figures.tsx';

test('1 · one window, two values, and the pinned row follows it', () => {
  assert.deepEqual(
    GROWTH_WINDOWS.map((w) => [w.key, w.label]),
    [
      ['30', 'Last 30 days'],
      ['12', 'Last 12 months'],
    ],
  );
  const page = read(PAGE);
  assert.match(page, /<GrowthWindowScope initial=\{initialWindow\}>/);
  assert.match(page, /<ShopSegments on="insights" figures=\{pinFigures\} yearFigures=\{pinFiguresYear\}/);
  assert.match(page, /const pinFiguresYear = analyticsFigures\(pinYear\.totals, null\);/, 'no 24-month read exists — 12 months has no "before"');
  const seg = read(SEGMENTS);
  assert.match(seg, /useGrowthWindow\(\)/);
  assert.match(seg, /yearFigures/);
});

test('2 · the headline numbers count in the pinned row — and only there', () => {
  assert.match(read(PIN), /<Count value=\{f\.count\}/);
  // The body never re-draws the three headline figures as a second big-number block.
  const tree = read(TREE);
  assert.doesNotMatch(tree, /figures\.views|figures\.inquiries|figures\.booked/, 'the body re-draws the pinned row’s numbers');
});

test('3 · Do next is buildGrowthRecs, per window — never a hard-coded list', () => {
  const page = read(PAGE);
  // Build 6 Lane I: each window also hands the five new graphs' numbers (`graphRecOpts`, read off `readNewGraphs`).
  assert.match(page, /const growthRecs = buildGrowthRecs\(recStats, \{ askedInWindow: pinNow\.totals \? pinNow\.totals\.inquiries : null, \.\.\.graphRecOpts \}\);/);
  assert.match(page, /const growthRecsYear = buildGrowthRecs\(recStats, \{ askedInWindow: pinYear\.totals \? pinYear\.totals\.inquiries : null, \.\.\.graphRecOpts \}\);/);
  // Both windows pass the shipped "Link up" filter (main, owner 2026-11-06) before they reach Do next.
  assert.match(page, /const shownGrowthRecs = withoutPartnershipRecWhenNobodyToLink\(growthRecs, eligiblePartners\);/);
  assert.match(page, /const shownGrowthRecsYear = withoutPartnershipRecWhenNobodyToLink\(growthRecsYear, eligiblePartners\);/);
  assert.match(page, /recs: \{ '30': shownGrowthRecs, '12': shownGrowthRecsYear \}/);
  const tree = read(TREE);
  assert.match(tree, /<DoNext recs=\{w\.recs\} \/>/);
  // The rec copy lives in lib/vendor-growth-recs.ts ONCE — no title or CTA is typed into the screen.
  for (const copy of ['Reply within the hour', 'Add recent photos', 'Ask for reviews', 'Open messages', 'Open partnerships']) {
    assert.ok(!tree.includes(copy) && !read(DO_NEXT).includes(copy), `"${copy}" is typed into the screen — read it from buildGrowthRecs`);
  }
  assert.match(read(DO_NEXT), /Nothing to fix right now\./);
  assert.match(read(DO_NEXT), /recs\.slice\(0, 3\)/, 'Do next shows the top three');
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
  // Build 6 Lane I: each graph is a tile, and the tile's state carries the refusal — an unread tile draws
  // "Couldn’t load." and never the Example picture (graph-tile.tsx).
  const tree = read(TREE);
  assert.match(tree, /state: st\(view\.ahead\.unread,/);
  assert.match(tree, /state: st\(view\.rep\.unread,/);
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
