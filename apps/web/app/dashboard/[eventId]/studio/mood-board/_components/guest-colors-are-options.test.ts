/**
 * Owner, 2026-09-21: "for everybody except the guests, it is main color +
 * accent color." Guests' colors are ALTERNATIVES — a guest wears any one — so
 * painting all of them onto one dress drew an outfit nobody would wear.
 *
 * Mounts `BoardCardView` and counts what it emits; the figure count is measured
 * against a one-figure card, so this does not assume how many canvases one
 * RecolorStudio draws.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const FIGURE = 'https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/guests.svg';
const REGIONS = [{ slotId: 1, sampledHex: '#FAFAFA', toleranceDe: 15, regionLabel: 'attire' }];
const FOUR = ['#4B3621', '#C9A0A0', '#191970', '#3E2A3E'];

async function paint(card: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BoardCardView } = await import('./moodboard-board');
  return renderToStaticMarkup(React.createElement(BoardCardView, { card: card as never }));
}

const canvases = (html: string) => (html.match(/<canvas\b/g) ?? []).length;

const card = (over: Record<string, unknown>) => ({
  key: 'attire-guests',
  label: 'Lady guests',
  imageUrl: FIGURE,
  regions: REGIONS,
  portrait: true,
  ...over,
});

test('an OPTIONS palette draws one figure per color', async () => {
  const one = canvases(await paint(card({ paletteColors: [FOUR[0]] })));
  assert.ok(one > 0, `a single-figure card drew ${one} canvases — the baseline is broken, not the rule`);

  const html = await paint(card({ paletteColors: FOUR, lineup: true }));
  assert.equal(
    canvases(html),
    one * FOUR.length,
    `four guest colors must draw four figures (${one} canvas(es) each); drew ${canvases(html)}`,
  );
  for (const hex of FOUR) {
    assert.ok(html.includes(`title="${hex}"`), `${hex} has no swatch under its figure`);
  }
});

test('an OUTFIT palette stays ONE figure, however many colors it has', async () => {
  const one = canvases(await paint(card({ paletteColors: [FOUR[0]] })));
  const html = await paint(card({ label: 'Bride', paletteColors: FOUR.slice(0, 2) }));
  assert.equal(canvases(html), one, 'main + accent must be one outfit, not a lineup');
  assert.ok(!html.includes('data-lineup'), 'an outfit card rendered as a lineup');
});

test('PALETTE_LIMITS: only guests are options; every outfit key names Main first', async () => {
  const { PALETTE_LIMITS } = await import('@/lib/mood-board');
  const entries = Object.entries(PALETTE_LIMITS);
  assert.ok(entries.length >= 16, `expected every palette key, saw ${entries.length}`);

  const options = entries.filter(([, l]) => l.meaning === 'options').map(([k]) => k);
  assert.deepEqual(options, ['guest']);

  const outfits = entries.filter(([, l]) => l.meaning === 'outfit');
  assert.ok(outfits.length >= 13, `expected the attire keys to be outfits, saw ${outfits.length}`);
  for (const [key, l] of outfits) {
    assert.equal(l.slotLabels?.[0], 'Main', `${key}: color 1 is not labelled Main`);
    assert.equal(l.slotLabels?.[1], 'Accent', `${key}: color 2 is not labelled Accent`);
    assert.ok(
      (l.slotLabels?.length ?? 0) >= l.max,
      `${key}: ${l.max} colors allowed but only ${l.slotLabels?.length} labels`,
    );
  }
});
