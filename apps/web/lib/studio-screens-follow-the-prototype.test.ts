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

test('1 · no Tool row and no Done band: the top bar says where you are — the pill’s Studio half is the page’s name ▾, "Stages ▾" beside it', async () => {
  /* Owner 2026-10-08: "we will not have these." (the "INFO ▾" row) → "make the top nav show where we are at" → "what
     if we just replace the Studio with a chevron?" · "and we just change that name of the studio" → "Stages and Studio
     both has dropdown". The pill's own claims are `lib/studio-pages-have-no-title-row.test.ts`; here: the row and the
     band are gone, the bar paints the page, and the Mood Board's ✨ Auto (which rode the row's end) is drawn in the
     Mood Board's own place. */
  const parts = await import(`../${L}/stages-studio-parts`);
  assert.equal((parts as Record<string, unknown>).StudioToolRow, undefined, 'the Tool row is still exported');
  assert.equal((parts as Record<string, unknown>).StudioDoneBar, undefined, 'the Done band is still exported');
  const march = tiles.find((t) => t.key === 'march')!;
  assert.equal((parts as Record<string, unknown>).StudioPageHead, undefined, 'the head that named only the page is still exported');
  assert.equal((parts as Record<string, unknown>).StudioBack, undefined, 'a ‹ is exported again — the list is one tap away from anywhere');
  const head = await html(React.createElement(parts.StudioSideSwitch, { side: 'studio', onPick: () => {}, stage: 'rsvp', page: march, tiles, onOpen: () => {} }));
  assert.match(head, /aria-pressed="true"[^>]*aria-label="Studio page: Wedding March — choose a page"/);
  assert.match(head, /aria-pressed="false"[^>]*aria-label="Stages — choose a stage"/, 'inside a page the way to the stages is gone');
  assert.doesNotMatch(head, /data-maker-studio-tool|data-maker-studio-done|uppercase|Saved/, 'the head still carries the old Tool ▾, ✓ Done or a Saved chip');
  assert.match(read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), /\{rowEnd \? createPortal\(bar, rowEnd\) : bar\}/, 'the Mood Board’s ✨ Auto has nowhere to be drawn without the row');
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
  /* The size ▾ and the Saves are client pieces (lazy on a server render) — their PLACES are read here, their shape from the source.
     RE-AIMED 2026-10-09 (Prints wears the templates): the name · sizes · size ▾ are ONE Form row, drawn by the lazy `print-head` part (its place is the
     lazy slot at the head of the editor), and the Saves — still right under it — are the ONE ActionButton (`variant="action"`), not the old chip. */
  assert.match(studio, /data-print-studio=""[^>]*>[\s\S]*?<\/div><div [^>]*data-print-piece-saves="invitation"/, 'the Saves are not right under the piece’s row');
  assert.doesNotMatch(studio, /This piece/, 'the old “This piece” block is still drawn');
  const src = read(`${L}/maker-prints.tsx`);
  const editor = src.slice(src.indexOf('export function PrintPieceEditor('), src.indexOf('export function PassCardsPanel('));
  assert.equal((editor.match(/variant="action"/g) ?? []).length, 3, 'a Studio Save is not the one ActionButton');
  assert.doesNotMatch(editor, /variant=\{studio \? 'chip'/, 'a Studio Save is still the old chip');
  assert.match(editor.slice(editor.indexOf('if (studio) {')), /part="print-head"[\s\S]{0,200}line=\{sizes\.length > 1 \? sizes\.join\(sizes\.length > 2 \? ' · ' : ' or '\) : spec\.size\}/, 'the Studio row has no name · sizes · size ▾');
  const shipped = await html(React.createElement(PrintPieceEditor, { input, piece: 'invitation' }));
  assert.match(shipped, /This piece/, 'the shipped Details lost its block — flag-off must not change');
});

