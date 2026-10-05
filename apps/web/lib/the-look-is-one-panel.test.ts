/**
 * the-look-is-one-panel.test.ts — LOOK = THEME · BACKGROUND · FONT · COLOURS,
 * IN THAT ORDER, IN ONE PANEL — AND NOWHERE ELSE.
 *
 * Owner, live iPhone test 2026-10-02 (tracker f40): the toolbar's Look showed
 * the theme and then the Hero — no background, no font, no colours. The hero
 * said to tap text on the canvas, which a phone's panel covers. The rulings:
 * DECISION_LOG 2026-09-30 "'BEHIND EVERY SCENE' MOVES INTO THEME, WITH FONTS
 * AND COLOURS" and "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE" (*"Theme sets
 * background + fonts + colours"*, *"one font dropdown"*), 2026-10-01 *"accessing
 * it here is too hidden"*. Design: `maker_in_four_2026-09-30_fable.html` frame E.
 *
 * Held here, each where it can be EXECUTED:
 *   (1) RENDER — the panel draws the four sections in `LOOK_SECTIONS` order,
 *       each with the control the work area registered (palette under Colours,
 *       with no caption under it — owner 2026-10-05);
 *   (2) the Look door's item mounts that panel, and its body is the couple's
 *       own page (a change shows as it is made), the theme gallery one switch away;
 *   (3) MOVED, NOT COPIED — the same rows the editor page always built, and
 *       their old places (the hero's page, the 🎨 panel, the Dress code
 *       scene's Style) no longer hold them; an old `?open=` lands on Look;
 *   (4) the Font and Colours parts post only their own fields;
 *   (5) Apply's "Go to" for each of them opens Look.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { LOOK_ROW_OF, LOOK_SECTIONS, isLookRow } from './maker-look-sections';
import { HUB_DRAFT_FIELD } from './hub-draft';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';

const stub = (name: string) => React.createElement('div', { 'data-stub': name });

async function paintPanel(look: unknown) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { LookPanel } = await import(`../${L}/details-look-pages`);
  const noop = () => {};
  const value = {
    eventId: 'ev-1',
    stage: 'rsvp',
    setStage: noop,
    device: 'phone',
    navOpen: true,
    selection: { kind: 'tool', key: 'details' },
    select: noop,
    moreOpen: false,
    renderStamp: '1',
    storeShell: false,
    seeAs: null,
    addScene: null,
    setAddScene: noop,
    detailsItem: 'theme',
    setDetailsItem: noop,
    lookPages: look === undefined ? null : { logo: null, hero: null, reveal: null, revealOptions: null, heroParts: null, revealStages: [], publicLandingUrl: '/ana-ben', look },
    setLookPages: noop,
  };
  return renderToStaticMarkup(
    React.createElement(MakerContext.Provider, { value }, React.createElement(LookPanel, { theme: stub('theme-menu') })),
  );
}

const sectionsOf = (html: string) => [...html.matchAll(/data-look-section="([a-z]+)"/g)].map((m) => m[1]);

/* ── (1) the render ───────────────────────────────────────────────────── */

test('(1) Look draws Theme · Background · Font · Colours · Buttons, in that order, each with its own control', async () => {
  assert.deepEqual([...LOOK_SECTIONS], ['theme', 'background', 'font', 'colours', 'buttons']);
  const html = await paintPanel({
    background: stub('main-background'),
    font: stub('font-pick'),
    colours: stub('page-and-buttons'),
    palette: stub('palette-look'),
    buttons: stub('buttons-look'),
  });
  assert.deepEqual(sectionsOf(html), ['theme', 'background', 'font', 'colours', 'buttons'], 'the sections are out of order');
  // Each control sits in ITS section — sliced between one section's mark and the next.
  const at = (k: string) => html.indexOf(`data-look-section="${k}"`);
  const inSection = (k: string, next: string | null, what: string) => {
    const part = html.slice(at(k), next ? at(next) : undefined);
    assert.match(part, new RegExp(`data-stub="${what}"`), `${what} is not in ${k}`);
  };
  inSection('theme', 'background', 'theme-menu');
  inSection('background', 'font', 'main-background');
  inSection('font', 'colours', 'font-pick');
  inSection('colours', 'buttons', 'page-and-buttons');
  inSection('colours', 'buttons', 'palette-look');
  inSection('buttons', null, 'buttons-look');
  // The palette sits AFTER the page and button colours.
  assert.ok(html.indexOf('data-stub="palette-look"') > html.indexOf('data-stub="page-and-buttons"'));
  for (const label of ['Background', 'Font', 'Colours', 'Buttons']) assert.match(html, new RegExp(`>${label}</h3>`), `no "${label}" heading`);
});

