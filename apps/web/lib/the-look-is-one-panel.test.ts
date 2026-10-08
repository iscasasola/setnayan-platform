/**
 * the-look-is-one-panel.test.ts — LOOK = BACKGROUND · ELEMENTS · MUSIC, IN THAT
 * ORDER, IN ONE PANEL — AND NOWHERE ELSE. NO THEME TO PICK. NO SAVE BUTTON.
 *
 * 🌄 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND · ELEMENTS ·
 * MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 6 row 1). Owner,
 * verbatim: *"colors here is not color of the background but the colors of the
 * different fonts, and buttons and highlights"* · *"Background, Elements (combine
 * the font color and styles?) and Music?"* · *"i see a hero video on music. this
 * should be for the background"* · *"and no save button"*. So:
 *   · three sections — it WAS Background · Colours · Buttons · Font · Music (2026-10-06);
 *   · the page fill moved from Colours INTO Background; the hero video moved from
 *     Music INTO Background; Colours · Font · Buttons sit under Elements;
 *   · the Save the Date film's "Same as the Event Hub" line left Look;
 *   · the song and the video draft the moment they change — no Save in either Maker.
 * Every assertion the older shape held is kept below, re-aimed at the new one.
 *
 * 🚫 2026-10-05 (DECISION_LOG "THEMES ARE REPLACED BY THREE DIRECT GLOBAL
 * SETTINGS", owner: *"instead of having a theme, we can let them just pick a
 * background. and pick a font, color, button style"*): the Theme section and
 * the "All themes" gallery left Look; every theme's loop became a choice under
 * Background (Moving background ◆). The checks below hold that no theme picker
 * comes back.
 *
 * Owner, live iPhone test 2026-10-02 (tracker f40): the toolbar's Look showed
 * the theme and then the Hero — no background, no font, no colours. The rulings:
 * DECISION_LOG 2026-09-30 "'BEHIND EVERY SCENE' MOVES INTO THEME, WITH FONTS
 * AND COLOURS" and "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE", 2026-10-01
 * *"accessing it here is too hidden"*.
 *
 * Held here, each where it can be EXECUTED:
 *   (1) RENDER — the panel draws its sections in `LOOK_SECTIONS` order, each
 *       from its parts (`LOOK_SECTION_PARTS`), each part the control the work
 *       area registered (the palette under Colours, no caption under it);
 *   (2) the Look door's item mounts that panel, and its body is the couple's
 *       own page (a change shows as it is made) — no theme gallery, no theme menu;
 *   (3) MOVED, NOT COPIED — the same rows the editor page always built, and
 *       their old places (the hero's page, the 🎨 panel, the Dress code
 *       scene's Style, Colours' page fill, Music's hero video) no longer hold
 *       them; an old `?open=` or `?item=` lands on Look;
 *   (4) each part posts only its own fields, into the draft;
 *   (5) Apply's "Go to" for each of them opens Look;
 *   (6) NO SAVE — the song and the hero video post themselves on change.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { LOOK_PARTS, LOOK_ROW_OF, LOOK_SECTIONS, LOOK_SECTION_PARTS, isLookRow } from './maker-look-sections';
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
    React.createElement(MakerContext.Provider, { value }, React.createElement(LookPanel, {})),
  );
}

const sectionsOf = (html: string) => [...html.matchAll(/data-look-section="([a-z]+)"/g)].map((m) => m[1]);
const partsOf = (html: string) => [...html.matchAll(/data-look-part="([a-z]+)"/g)].map((m) => m[1]);

/** Every part, each a stub named for the row it is. */
const ALL = {
  background: stub('main-background'),
  page: stub('page-fill'),
  video: stub('hero-video'),
  colours: stub('art-and-motion'),
  palette: stub('palette-look'),
  font: stub('font-pick'),
  buttons: stub('buttons-look'),
  music: stub('music'),
};

/* ── (1) the render ───────────────────────────────────────────────────── */