test('4 · Studio › Look opens on its one bar: no tall tiles; Background is the dropdown’s own choices as cards, by source', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /const studioLook = maker\?\.stagesStudio === true && detailsLtSection\(selected\) === 'look';/);
  assert.match(ws, /const ltTiles = ltNav && !studioLook \?/, 'Studio › Look draws the tall tiles again (M29)');
  assert.match(ws, /if \(studioLook\) setSheetOpen\(true\);/, 'Studio › Look does not open on its controls');
  const mb = read('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  /* The carousel became picture cards under ONE Source ▾ (2026-10-08, the Look restudy row 2 —
     `the-background-has-one-source.test.ts`). What M29 held stays held: the Studio draws the dropdown's OWN
     choices through its OWN handler — the same loops, the same hero follow — never a second list. */
  assert.match(mb, /view === 'video'\s*\? loops\.map\(\(l\) => \([\s\S]{0,620}onPick=\{\(\) => pickGround\(l\.id\)\}/, 'the Video cards are not the dropdown’s loops');
  assert.match(mb, /name="Your cover photo"[\s\S]{0,260}onPick=\{\(\) => pickGround\('src:hero'\)\}/, 'the cover photo card is not the dropdown’s "Same as my hero"');
  assert.match(mb, /options=\{\[\.\.\.loops\.map\(groundLoopOption\), \.\.\.groundOwnOptions\]\}\s+onPick=\{pickGround\}/, 'the dropdown is not the same list');
  assert.doesNotMatch(mb, /GroundCarousel/, 'the carousel is drawn beside the cards');
  const bar = read(`${L}/studio-tools.tsx`);
  const look = bar.slice(bar.indexOf('export function StudioLookBar'));
  assert.doesNotMatch(look.slice(0, look.indexOf('\n}\n')), /tone="wine"/, 'Look’s bar is the filled wine section switch, not the prototype’s segmented');
});

test('5 · the full-screen surface: green switches, edge to edge, Look full width', () => {
  const css = studioFullScreenCss();
  assert.match(css, /input\[role=switch\]:checked\+span\{background-color:#4f6b4a\}/, 'switches are not the prototype’s green');
  assert.match(css, /\[data-details-editor-panel\]\[data-phone-chrome="panel"\]\{left:0;right:0;bottom:0;border-radius:0;box-shadow:none/, 'the editor still floats as a sheet');
  assert.match(css, /:has\(\[data-details-editor\]:not\(\[hidden\]\) \[data-studio-look-bar\]\)\{left:0;right:0/, 'Look’s panel is not full width');
});

test('6 · Attire: every colour a role wears is a button that opens the SAME picker, drafts the change, and can be removed', () => {
  const src = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  const attire = src.slice(src.indexOf("{tab === 'attire' ? ("), src.indexOf("{tab === 'insp' ? ("));
  assert.doesNotMatch(attire, /<i key=\{i\} aria-label=\{c\}/, 'a role’s colour is still a static dot (owner: “the palettes can still be changed to colors manually”)');
  assert.match(attire, /data-mood-board-role-colour=\{i\}[\s\S]*?onClick=\{\(\) => setSheet\(\{ kind: 'picker', target: \{ kind: 'role-colour'/, 'a dot does not open the picker');
  /* RE-AIMED 2026-10-09: the ＋ is the ActionButton, icon only — its label is its name. */
  assert.match(attire, /label=\{`Add a colour for \$\{row\.label\}`\}/, 'the role lost its ＋');
  /* The picker is the one sheet every colour here uses, and a pick goes through `commit` → the draft. */
  assert.equal((src.match(/<ColourPickerSheet/g) ?? []).length, 1, 'a second picker was invented');
  assert.match(src, /const setRoleColour = [\s\S]*?commit\(withRoleColours\(/, 'a role colour change does not go through the draft');
  assert.match(src, /const removeRoleColour = [\s\S]*?commit\(withRoleColours\(/, 'removing a role colour does not go through the draft');
  assert.match(src, /data-mood-board-role-remove/, 'no way to remove a role’s colour');
  /* RE-AIMED 2026-10-09: the fields come from `paletteDraftFields` (lib/studio-mood-board-saves.ts, held byte for byte by studio-mood-board-posts-the-same). */
  assert.match(src, /paletteDraftFields\(wrote\)/, 'the palette no longer writes into the draft');
});