test('(1) a section the event does not offer is absent; one that has not arrived SAYS it is opening', async () => {
  // The store shell builds no Main background row: Look has no Background section — never an empty heading.
  const shell = await paintPanel({ background: null, font: stub('font-pick'), colours: stub('page-and-buttons'), palette: null, buttons: stub('buttons-look') });
  assert.deepEqual(sectionsOf(shell), ['theme', 'font', 'colours', 'buttons']);
  // Before the work area registered anything: every section is drawn, waiting — never blank.
  const early = await paintPanel(undefined);
  assert.deepEqual(sectionsOf(early), ['theme', 'background', 'font', 'colours', 'buttons']);
  assert.equal((early.match(/data-look-section-waiting=/g) ?? []).length, 4);
});

/* ── (2) the Look door's item ─────────────────────────────────────────── */

test('(2) the Look item mounts the one panel, and its body is the couple’s own page', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /theme: <LookPanel theme=\{<MakerThemeMenu /, 'the Look item does not mount the one panel');
  assert.match(details, /<DetailsLookPageBody\s+gallery=\{\s*<MakerThemeGallery/, 'the theme gallery is not one switch away');
  assert.match(details, /panelLabel: 'Look'/, 'the phone sheet does not say "Look"');
  const pages = read(`${L}/details-look-pages.tsx`);
  // The body: the page being edited, through the canvas door, on the Maker's stage.
  // …wearing the theme being picked, at the tap (`theme=`, owner 2026-10-05: the page drew Classic under a Cyber Neon pick).
  assert.match(pages, /item === 'look'\s*\?\s*look\.publicLandingUrl\s*\?\s*`\$\{look\.publicLandingUrl\}\?phase=\$\{maker\.stage\}&editor=1\$\{picked \? `&theme=\$\{encodeURIComponent\(picked\)\}` : ''\}`/);
  assert.match(pages, /view === 'page' \? \(\s*<DetailsLookBody item="look" \/>/, 'the page is not what Look shows first');
  // On a desktop, opening Look opens its panel; on a phone Theme lands on the lower third's navigator and its tile opens it (2026-10-05).
  assert.match(read(`${L}/details-workspace.tsx`), /if \(selected === 'theme' && !window\.matchMedia\('\(max-width: 1023\.98px\)'\)\.matches\) setSheetOpen\(true\);/);
});

/* ── (3) moved, not copied ────────────────────────────────────────────── */

test('(3) the SAME rows move into Look, and their old places no longer hold them', () => {
  const work = read(`${E}/editor-shell.tsx`);
  for (const [section, row] of Object.entries(LOOK_ROW_OF)) {
    assert.match(work, new RegExp(`const ${section}Node = rows\\[LOOK_ROW_OF\\.${section}\\]\\?\\.node \\?\\? null;`), `${section} is not the row the page built`);
    assert.ok(isLookRow(row));
  }
  assert.match(work, /look: \{\s*background: backgroundNode,\s*font: fontNode,\s*colours: coloursNode,\s*palette:/);
  assert.match(work, /buttons: buttonsNode,\s*\},\s*\}\);/, 'Look › Buttons is not the row the page built');
  // The 🎨 button's panel: the song and the backdrop, nothing that moved.
  const mainRows = /const MAIN_ROWS = (\[[^\]]*\]);/.exec(work)?.[1];
  assert.equal(mainRows, "['music', 'backdrop']", 'the 🎨 panel still holds a Look row');
  // The hero no longer carries the Main background.
  assert.match(work, /hero: madeOnce\?\.hero \?\? null,/);
  assert.doesNotMatch(work, /mainBackgroundRow/);
  // The Dress code scene's Style no longer draws the palette; Look's row does.
  const style = read(`${E}/scene-style-row.tsx`);
  const styleRow = style.slice(style.indexOf('export function SceneStyleCanvasRow'), style.indexOf('export function PaletteLookCanvasRow'));
  assert.ok(styleRow.length > 200, 'anti-vacuity: the Style row was not found');
  assert.doesNotMatch(styleRow, /PaletteLookRow/, 'the palette is drawn in two places');
  // 🚫 No caption under the palette (owner, live iPhone test 2026-10-05: no captions under controls).
  const palette = style.slice(style.indexOf('export function PaletteLookCanvasRow'));
  assert.ok(palette.includes('<PaletteLookRow'), 'anti-vacuity: the palette row was not found');
  assert.doesNotMatch(palette, /data-look-palette-line|\{line\}/, 'a caption came back under the palette');
  // An old `?open=` naming a moved row opens Look.
  assert.match(work, /if \(isLookRow\(initialOpenRow\)\) \{\s*setMakerItem\?\.\('theme'\);\s*select\(\{ kind: 'tool', key: 'details' \}\);/);
  // Each control is still built ONCE, by the editor page.
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.equal(page.split('<MainBackgroundPanel').length - 1, 1, 'the Main background is built twice');
  assert.equal(page.split('<ColorsPanel').length - 1, 2, 'Font and Colours are not the one panel, drawn as two parts');
  assert.match(page, /key: 'font',[\s\S]*?part="font"/);
  assert.match(page, /key: 'colors',[\s\S]*?part="colours"/);
  assert.equal(page.split('<ButtonsLookRow').length - 1, 1, 'Look › Buttons is built twice');
  assert.match(page, /key: 'buttons',[\s\S]*?<ButtonsLookRow/);
});