test('(1) Look draws Background · Elements · Music, in that order, each with its own controls — no Theme, no film line', async () => {
  assert.deepEqual([...LOOK_SECTIONS], ['background', 'elements', 'music']);
  // Every part belongs to exactly ONE section — a control is never drawn twice, never dropped.
  assert.deepEqual(LOOK_SECTIONS.flatMap((k) => [...LOOK_SECTION_PARTS[k]]).sort(), [...LOOK_PARTS].sort());
  assert.deepEqual(LOOK_SECTION_PARTS.background, ['background', 'page', 'video'], 'the page fill and the hero video are not Background’s');
  assert.deepEqual(LOOK_SECTION_PARTS.elements, ['colours', 'font', 'buttons']);
  assert.deepEqual(LOOK_SECTION_PARTS.music, ['music'], 'Music holds something that is not music');
  const html = await paintPanel(ALL);
  assert.deepEqual(sectionsOf(html), ['background', 'elements', 'music'], 'the sections are out of order');
  assert.deepEqual(partsOf(html), ['background', 'page', 'video', 'colours', 'font', 'buttons', 'music'], 'the parts are out of order');
  assert.doesNotMatch(html, />Theme</, 'a Theme heading came back');
  // Each control sits in ITS section — sliced between one section's mark and the next.
  const at = (k: string) => html.indexOf(`data-look-section="${k}"`);
  const inSection = (k: string, next: string | null, what: string) => {
    const part = html.slice(at(k), next ? at(next) : undefined);
    assert.match(part, new RegExp(`data-stub="${what}"`), `${what} is not in ${k}`);
  };
  inSection('background', 'elements', 'main-background');
  // 🌈 The page fill (it was under Colours) and 🎬 the hero video (it was under Music) are Background's.
  inSection('background', 'elements', 'page-fill');
  inSection('background', 'elements', 'hero-video');
  inSection('elements', 'music', 'art-and-motion');
  inSection('elements', 'music', 'palette-look');
  inSection('elements', 'music', 'font-pick');
  inSection('elements', 'music', 'buttons-look');
  inSection('music', null, 'music');
  assert.doesNotMatch(html.slice(at('music')), /data-stub="hero-video"/, 'the hero video is under Music again');
  assert.doesNotMatch(html.slice(at('elements'), at('music')), /data-stub="page-fill"/, 'the page fill is under Elements (Colours) again');
  // The palette sits AFTER the colours it goes with, in the same part.
  assert.ok(html.indexOf('data-stub="palette-look"') > html.indexOf('data-stub="art-and-motion"'));
  assert.ok(html.indexOf('data-stub="palette-look"') < html.indexOf('data-stub="font-pick"'));
  for (const label of ['Background', 'Elements', 'Music']) assert.match(html, new RegExp(`>${label}</h3>`), `no "${label}" heading`);
  for (const gone of ['Colours', 'Buttons', 'Font']) assert.doesNotMatch(html, new RegExp(`>${gone}</h3>`), `"${gone}" is a section of its own again`);
  // Inside Elements each control is named — Colours · Font · Buttons; Background and Music name themselves.
  assert.deepEqual([...html.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map((m) => m[1]), ['Colours', 'Font', 'Buttons']);
  // 🎞 The Save the Date film's "Same as the Event Hub" line left Look (2026-10-08) — no prop carries one in.
  const pages = read(`${L}/details-look-pages.tsx`);
  assert.doesNotMatch(pages, /filmLine/, 'the film line is drawn in Look again');
  assert.doesNotMatch(read(`${L}/maker-details.tsx`), /filmLine|FilmFollowsTheme|film-follows/, 'Look still builds the film line');
  assert.doesNotMatch(read(`${L}/studio-tools.tsx`), /FilmFollowsTheme|film-follows/, 'the Studio door still carries the film line');
});

test('(1) a part the event does not offer is absent; one that has not arrived SAYS it is opening', async () => {
  // The store shell builds no Main background row and no hero video: Background is the page fill alone — never an empty heading.
  const shell = await paintPanel({ ...ALL, background: null, video: null, palette: null, music: null });
  assert.deepEqual(sectionsOf(shell), ['background', 'elements']);
  assert.deepEqual(partsOf(shell), ['page', 'colours', 'font', 'buttons']);
  // …and with none of its parts a section is not drawn at all.
  const bare = await paintPanel({ ...ALL, background: null, page: null, video: null });
  assert.deepEqual(sectionsOf(bare), ['elements', 'music']);
  // Before the work area registered anything: every section is drawn, waiting — never blank.
  const early = await paintPanel(undefined);
  assert.deepEqual(sectionsOf(early), ['background', 'elements', 'music']);
  assert.equal((early.match(/data-look-section-waiting=/g) ?? []).length, 3);
});

test('(1b) each Look row of Event Details opens the panel on ITS section — and never a blank panel', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { LookPanel } = await import(`../${L}/details-look-pages`);
  const { LOOK_ITEM_SECTIONS } = await import('./maker-look-sections');
  const look = { ...ALL, palette: null, music: null };
  const paint = (sections: readonly string[], extras?: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(
        MakerContext.Provider,
        { value: { lookPages: { logo: null, hero: null, reveal: null, revealOptions: null, heroParts: null, revealStages: [], publicLandingUrl: '/a', look } } },
        React.createElement(LookPanel, { sections, extras }),
      ),
    );
  assert.deepEqual(sectionsOf(paint(LOOK_ITEM_SECTIONS.background)), ['background']);
  assert.deepEqual(sectionsOf(paint(LOOK_ITEM_SECTIONS.elements)), ['elements']);
  assert.deepEqual(partsOf(paint(LOOK_ITEM_SECTIONS.elements)), ['colours', 'font', 'buttons']);
  // One section alone is named by its row — no second heading over it.
  assert.doesNotMatch(paint(LOOK_ITEM_SECTIONS.elements), /<h3/);
  // Music not offered: ONE line, never an empty panel (owner 2026-10-06).
  const music = paint(LOOK_ITEM_SECTIONS.music);
  assert.deepEqual(sectionsOf(music), []);
  assert.match(music, /data-look-panel-empty="music"[^>]*>Nothing to set here for this event\.</);
  // 🧭 What the Studio adds rides straight UNDER the part it belongs to (the five main colours under Colours).
  const withFive = paint(LOOK_ITEM_SECTIONS.elements, { colours: stub('the-five') });
  assert.ok(withFive.indexOf('data-stub="the-five"') > withFive.indexOf('data-stub="art-and-motion"'));
  assert.ok(withFive.indexOf('data-stub="the-five"') < withFive.indexOf('data-stub="font-pick"'), 'the five main colours are not under Colours');
  // 🔑 ONE mount of each control: a named panel draws only while its item is open.
  const named = (item: string, open: string) =>
    renderToStaticMarkup(
      React.createElement(
        MakerContext.Provider,
        { value: { detailsItem: open, lookPages: { logo: null, hero: null, reveal: null, revealOptions: null, heroParts: null, revealStages: [], publicLandingUrl: '/a', look } } },
        React.createElement(LookPanel, { sections: LOOK_ITEM_SECTIONS.elements, item }),
      ),
    );
  assert.equal(named('elements', 'background'), '', 'a Look control is mounted twice (its item is not open)');
  assert.deepEqual(sectionsOf(named('elements', 'elements')), ['elements']);
  const { detailsLtSection, detailsItemFor, LOOK_SECTION_ITEM_KEYS, isDetailsItemKey } = await import('./maker-details-items');
  // The rows of Event Details ARE the sections — one list, never two.
  assert.deepEqual([...LOOK_SECTION_ITEM_KEYS], [...LOOK_SECTIONS], 'Event Details lists different Look rows from the panel’s sections');
  for (const k of LOOK_SECTIONS) assert.deepEqual([...LOOK_ITEM_SECTIONS[k]], [k], `the ${k} row opens more than its own section`);
  assert.equal(detailsLtSection('theme'), 'look', 'the whole Look lights Your event on a phone');
  assert.equal(detailsLtSection('elements'), 'look');
  assert.equal(detailsLtSection('parents'), 'story');
  // 🔗 An address written before 2026-10-08 opens where its controls live now — never the first row.
  assert.ok(!isDetailsItemKey('colours') && !isDetailsItemKey('font'), 'Colours / Font are rows of their own again');
  assert.equal(detailsItemFor({ item: 'colours' }), 'elements');
  assert.equal(detailsItemFor({ item: 'font' }), 'elements');
  assert.equal(detailsItemFor({ item: 'constructor' }), 'background', 'a made-up item opened something');
  const details = read(`${L}/maker-details.tsx`);
  for (const k of LOOK_SECTIONS) {
    assert.match(details, new RegExp(`${k}: <LookPanel sections=\\{LOOK_ITEM_SECTIONS\\.${k}\\} item="${k}" />`), `the ${k} row does not open its section`);
  }
  // …and the new Maker's Studio draws the SAME panel under its one bar, with its extras under their parts.
  assert.match(details, /<StudioTool part="look" item=\{k\} \/>\s*<LookPanel sections=\{LOOK_ITEM_SECTIONS\[k\]\} item=\{k\} extras=\{lookExtras\[k\]\} \/>/);
  assert.match(details, /background: st\.main !== undefined \? \{ background: <StudioTool part="main-extras"/, 'the main background’s extras are not under the main background');
  assert.match(details, /\? \{ colours: <StudioTool part="main-colours"/, 'the five main colours are not under Elements › Colours');
  assert.match(details, /bodyAlias=\{\{ background: 'theme', elements: 'theme', music: 'theme' \}\}/, 'a Look row does not show the page');
  // The Studio's home tile names the three too — derived from the list, never a second copy of it.
  const { STUDIO_TILES } = await import('./studio-tiles');
  assert.equal(STUDIO_TILES.look.sub, 'Background · Elements · Music', 'the Look tile still names the old sections');
  // The Studio's one bar says the three, and draws one segment per row of that list.
  const tools = read(`${L}/studio-tools.tsx`);
  assert.match(tools, /STUDIO_LOOK_LABEL: Readonly<Record<LookSectionItemKey, string>> = \{\s*background: 'Background',\s*elements: 'Elements',\s*music: 'Music',\s*\};/, 'the Studio’s bar does not say Background · Elements · Music');
  assert.match(tools, /\{LOOK_SECTION_ITEM_KEYS\.map\(\(k\) => \(\s*<ISeg key=\{k\} on=\{k === item\}/, 'the Studio’s bar is not drawn from the one list');
});

/* ── (2) the Look door's item ─────────────────────────────────────────── */

test('(2) the Look item mounts the one panel, and its body is the couple’s own page', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /theme: <LookPanel item="theme" \/>,/, 'the Look item does not mount the one panel');
  assert.match(details, /theme: <DetailsLookPageBody \/>,/, 'the Look body is not the couple’s own page');
  // 🚫 No theme picker anywhere in the Maker's Look (2026-10-05).
  assert.doesNotMatch(details, /<MakerThemeMenu\b|<MakerThemeGallery\b/, 'a theme picker came back into the Maker');
  assert.match(details, /panelLabel: 'Look'/, 'the phone sheet does not say "Look"');
  const pages = read(`${L}/details-look-pages.tsx`);
  // The body: the page being edited, through the canvas door, on the Maker's stage.
  // …wearing the theme being picked, at the tap (`theme=`, owner 2026-10-05: the page drew Classic under a Cyber Neon pick).
  assert.match(pages, /item === 'look'\s*\?\s*look\.publicLandingUrl\s*\?\s*`\$\{look\.publicLandingUrl\}\?phase=\$\{maker\.stage\}&editor=1\$\{picked \? `&theme=\$\{encodeURIComponent\(picked\)\}` : ''\}`/);
  assert.match(pages, /data-details-look-body="page">\s*<DetailsLookBody item="look" \/>/, 'the page is not what Look shows');
  assert.doesNotMatch(pages, /All themes/, 'the "All themes" switch came back');
  // On a desktop, opening Look opens its panel; on a phone Theme lands on the lower third's navigator and its tile opens it (2026-10-05).
  assert.match(read(`${L}/details-workspace.tsx`), /if \(selected === 'theme' && !window\.matchMedia\('\(max-width: 1023\.98px\)'\)\.matches\) setSheetOpen\(true\);/);
});

/* ── (3) moved, not copied ────────────────────────────────────────────── */

test('(3) the SAME rows move into Look, and their old places no longer hold them', () => {
  const work = read(`${E}/editor-shell.tsx`);
  assert.deepEqual(Object.keys(LOOK_ROW_OF).sort(), [...LOOK_PARTS].sort(), 'a part has no row, or a row no part');
  for (const [part, row] of Object.entries(LOOK_ROW_OF)) {
    assert.match(work, new RegExp(`const ${part}Node = rows\\[LOOK_ROW_OF\\.${part}\\]\\?\\.node \\?\\? null;`), `${part} is not the row the page built`);
    assert.ok(isLookRow(row));
  }
  assert.match(work, /look: \{\s*background: backgroundNode,\s*font: fontNode,\s*colours: coloursNode,\s*palette:/);
  assert.match(work, /buttons: buttonsNode,\s*music: musicNode,\s*page: pageNode,\s*video: videoNode,\s*\},\s*\}\);/, 'Look › Buttons / Music / the page fill / the hero video is not the row the page built');
  // …and Look is told again when either of the two moved rows changes.
  assert.match(work, /\[setLookPages, madeOnce, backgroundNode, fontNode, coloursNode, buttonsNode, musicNode, pageNode, videoNode,/);
  // The 🎵 panel: the song alone — "backdrop" dropped (owner 2026-10-06, Background covers it).
  const mainRows = /const MAIN_ROWS = (\[[^\]]*\]);/.exec(work)?.[1];
  assert.equal(mainRows, "['music']", 'the Music panel still holds the backdrop or a Look row');
  assert.match(work, /\? 'Music'/, 'the panel is still called "Music and backdrop"');
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
  // 🔤 Font · 🌈 the page fill · 🎨 Candlelight and Magic Move — the ONE Colors panel, drawn as its three parts.
  assert.equal(page.split('<ColorsPanel').length - 1, 3, 'Font, the page fill and Colours are not the one panel, drawn as three parts');
  assert.match(page, /key: 'font',[\s\S]*?part="font"/);
  assert.match(page, /key: 'page-colour',[\s\S]*?part="page"/, 'the page fill is not a row of its own (Look › Background)');
  assert.match(page, /key: 'colors',[\s\S]*?part="art"/, 'Colours still carries the page fill');
  assert.doesNotMatch(page, /part="colours"/, 'the page fill is built under Colours again');
  assert.equal(page.split('<ButtonsLookRow').length - 1, 1, 'Look › Buttons is built twice');
  assert.match(page, /key: 'buttons',[\s\S]*?<ButtonsLookRow/);
  // 🎵 The song · 🎬 the hero video — the ONE form's two parts, each built once, each its own row.
  assert.equal(page.split('<SiteChromePanel').length - 1, 2, 'the song and the hero video are not the one panel, drawn as two parts');
  const musicRow = page.slice(page.indexOf("key: 'music',"), page.indexOf("key: 'hero-video',"));
  assert.ok(musicRow.length > 100, 'anti-vacuity: the music row was not found before the hero video’s');
  assert.match(musicRow, /<SiteChromePanel[\s\S]*?part="music"/);
  assert.doesNotMatch(musicRow, /part="video"/, 'the hero video is built under Music again');
  assert.match(page.slice(page.indexOf("key: 'hero-video',")), /^key: 'hero-video',[\s\S]{0,700}?<SiteChromePanel[\s\S]{0,200}?part="video"/, 'the hero video is not a row of its own (Look › Background)');
});

/* ── (4) each part posts only its own fields ──────────────────────────── */

test('(4) Font posts only the typeface; the page fill only the page; Colours neither — absent means unchanged', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColorsPanel } = await import(`../${E}/pro-panels`);
  const base = { action: () => {}, eventId: 'E1', bgColor: '#aabbcc', buttonColor: '#112233', artDirection: 'daylight' as const, fontKey: null };
  const font = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'font', part: 'font' }));
  assert.match(font, /name="site_font_key"/);
  assert.doesNotMatch(font, /name="bg_color"|name="button_color"|name="site_art_direction"|name="site_magic_traveller"/);
  // 🌈 Look › Background's page fill: the one colour and its four effects, and nothing else.
  const pageFill = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'page-colour', part: 'page' }));
  assert.match(pageFill, /name="bg_color"/);
  for (const e of ['plain', 'dawn', 'diagonal', 'glow']) assert.match(pageFill, new RegExp(`data-background-effect="${e}"`), `the page fill lost ${e}`);
  assert.doesNotMatch(pageFill, /name="button_color"|name="site_font_key"|name="site_art_direction"|name="site_magic_traveller"/, 'the page fill would post a colour of the Elements');
  // 🎨 Look › Elements › Colours: Candlelight and Magic Move — never the page.
  const colours = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'art' }));
  assert.match(colours, /name="site_art_direction"/);
  assert.match(colours, /name="site_magic_traveller"/);
  assert.doesNotMatch(colours, /name="bg_color"|data-background-effect=/, 'the page fill is drawn under Colours again');
  // 🔘 The button colour moved to Look › Buttons (2026-10-04): Colours no longer
  // posts it, which the action reads as "unchanged" — one field, one place.
  assert.doesNotMatch(colours, /name="button_color"/, 'the button colour is set in two places in Look');
  assert.doesNotMatch(colours, /name="site_font_key"/, 'Colours would post the font');
  // Its Pro half locked with no lock to show (the app-store shell): nothing is drawn — never an empty strip.
  assert.equal(renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'art', proLocked: true, proLock: null })), '');
  // All of them go into the draft.
  for (const html of [font, pageFill, colours]) assert.match(html, new RegExp(`name="${HUB_DRAFT_FIELD}" value="1"`), 'a part saves live, not into the draft');
  // The record row's whole Colours (Event Details › Colours, outside the Maker) keeps the page and the Pro half in one form.
  const whole = renderToStaticMarkup(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'colours' }));
  assert.match(whole, /name="bg_color"/);
  assert.match(whole, /name="site_art_direction"/);
  // The action reads absent as unchanged — the rule the split rests on.
  const action = read('app/dashboard/[eventId]/website/colors/actions.ts');
  assert.match(action, /formData\.has\('bg_color'\)/);
  assert.match(action, /typeof fontRaw === 'string'/);
  assert.match(action, /typeof magicRaw === 'string'/);
});

