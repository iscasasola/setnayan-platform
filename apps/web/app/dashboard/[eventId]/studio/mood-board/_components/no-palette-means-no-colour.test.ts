/**
 * MB23 · THE OWNER'S BUG, PINNED.
 *
 * Reported 2026-09-05, verbatim: "we do not have a design yet for the palette
 * and there are already samples on in your colors." With no palette chosen,
 * "In your colors" rendered fully coloured drawings — every colour on the screen
 * one the couple did not pick — under a caption reading "Set this palette above
 * to see it here."
 *
 * The rule this file enforces: WITH NO PALETTE, THE STOCK-COLOURED SOURCE MUST
 * NOT BE WHAT RENDERS.
 *
 * 🪤 Anchored on the COMPONENT, not on a substring of `moodboard-board.tsx` —
 * see [[a-source-guards-window-must-end-at-the-brace]]. A guard that greps the
 * file for the old `<img src=` would pass the moment someone moved the
 * fallthrough into a helper, and would fail on an unrelated `<img>` elsewhere in
 * the file. This mounts `BoardCardView` and reads what it actually emits.
 *
 * 🪤 `globalThis.React` set before the dynamic import — see
 * `app/_components/byline-renders-as-a-door.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type BoardMod = typeof import('./moodboard-board');

const STOCK = 'https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/bride.svg';

const REGIONS = [
  { slotId: 1, sampledHex: '#FAFAFA', toleranceDe: 15, regionLabel: 'attire' },
];

async function paintCard(card: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BoardCardView }: BoardMod = await import('./moodboard-board');
  return renderToStaticMarkup(
    React.createElement(BoardCardView, { card: card as never }),
  );
}

/** Every `src="…"` the markup hands the browser to fetch and display as-is. */
function displayedSources(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]!);
}

test('NO PALETTE: the stock-coloured drawing is not what renders', async () => {
  const html = await paintCard({
    key: 'attire-bride',
    label: 'Bride',
    imageUrl: STOCK,
    paletteColors: [],
    regions: REGIONS,
    portrait: true,
  });

  assert.deepEqual(
    displayedSources(html),
    [],
    'With no palette set, "In your colors" rendered the source image directly — ' +
      'that is the artist\'s colours presented to the couple as their own, and it is ' +
      'exactly the bug the owner reported on 2026-09-05. The no-palette branch must ' +
      'render the neutral canvas treatment (or nothing), never the stock source.',
  );
});

test('NO PALETTE: the caption still names the card, so an absent drawing is not a blank tile', async () => {
  const html = await paintCard({
    key: 'attire-bride',
    label: 'Bride',
    imageUrl: STOCK,
    paletteColors: [],
    regions: REGIONS,
    portrait: true,
  });
  assert.match(html, /Bride/, 'the label must survive the honest-empty treatment');
  assert.match(
    html,
    /Set this palette above to see it here\./,
    'the caption and the picture must now agree — this is the sentence the old ' +
      'coloured figure contradicted',
  );
});

test('NO PALETTE and no regions either: still no stock source', async () => {
  // The regionless card is the branch that used to be the ONLY branch for
  // attire. It must obey the same rule.
  const html = await paintCard({
    key: 'attire-groom',
    label: 'Groom',
    imageUrl: STOCK,
    paletteColors: [],
    portrait: true,
  });
  assert.deepEqual(displayedSources(html), []);
});

test('PALETTE SET: a recolourable card still goes through the recolour path', async () => {
  // The other direction. Fixing the empty case by refusing to draw anything ever
  // would pass the assertions above and silently kill the feature — the same
  // shape of false green as [[a-flag-in-an-object-is-not-ink-in-the-pixels]].
  const html = await paintCard({
    key: 'attire-bride',
    label: 'Bride',
    imageUrl: STOCK,
    paletteColors: ['#7A1F2B', '#D4AF37'],
    regions: REGIONS,
    portrait: true,
  });
  assert.match(
    html,
    /<canvas/,
    'a card WITH a palette and tagged regions must still render the RecolorStudio canvas',
  );
  assert.deepEqual(
    displayedSources(html),
    [],
    'the recolour path paints into a canvas; it must not also ship the raw source',
  );
  assert.match(html, /#7A1F2B/i, 'the chosen palette must be on screen as swatches');
});

test('PALETTE SET but no tagged regions: the reference drawing is allowed', async () => {
  // Defensive branch — no live card is in this state after MB23, but an untagged
  // upload would be, and the couple's own colours ARE on screen beside it. This
  // asserts the fix did not over-reach into a case the owner did not report.
  const html = await paintCard({
    key: 'attire-guests',
    label: 'Lady guests',
    imageUrl: STOCK,
    paletteColors: ['#7A1F2B'],
    portrait: true,
  });
  assert.deepEqual(displayedSources(html), [STOCK]);
});
