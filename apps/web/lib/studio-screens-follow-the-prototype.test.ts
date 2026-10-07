/**
 * 🎨 STUDIO'S SCREENS FOLLOW THE APPROVED PROTOTYPE (owner 2026-10-07, verbatim: *"the lower
 * toolbar did not execute the designs style we agreed on the prototype"* · *"seems like nothing
 * was built properly"*; DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE…";
 * side-by-side `MAKER_SIDE_BY_SIDE_2026-10-07.md` M27–M31). Prototype:
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`.
 *
 * Every earlier check tested behaviour and none the look, so the old controls shipped inside the
 * new frame. These hold the SHAPES the prototype draws, rendered — a regression to the old control
 * goes red here, not on the owner's phone:
 *
 *   1 · the Tool row is `.fhead` — Tool ▾ across the row, ✓ Saved at its end (✓ Done on the two
 *       full-screen tools, no Saved), and an end slot a tool can put its own control in;
 *   2 · the opening line's starting points are ONE dropdown in Studio (M28 · M31), never a pill
 *       row — and the shipped Maker (flag off, no Studio) keeps its chips untouched;
 *   3 · a print in Studio › Prints is one row of the one list: name, sizes, size ▾, its Saves as
 *       small buttons right under it — no "This piece" block;
 *   4 · Studio › Look opens on its one bar — the workspace draws no tall tiles there (M29), and
 *       Background's choices are the dropdown's own list drawn as a carousel;
 *   5 · the full-screen surface: green switches, edge-to-edge panel, Look's panel full width.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles these to the classic runtime (see
 * `app/dashboard/[eventId]/launch/_components/hub-stage-renders.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { studioFullScreenCss } from './studio-details';
import { STUDIO_PAGE_BG } from './studio-skin';
import { STUDIO_TILE_KEYS, STUDIO_TILES, type StudioTileModel } from './studio-tiles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const tiles: StudioTileModel[] = STUDIO_TILE_KEYS.map((key) => ({
  key,
  label: STUDIO_TILES[key].label,
  short: STUDIO_TILES[key].short,
  item: STUDIO_TILES[key].item,
  immersive: STUDIO_TILES[key].immersive === true,
  done: key === 'seats' ? false : true,
  status: STUDIO_TILES[key].sub,
}));

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('1 · the Tool row: Tool ▾ across the row, ✓ Saved at its end — ✓ Done (and no Saved) on a full-screen tool', async () => {
  const { StudioToolRow } = await import(`../${L}/stages-studio-parts`);
  const noop = () => {};
  const info = await html(React.createElement(StudioToolRow, { tile: tiles[0], tiles, onOpen: noop, onDone: noop }));
  assert.match(info, /data-maker-studio-tool/, 'no Tool ▾');
  assert.match(info, /data-studio-row-end=""/, 'no end slot for a tool’s own control (the Mood Board’s ✨ Auto)');
  assert.match(info, /data-studio-saved="saved"[^>]*>.*Saved/s, 'no ✓ Saved in the row');
  assert.match(info, /uppercase/, 'the Tool ▾ pill is not the prototype’s capitals');
  assert.doesNotMatch(info, /data-maker-studio-done/);
  const march = tiles.find((t) => t.key === 'march')!;
  const full = await html(React.createElement(StudioToolRow, { tile: march, tiles, onOpen: noop, onDone: noop }));
  assert.match(full, /data-maker-studio-done=""/, 'the Wedding March has no ✓ Done');
  assert.doesNotMatch(full, /data-studio-saved/, 'a full-screen tool shows Saved where Done belongs');
});

test('1b · the Studio home: eleven tiles on the warm page, ✓ / Missing as read', async () => {
  const { StudioHome } = await import(`../${L}/studio-home`);
  const out = await html(React.createElement(StudioHome, { tiles, onOpen: () => {} }));
  assert.equal((out.match(/data-studio-tile="/g) ?? []).length, 11);
  assert.ok(out.includes(STUDIO_PAGE_BG), 'the home is not on the prototype’s warm page');
  assert.match(out, /10 of 11 ready/);
  assert.equal((out.match(/>Missing</g) ?? []).length, 1);
});

test('2 · the opening line: ONE dropdown in Studio, never a pill row — the shipped Maker keeps its chips', async () => {
  const { OpeningLineField } = await import(`../${L}/opening-line-field`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const studio = await html(
    React.createElement(MakerContext.Provider, { value: { stagesStudio: true } as never }, React.createElement(OpeningLineField, { initial: null, titled: false })),
  );
  assert.match(studio, /data-opening-line-start/, 'Studio has no “Start from ▾”');
  assert.doesNotMatch(studio, /Opening line templates/, 'Studio still draws the tone chips (M28 · M31)');
  /* The helper line lives in the ⓘ's tooltip only — never as a line in the panel. */
  assert.doesNotMatch(studio.replace(/<span[^>]*role="tooltip"[\s\S]*?<\/span><\/span>/g, ''), /Pick one to fill the box/, 'the helper line is in the panel, not behind ⓘ');
  const shipped = await html(React.createElement(OpeningLineField, { initial: null, titled: false }));
  assert.match(shipped, /Opening line templates/, 'the shipped Maker lost its chips — flag-off must not change');
  assert.match(studio, /name="opening_line"/);
  assert.match(shipped, /name="opening_line"/);
});