/* ── (5) Apply's "Go to" ──────────────────────────────────────────────── */

test('(5) Apply’s "Go to" for the theme, the background, the font, the colours and the hero video opens Look', async () => {
  const fx = read('lib/hub-pro-effects.ts');
  for (const what of ['Typeface', 'Candlelight', 'Magic move', 'Ombré background']) {
    assert.match(fx, new RegExp(`what: '${what}', where: 'Whole Event Hub', jump: \\{ kind: 'look' \\}`), what);
  }
  assert.match(fx, /where: 'Behind every scene',\s*jump: \{ kind: 'look' \}/);
  assert.match(fx, /what: 'Theme', [^\n]*jump: \{ kind: 'look' \}/);
  // 🎬 The hero video is Look › Background's — its "Go to" no longer opens the Music panel.
  assert.match(fx, /what: 'Hero video', where: 'Hero', jump: \{ kind: 'look' \}/, 'the hero video’s "Go to" still opens Music');
  assert.doesNotMatch(fx, /kind: 'row', key: 'colors'|kind: 'main'/, 'a jump still opens an old place');
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /if \(j\.kind === 'look'\) \{[\s\S]*?setDetailsItem\)?\?\.\('theme'\);\s*maker\.select\(\{ kind: 'tool', key: 'details' \}\);/);
  // …and the Apply sheet names each change where it now lives.
  const { HUB_DRAFT_EVENT_PLACE } = await import('./hub-draft-change-lines');
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.site_bg_color, { place: 'Look', what: 'Page colour' });
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.landing_page_hero_video_r2_key, { place: 'Look', what: 'Hero video' });
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.site_font_key, { place: 'Look', what: 'Font' });
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.site_button_style, { place: 'Look', what: 'Buttons' });
  assert.deepEqual(HUB_DRAFT_EVENT_PLACE.main_colours, { place: 'Look', what: 'Colours' });
});