/* ── (4) each part posts only its own fields ──────────────────────────── */

test('(4) Font posts only the typeface; Colours never posts it — absent means unchanged', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColorsPanel } = await import(`../${E}/pro-panels`);
  const base = { action: () => {}, eventId: 'E1', bgColor: '#aabbcc', buttonColor: '#112233', artDirection: 'daylight' as const, fontKey: null };
  const font = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'font', part: 'font' }));
  assert.match(font, /name="site_font_key"/);
  assert.doesNotMatch(font, /name="bg_color"|name="button_color"|name="site_art_direction"|name="site_magic_traveller"/);
  const colours = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'colours' }));
  assert.match(colours, /name="bg_color"/);
  // 🔘 The button colour moved to Look › Buttons (2026-10-04): Colours no longer
  // posts it, which the action reads as "unchanged" — one field, one place.
  assert.doesNotMatch(colours, /name="button_color"/, 'the button colour is set in two places in Look');
  assert.doesNotMatch(colours, /name="site_font_key"/, 'Colours would post the font');
  // Both go into the draft.
  for (const html of [font, colours]) assert.match(html, new RegExp(`name="${HUB_DRAFT_FIELD}" value="1"`), 'a part saves live, not into the draft');
  // The action reads absent as unchanged — the rule the split rests on.
  const action = read('app/dashboard/[eventId]/website/colors/actions.ts');
  assert.match(action, /formData\.has\('bg_color'\)/);
  assert.match(action, /typeof fontRaw === 'string'/);
});

/* ── (5) Apply's "Go to" ──────────────────────────────────────────────── */

test('(5) Apply’s "Go to" for the theme, the background, the font and the colours opens Look', () => {
  const fx = read('lib/hub-pro-effects.ts');
  for (const what of ['Typeface', 'Candlelight', 'Magic move', 'Ombré background']) {
    assert.match(fx, new RegExp(`what: '${what}', where: 'Whole Event Hub', jump: \\{ kind: 'look' \\}`), what);
  }
  assert.match(fx, /where: 'Behind every scene',\s*jump: \{ kind: 'look' \}/);
  assert.match(fx, /what: 'Theme', [^\n]*jump: \{ kind: 'look' \}/);
  assert.doesNotMatch(fx, /kind: 'row', key: 'colors'|kind: 'main'/, 'a jump still opens an old place');
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /if \(j\.kind === 'look'\) \{[\s\S]*?setDetailsItem\)?\?\.\('theme'\);\s*maker\.select\(\{ kind: 'tool', key: 'details' \}\);/);
});
