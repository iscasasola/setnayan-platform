/**
 * the-colors-panel-shows-the-mood-board.test.ts — BLANK MEANS "MY MOOD BOARD",
 * AND THE PANEL SHOWS THOSE COLOURS.
 *
 * Owner, 2026-09-27, on the Maker's page-wide Colors panel: *"mood board
 * palettes did not update"*. Measured: the panel's swatch drew a hard-coded
 * cream (`#f4ecdd`) whenever a colour was left blank — which is exactly the
 * state that means "use my Mood Board palette" — so a couple never saw their
 * own colours there, and the Dawn / Diagonal / Glow chips sat greyed out until
 * a hex was picked. What this proves, by RENDERING the panel:
 *
 *   1. with a Mood Board palette and no colour of their own, the Background and
 *      Buttons wells show the palette's resolved colours — the SAME resolver the
 *      guest page wears (`buildSitePaletteVars`) — labelled "From your Mood
 *      Board", and never the old cream;
 *   2. the Mood Board's own swatches are offered first;
 *   3. the effect chips preview in the resolved colour and are not disabled;
 *   4. with no palette, the wells show the THEME's page and button colours.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSitePaletteVars, moodBoardSiteColours } from './site-palette-vars';
import { INVITE_THEMES } from './invite-themes';
import { ombreCss } from './ombre';
import type { RolePalette } from './mood-board';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { pickerShelves } from './mood-board-studio';

(globalThis as unknown as { React: unknown }).React = React;

const PALETTE = {
  reception: ['#F7F1E6', '#6B2E3A', '#4F6B4A'],
  ceremony: ['#A9834B'],
} as unknown as RolePalette;

async function panel(moodBoard: ReturnType<typeof moodBoardSiteColours>, extra: Record<string, unknown> = {}) {
  const { ColorsPanel } = await import('../app/dashboard/[eventId]/website/editor/_components/pro-panels');
  return renderToStaticMarkup(
    React.createElement(ColorsPanel, {
      action: async () => {},
      eventId: 'e',
      rowKey: 'colors',
      bgColor: null,
      buttonColor: null,
      artDirection: null,
      themeId: 'house',
      moodBoard,
      ...extra,
    }),
  );
}

/** The wide half of a colour well: its background colour and its words. */
function well(html: string, data: string): { bg: string; label: string } {
  const at = html.indexOf(`data-colour-well="${data}"`);
  assert.ok(at >= 0, `the ${data} well is drawn`);
  const m = /data-colour-well-wide=""[^>]*style="background:(#[0-9a-f]{6})[^"]*"[^>]*><span[^>]*>([^<]*)</.exec(html.slice(at));
  assert.ok(m, `the ${data} well's swatch: ${html.slice(at, at + 600)}`);
  return { bg: m[1]!, label: m[2]! };
}

const channelsHex = (ch: string) => `#${ch.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;

test('the resolver is the guest page’s own: paper → background, CTA → buttons', () => {
  const vars = buildSitePaletteVars(PALETTE)!;
  const mb = moodBoardSiteColours(PALETTE)!;
  assert.equal(mb.background, channelsHex(vars['--color-cream']!));
  assert.equal(mb.buttons, channelsHex(vars['--color-mulberry']!));
  assert.deepEqual(mb.swatches.slice(0, 3), ['#f7f1e6', '#6b2e3a', '#4f6b4a']);
  assert.equal(moodBoardSiteColours(null), null);
});

test('blank shows the Mood Board’s colours, "From your Mood Board" — never the old cream', async () => {
  const mb = moodBoardSiteColours(PALETTE)!;
  const html = await panel(mb);
  const page = well(html, 'page');
  const buttons = well(html, 'buttons');
  assert.equal(page.bg, mb.background, 'the background well shows the palette’s page colour');
  assert.equal(buttons.bg, mb.buttons, 'the buttons well shows the palette’s button colour');
  assert.equal(page.label, 'From your Mood Board');
  assert.equal(buttons.label, 'From your Mood Board');
  assert.doesNotMatch(html, /#f4ecdd/i, 'the hard-coded cream is gone');
  // Their Mood Board is offered first: both wells hand its swatches to the ONE colour picker (2026-10-08 — the
  // well's own panel is retired), whose first suggestion shelf, "Your Mood Board", leads with them.
  const panelSrc = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx'), 'utf8'));
  assert.equal((panelSrc.match(/<ColourWell[\s\S]{0,200}palette=\{moodBoard\?\.swatches \?\? \[\]\}/g) ?? []).length, 2, 'a well does not hand the Mood Board’s swatches to the picker');
  const shelf = pickerShelves(mb.swatches).board.map((r) => r.hex.toLowerCase());
  assert.deepEqual(shelf, mb.swatches.slice(0, shelf.length), 'the picker’s Mood Board shelf does not lead with the board’s swatches');
  for (const c of ['#6b2e3a', '#4f6b4a']) assert.ok(shelf.includes(c), `${c} is not offered`);
});

test('the effect chips preview in the resolved colour, and none is disabled while blank', async () => {
  const mb = moodBoardSiteColours(PALETTE)!;
  const html = await panel(mb);
  for (const e of ['dawn', 'diagonal', 'glow'] as const) {
    const chip = new RegExp(`<button[^>]*data-background-effect="${e}"[^>]*>`).exec(html)?.[0] ?? '';
    assert.ok(chip, `${e} chip drawn`);
    assert.doesNotMatch(chip, / disabled=""/, `${e} is offered while the colour is blank`);
    const css = ombreCss({ shape: e, base: mb.background }).replace(/"/g, '&quot;');
    assert.ok(html.includes(css.slice(0, 60)), `${e} previews the Mood Board colour`);
  }
});

test('with no Mood Board palette the wells show the default colours', async () => {
  const html = await panel(null);
  assert.equal(well(html, 'page').bg, INVITE_THEMES.house.palette.canvas.toLowerCase());
  // "From your theme" until 2026-10-05 — a couple no longer picks a theme; it is the page's default.
  assert.equal(well(html, 'page').label, 'Default');
  assert.equal(well(html, 'buttons').bg, INVITE_THEMES.house.palette.accent.toLowerCase());
  assert.doesNotMatch(html, /#f4ecdd/i);
});