/* ── (6) no Save ──────────────────────────────────────────────────────── */

test('(6) no Save in Look: the song, its switch and the hero video each post themselves into the draft, in two forms', async () => {
  const src = read(`${E}/media-panels.tsx`);
  const panel = src.slice(src.indexOf('export function SiteChromePanel('), src.indexOf('export function VisibilityPanel('));
  assert.ok(panel.length > 500, 'anti-vacuity: the panel was not found');
  assert.doesNotMatch(panel, /SaveButton/, 'a Save button is drawn under the song or the video');
  assert.match(panel, /<HubDraftField \/>/, 'the song and the video no longer write into the draft');
  assert.equal((panel.match(/onChange=\{draftNow\}/g) ?? []).length, 3, 'the song, the switch and the video do not each draft at once');
  // In BOTH Makers — the post is not held back for the shipped one any more.
  assert.match(panel, /const draftNow = \(\) => void window\.requestAnimationFrame\(\(\) => formRef\.current\?\.requestSubmit\(\)\);/, 'a change waits for a Save in one of the Makers');
  // What each part posts — rendered, never read off the source.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SiteChromePanel } = await import(`../${E}/media-panels`);
  const base = { action: () => {}, eventId: 'E1', musicRef: 'r2://setnayan-media/events/E1/site-music/song.mp3', musicEnabled: true, videoRef: 'r2://setnayan-media/events/E1/landing-page-hero-video/clip.mp4' };
  const music = renderToStaticMarkup(React.createElement(SiteChromePanel, { ...base, part: 'music' }));
  assert.match(music, /data-site-chrome="music"[\s\S]*>Background music</);
  assert.match(music, /name="bg_music_enabled"/);
  assert.doesNotMatch(music, /Hero video|video\/mp4/, 'Music still holds the hero video');
  const video = renderToStaticMarkup(React.createElement(SiteChromePanel, { ...base, part: 'video' }));
  assert.match(video, /data-site-chrome="video"[\s\S]*>Hero video</);
  assert.doesNotMatch(video, /Background music|name="bg_music_enabled"|audio\/mpeg/, 'the hero video’s form would post the song (and switch it off)');
  // (The upload's own field is written by the uploader once it holds a value — read off the two branches.)
  const [musicBranch, videoBranch] = panel.slice(panel.indexOf("{part === 'music' ? (")).split(') : (');
  assert.match(musicBranch ?? '', /name="bg_music_url"/);
  assert.doesNotMatch(musicBranch ?? '', /name="hero_video_url"/);
  assert.match(videoBranch ?? '', /name="hero_video_url"/);
  assert.doesNotMatch(videoBranch ?? '', /name="bg_music_url"|name="bg_music_enabled"/);
  for (const html of [music, video]) {
    assert.match(html, new RegExp(`name="${HUB_DRAFT_FIELD}" value="1"`), 'a part saves live, not into the draft');
    assert.doesNotMatch(html, /type="submit"/, 'a Save button is drawn');
  }
  // The action writes a column only when the form carried its field — the rule the split rests on.
  const action = read('app/dashboard/[eventId]/website/site-chrome/actions.ts');
  const drafted = action.slice(action.indexOf('if (isHubDraftWrite(formData)) {'), action.indexOf("if (formData.has('bg_music_url')) {\n    const musicRef = r2RefOrNull(formData.get('bg_music_url'), eventId);\n    // Checkbox"));
  assert.match(drafted, /if \(formData\.has\('bg_music_url'\)\) \{[\s\S]*?site_bg_music_enabled/);
  assert.match(drafted, /if \(formData\.has\('hero_video_url'\)\) \{\s*events\.landing_page_hero_video_r2_key/);
});
