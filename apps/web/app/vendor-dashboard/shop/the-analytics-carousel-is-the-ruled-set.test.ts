/**
 * 🔒 SHOP › ANALYTICS IS THE RULED SET (THE ONE BUILD, lane C4 — A3 §5 guard 2, re-pinned to FIVE by spec §9 #8).
 *   1 · Exactly five cards, in order: What's ahead · deals · price · worth · compare — each the SHIPPED card's face.
 *   2 · The shared carousel, no auto-advance and no dots (`advanceMs: 0`, `dots: false`), no "See all".
 *   3 · The app's words: no "first quote in", "Your imported clients", compare = Reply rate · Reply time · Inquiry → booking.
 *   4 · Price and compare are snapshots — their sheets draw no line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SERIES_CARDS } from '@/lib/shop-analytics-series';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const CAROUSEL = read('_components/shop-analytics-carousel.tsx');
const PAGE = read('page.tsx');
const PERF = (f: string) => read(`../performance/_components/${f}`);

test('1 · exactly the five ruled cards, each the shipped card’s compact face', () => {
  assert.match(CAROUSEL, /export const ANALYTICS_CARDS = \['ahead', 'deals', 'price', 'worth', 'compare'\] as const;/);
  for (const c of ['CapacityCard', 'ConversionDealsCard', 'PricePositionCard', 'RoiAttributionCard', 'FunnelBenchmarkCard']) {
    assert.match(PAGE, new RegExp(`<${c}\\s+compact\\b`), `${c} is not the face it should be`);
  }
});

test('2 · the shared carousel, still: no auto-advance, no dots, no See all', () => {
  assert.match(CAROUSEL, /<SnapCarousel\b/);
  assert.match(CAROUSEL, /\{ advanceMs: 0, dots: false \}|advanceMs=\{0\}[\s\S]{0,40}dots=\{false\}/);
  assert.doesNotMatch(CAROUSEL, /See all/);
});

test('3 · the app’s words on the faces', () => {
  assert.doesNotMatch(PERF('conversion-deals-card.tsx'), /first quote in/i);
  assert.match(PERF('roi-attribution-card.tsx'), /'Your imported clients'/);
  assert.doesNotMatch(PERF('roi-attribution-card.tsx'), /Your own book/);
  assert.match(PERF('funnel-benchmark-card.tsx'), /<span>\{m\.label\}<\/span>/, 'compare does not use the benchmark’s own metric words');
  assert.match(PERF('price-position-card.tsx'), /'Not enough market data yet'/);
});

test('4 · price and compare are snapshots — no line in their sheets', () => {
  assert.deepEqual([...SERIES_CARDS], ['ahead', 'deals', 'worth']);
  assert.match(CAROUSEL, /data-analytics-snapshot=""/);
});