test('3 · a print in Studio is one row of the list: name · sizes · size ▾ · its Saves under it', async () => {
  const { PrintPieceEditor } = await import(`../${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const input = {
    eventId: 'ev-1',
    slug: 'maria-and-jose',
    theme: 'house',
    ownsPro: false,
    storeShell: false,
    formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
  };
  const studio = await html(React.createElement(PrintPieceEditor, { input, piece: 'invitation', studio: true }));
  assert.match(studio, /data-print-studio=""/);
  /* The size ▾ and the Saves are client pieces (lazy on a server render) — their PLACES are read here,
     their shape from the source: the name and sizes, then the Saves right under the row. */
  assert.match(studio, /5 × 7 in or A5<\/small><\/span>[\s\S]*?<\/div><div [^>]*data-print-piece-saves="invitation"/, 'the Saves are not right under the piece’s row');
  assert.doesNotMatch(studio, /This piece/, 'the old “This piece” block is still drawn');
  const src = read(`${L}/maker-prints.tsx`);
  assert.equal((src.match(/variant=\{studio \? 'chip' : 'link'\}/g) ?? []).length, 3, 'a Studio Save is still the old underlined link');
  assert.match(src.slice(src.indexOf('if (studio) {')), /\{sizePicker\}/, 'the Studio row has no size ▾');
  const shipped = await html(React.createElement(PrintPieceEditor, { input, piece: 'invitation' }));
  assert.match(shipped, /This piece/, 'the shipped Details lost its block — flag-off must not change');
});

test('4 · Studio › Look opens on its one bar: no tall tiles; Background is the dropdown’s own list as a carousel', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /const studioLook = maker\?\.stagesStudio === true && detailsLtSection\(selected\) === 'look';/);
  assert.match(ws, /const ltTiles = ltNav && !studioLook \?/, 'Studio › Look draws the tall tiles again (M29)');
  assert.match(ws, /if \(studioLook\) setSheetOpen\(true\);/, 'Studio › Look does not open on its controls');
  const mb = read('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  assert.match(mb, /<GroundCarousel options=\{groundOptions\} value=\{groundValue\}[^>]*onPick=\{pickGround\}/, 'the carousel is not the dropdown’s list');
  assert.match(mb, /options=\{groundOptions\}\s+onPick=\{pickGround\}/, 'the dropdown is not the same list');
  const bar = read(`${L}/studio-tools.tsx`);
  const look = bar.slice(bar.indexOf('export function StudioLookBar'));
  assert.doesNotMatch(look.slice(0, look.indexOf('\n}\n')), /tone="wine"/, 'Look’s bar is the filled wine section switch, not the prototype’s segmented');
});

test('5 · the full-screen surface: green switches, edge to edge, Look full width', () => {
  const css = studioFullScreenCss();
  assert.match(css, /input\[role=switch\]:checked\+span\{background-color:#4f6b4a\}/, 'switches are not the prototype’s green');
  assert.match(css, /\[data-details-editor-panel\]\[data-phone-chrome="panel"\]\{left:0;right:0;bottom:0;border-radius:0;box-shadow:none/, 'the editor still floats as a sheet');
  assert.match(css, /:has\(\[data-details-editor\]:not\(\[hidden\]\) \[data-studio-look-bar\]\)\{left:0;right:0/, 'Look’s panel is not full width');
  assert.match(css, /\[data-studio-row-end\]:has\(\[data-mood-board-studio-bar\]\) \[data-studio-row-saved\]\{display:none\}/);
});
