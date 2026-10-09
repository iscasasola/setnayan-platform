/**
 * background-is-four-rows.test.ts — THE TOOLBAR'S BACKGROUND (owner 2026-10-09, verbatim: *"copy the background on
 * studio look"*; `TOOLBAR-SPEC-2026-10-09.md` § BACKGROUND; the approved prototype's `bgRows`).
 *
 *   (1) FOUR ROWS, RENDERED — row 1 the source ▾ (no label), row 2 that source's choices as ONE row of small
 *       pictures, row 3 the choice's one control (a colour: ONE circle, + Opacity on a glass; a picture: ONE
 *       Darker ━ Lighter bar), row 4 Framed | Full width (+ Still | Parallax for a photo). The Event Hub's own: one
 *       quiet line and nothing under it. Sabotage: the shape drawn in row 3 → red.
 *   (2) WHAT A SCENE CAN STORE IS WHAT IS OFFERED — the sources and the Colour row are derived from the stored
 *       shape, executed against the sanitizer: every tile offered round-trips; "Dawn", a second colour and a
 *       ready-made loop are not offered because a scene cannot keep them. Sabotage: a "Dawn" tile → red.
 *   (3) A SOURCE PICKED ONLY SHOWS ITS CHOICES; a choice writes ONCE through the scene's own save; nothing asks
 *       "every scene?". Sabotage: the source dropdown writing a background → red.
 *   (4) THE BAR — the page follows the thumb (drawn in the browser, nothing saved) and ONE write is made on release,
 *       on the stop it settles on; the centre stores nothing. EXECUTED. Sabotage: a write per move → red.
 *   (6) THE VEIL FOR EVERY POSITION — executed for every theme and every place on the bar: the words never fall
 *       under the reading floor; the two words stored before the bar lay EXACTLY the veils they laid; further from
 *       the centre is never a weaker veil. Sabotage: the floor taken off the dark side → red.
 *   (7) PICTURE TILES (owner 2026-10-09, choosing among three drawings: *"A- picture tiles"*) — the name is written
 *       ON the tile, never on a sticker; the picked tile has ONE ring that the row never cuts; "None" is a white tile
 *       with one stroke; Opaque and Frosted are a flat tint and a soft glass, never stripes; a scene's picture and
 *       the couple's upload wear the same tile; and EVERY name is readable — executed for every flat colour, and
 *       for the worst picture there can be. Sabotage: the fade weakened → red; stripes back → red.
 *   (5) NOT DRAWN ANY MORE — In frame, How close, "Use where", "More", the ⓘ sentence, "Remove this scene's photo";
 *       what was stored for them is still read by the page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { BACKGROUND_SOURCE_IS_PRO, BACKGROUND_SOURCE_LABEL } from './background-source';
import { HUB_BACKGROUND_KINDS, resolveHubBackground, sanitizeHubCanvas } from './hub-canvas';
import { SP_BG_ROW, SP_BG_STRIP, SP_BG_TILE, SP_BG_TILE_ADD, SP_BG_TILE_FACE, SP_BG_TILE_FADE, SP_BG_TILE_NAME, SP_BG_TILE_RING_PX, SP_BG_TILE_SLASH, SP_BG_TILE_TONE, SP_ROWS, STAGE_PANEL_VARS, stageBarRow } from './maker-stage-room';
import { TILE_FADE, TILE_INK, TILE_LIGHT_FROM, TILE_WHITE, tileFadeFloor, tileFrostCss, tileFrostFoot, tileGlassColour, tileNameOnFlat, tileNameOnPicture } from './bg-tile-name';
import { STD_REALISTIC_BACKGROUNDS } from './std-backgrounds';
import { phoneHeightPx } from './maker-phone-room';
import { SCENE_SHADE_MAX, SCENE_SHADE_MIN, SCENE_SHADE_STOPS, sceneShadeAt, sceneShadeOf, sceneShadeSettled, sceneShadeWords } from './scene-shade-bar';
import { FADE_SNAP } from './background-fade';
import { sceneMediaShade, sceneMediaShadeVars, sceneShadeStep } from './scene-media-shade';
import { AA_BODY, contrastRatio, requiredScrim } from './hub-legibility';
import { INVITE_THEMES } from './invite-themes';
import { SCENE_MEDIA_SCRIM } from './scene-legibility';

/* The panel's pieces are compiled with the classic JSX runtime under `tsx` — they read `React` off the scope. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const has = (classes: string, c: string) => classes.split(' ').includes(c);
const ROW = (html: string) => [...html.matchAll(/class="([^"]*)" data-stage-bg="([a-z]+)"/g)].map((m) => `${/row-start-(\d)/.exec(m[1]!)?.[1]}:${m[2]}`);

type Props = Parameters<typeof import('../app/dashboard/[eventId]/launch/_components/stage-panel/stage-background').StageBackground>[0];
const base = (over: Partial<Props>): Props => ({
  source: 'colour',
  sources: [{ key: 'hub', pro: false }, { key: 'colour', pro: false }, { key: 'scene', pro: true }, { key: 'own', pro: true }],
  onSource: () => {},
  tiles: [],
  tile: null,
  onTile: () => {},
  onUpload: false,
  upload: null,
  colour: null,
  customColour: () => null,
  opacity: null,
  shade: null,
  shape: null,
  onShape: () => {},
  motion: null,
  onMotion: () => {},
  pending: false,
  ...over,
});

test('(1) four rows, rendered: the source, its choices in one row, the choice’s one control, its shape', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageBackground } = await import(`../${L}/stage-panel/stage-background`);
  const draw = (over: Partial<Props>) => renderToStaticMarkup(React.createElement(StageBackground, base(over)));
  const tiles = ['none', 'color', 'diagonal', 'glow', 'glass', 'frost'].map((key) => ({ key, name: key, picture: { background: '#c7a27c' } }));

  /* THE EVENT HUB'S OWN: the source and one quiet line — no control and no shape under it. */
  const hub = draw({ source: 'hub' });
  assert.deepEqual(ROW(hub), ['1:source', '2:choices']);
  assert.match(hub, />Uses the Event Hub’s own background\.</);
  assert.doesNotMatch(hub, /data-stage-bg-strip|type="range"|data-pill-selector/);
  /* Row 1 is ONE dropdown, with no small label (*"remove the Background Text"*), named for a screen reader. */
  assert.equal((hub.match(/aria-haspopup="listbox"|aria-haspopup="dialog"|aria-haspopup="true"|aria-haspopup="menu"/g) ?? []).length, 1, 'row 1 is not ONE dropdown');
  assert.match(hub, /<span class="[^"]*" data-dd-label=""><\/span>/, 'the source ▾ carries a label');

  /* A COLOUR (Plain): six small pictures in ONE row, the one worn ringed; row 3 ONE circle; row 4 Framed | Full width. */
  const plain = draw({ tiles, tile: 'color', colour: '#c7a27c', shape: 'framed' });
  assert.deepEqual(ROW(plain), ['1:source', '2:choices', '3:colour', '4:shape']);
  const drawn = [...plain.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*data-stage-bg-tile="([a-z]+)"[^>]*class="([^"]*)"/g)];
  assert.deepEqual(drawn.map((m) => m[2]), tiles.map((t) => t.key));
  assert.deepEqual(drawn.filter((m) => m[1] === 'true').map((m) => m[2]), ['color'], 'the choice worn is not the one ringed');
  for (const m of drawn) assert.equal(m[3], SP_BG_TILE);
  assert.match(plain, new RegExp(`data-stage-bg-strip="colour" class="${SP_BG_STRIP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;')}"`));
  assert.equal((plain.match(/data-stage-swatch=/g) ?? []).length, 1, 'the colour is more than ONE circle');
  assert.doesNotMatch(plain, /type="range"/, 'a plain colour has a bar');
  assert.deepEqual([...plain.matchAll(/data-seg="([a-z]+)"/g)].map((m) => m[1]), ['framed', 'full']);
  /* …a GLASS adds its Opacity bar beside the circle, in the same row. */
  const glass = draw({ tiles, tile: 'glass', colour: '#ffffff', opacity: { value: 85, min: 20, max: 100, step: 5, onChange: () => {} }, shape: 'full' });
  assert.deepEqual(ROW(glass), ['1:source', '2:choices', '3:colour', '4:shape']);
  assert.equal((glass.match(/type="range"/g) ?? []).length, 1);
  assert.match(glass, />Opacity<[\s\S]*>85%</);
  /* "None" has no box: no control, no shape. */
  assert.deepEqual(ROW(draw({ tiles, tile: 'none' })), ['1:source', '2:choices']);

  /* A PICTURE (a ready-made scene): row 3 is ONE bar between "Darker" and "Lighter"; row 4 adds Still | Parallax. */
  const photo = draw({ source: 'scene', tiles: [{ key: '/a.jpg', name: 'Garden', picture: {} }], tile: '/a.jpg', shade: { at: 0, onMove: () => {}, onKeep: () => {} }, shape: 'framed', motion: 'still' });
  assert.deepEqual(ROW(photo), ['1:source', '2:choices', '3:shade', '4:shape']);
  const bar = photo.slice(photo.indexOf('data-stage-bg="shade"'), photo.indexOf('data-stage-bg="shape"'));
  assert.deepEqual([...bar.matchAll(/>(Darker|Lighter)<|type="range"/g)].map((m) => m[1] ?? 'bar'), ['Darker', 'bar', 'Lighter'], 'row 3 is not "Darker ━ Lighter"');
  assert.match(bar, new RegExp(`min="${SCENE_SHADE_MIN}"[^>]*max="${SCENE_SHADE_MAX}"|max="${SCENE_SHADE_MAX}"[^>]*min="${SCENE_SHADE_MIN}"`));
  assert.deepEqual([...photo.matchAll(/data-seg="([a-z]+)"/g)].map((m) => m[1]), ['framed', 'full', 'still', 'parallax']);
  /* A clip has no Still | Parallax. */
  assert.deepEqual([...draw({ source: 'own', tiles: [], shade: { at: 0, onMove: () => {}, onKeep: () => {} }, shape: 'framed', motion: null }).matchAll(/data-seg="([a-z]+)"/g)].map((m) => m[1]), ['framed', 'full']);
  /* UPLOAD: its first tile is "＋ Upload" (it opens the in-place upload), then the couple's own. */
  const own = draw({ source: 'own', onUpload: true, tiles: [{ key: 'r2://x', name: 'Your photo', picture: {} }] });
  assert.deepEqual([...own.matchAll(/data-stage-bg-tile="([^"]+)"/g)].map((m) => m[1]), ['upload', 'r2://x']);
  assert.match(own, /<button[^>]*aria-haspopup="dialog"[^>]*data-stage-bg-tile="upload"/);

  /* ONE row tall, 44-px tiles, swiped sideways — and the rows are the toolbar's own grid, laid by `StageStyle`. */
  assert.equal(phoneHeightPx(SP_BG_TILE, 812), 44);
  /* (🔁 2026-10-09, commit 10 — picture tiles: the BUTTON is the 44-px tap, the FACE inside it is the 84-px picture.) */
  assert.ok(has(SP_BG_TILE_FACE, 'min-w-[84px]') && has(SP_BG_TILE, 'shrink-0'));
  assert.ok(has(SP_BG_STRIP, 'overflow-x-auto') && has(SP_BG_STRIP, 'overflow-y-hidden') && has(SP_BG_STRIP, 'h-full'));
  assert.ok(has(SP_BG_ROW, 'flex') && has(SP_BG_ROW, 'items-center') && !has(SP_BG_ROW, 'flex-wrap'));
  const { StageStyle } = await import(`../${L}/stage-panel/stage-style`);
  const { setStageTool } = await import(`../${L}/stage-panel/store`);
  setStageTool('bg');
  const pane = renderToStaticMarkup(React.createElement(StageStyle, { look: React.createElement('i'), background: React.createElement('b'), rows: true }));
  assert.match(pane, new RegExp(`^<div class="${SP_ROWS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} h-full px-\\[10px\\]" data-stage-style="bg" data-stage-bg-rows="">`), 'Background is not laid in the four rows');
  assert.doesNotMatch(pane, /overflow-y-auto/);
  setStageTool('edit');
});

test('(2) what a scene can store is what is offered — every tile round-trips; no Dawn, no second colour, no ready-made loop', () => {
  const row = read(`${E}/scene-background-row.tsx`);
  /* THE COLOUR ROW is exactly the scene's stored kinds that are not a picture — "None" first. */
  const tiles = /const COLOUR_TILES: readonly Exclude<Choice, 'media'>\[\] = \[([^\]]+)\];/.exec(row)?.[1]?.replace(/['\s]/g, '').split(',');
  assert.deepEqual(tiles, ['none', 'color', 'diagonal', 'glow', 'glass', 'frost']);
  assert.deepEqual([...tiles!].sort(), HUB_BACKGROUND_KINDS.filter((k) => k !== 'photo' && k !== 'snippet').slice().sort(), 'the Colour row offers a kind a scene cannot store, or misses one it can');
  /* Each survives the sanitizer as itself, with its ONE colour. */
  for (const kind of tiles!) {
    const kept = sanitizeHubCanvas({ canvas: { kind, color: '#c7a27c', own: true } });
    assert.equal(resolveHubBackground(kept)?.kind, kind, `${kind} does not round-trip`);
  }
  /* "Dawn" is a Look card, not a scene kind; a second colour and a ready-made loop have no stored field. */
  assert.ok(!(HUB_BACKGROUND_KINDS as readonly string[]).includes('dawn'));
  const two = sanitizeHubCanvas({ canvas: { kind: 'diagonal', color: '#c7a27c', color2: '#112233', own: true } }) as Record<string, unknown>;
  assert.equal(two.color2, undefined, 'a scene now keeps a second colour — offer it');
  assert.equal(resolveHubBackground(sanitizeHubCanvas({ canvas: { kind: 'snippet', media: '/loops/petals.mp4', own: true } })), null, 'a scene now keeps a ready-made loop — offer Video');
  assert.doesNotMatch(row.slice(row.indexOf('if (ss) {'), row.indexOf('<section data-scene-background-row')), /Dawn|color2|'video'/);
  /* THE SOURCES: the Event Hub's own and Colour for everyone; Scene and Upload where media is offered — named and
     marked ◆ by the Look's own table, never a second list. */
  const branch = row.slice(row.indexOf('if (ss) {'), row.indexOf('<section data-scene-background-row'));
  assert.match(branch, /\{ key: 'hub', pro: false \},\s*\{ key: 'colour', pro: false \},\s*\.\.\.\(offerMedia \? \(\['scene', 'own'\] as const\)\.map\(\(key\) => \(\{ key, pro: Boolean\(mediaMark\) && BACKGROUND_SOURCE_IS_PRO\[key\] \}\)\) : \[\]\),/);
  assert.equal(BACKGROUND_SOURCE_IS_PRO.scene && BACKGROUND_SOURCE_IS_PRO.own && !BACKGROUND_SOURCE_IS_PRO.colour, true);
  assert.deepEqual([BACKGROUND_SOURCE_LABEL.colour, BACKGROUND_SOURCE_LABEL.scene, BACKGROUND_SOURCE_LABEL.own], ['Colour', 'Scene', 'Upload']);
  assert.match(read(`${L}/stage-panel/stage-background.tsx`), /label: `\$\{s\.key === 'hub' \? 'The Event Hub’s' : BACKGROUND_SOURCE_LABEL\[s\.key\]\}\$\{s\.pro \? ' ◆' : ''\}`/);
  /* THE SOURCE WORN is read off the stored background: a ready-made picture is Scene, the couple's own is Upload. */
  assert.match(branch, /!bg \|\| scopeNow === 'every' \? 'hub' : bg\.kind === 'photo' \? \(isStdLibrarySrc\(bg\.media\) \? 'scene' : 'own'\) : bg\.kind === 'snippet' \? 'own' : 'colour';/);
});

test('(3) a source picked only shows its choices; a choice writes once through the scene’s own save; nothing asks "every scene?"', () => {
  const row = read(`${E}/scene-background-row.tsx`);
  const branch = row.slice(row.indexOf('if (ss) {'), row.indexOf('<section data-scene-background-row'));
  const onSource = branch.slice(branch.indexOf('onSource={(next) => {'), branch.indexOf('tiles={tiles}'));
  assert.ok(onSource.length > 200, 'anti-vacuity: the source’s handler was not found');
  /* The Event Hub's own is ONE choice — taken at once (one save), and not again when it is already worn. */
  assert.match(onSource, /if \(next === 'hub'\) \{\s*setSourceView\(null\);\s*if \(stored === 'hub'\) return;/);
  assert.equal((onSource.match(/\bsave\(/g) ?? []).length, 1);
  /* Any other source: shown, never written. */
  const after = onSource.slice(onSource.lastIndexOf('return;'));
  assert.match(after, /setSourceView\(next === stored \? null : \{ of: widgetType, from: stored, show: next \}\);/);
  assert.doesNotMatch(after, /\bsave\(|\bput\(|\bpick\(|putKeys\(/, 'picking a source writes a background');
  /* A choice: ONE of the scene's own writes (`pick` / `put` — the shipped save, held and previewed), never the question. */
  const onTile = branch.slice(branch.indexOf('onTile={(key) => {'), branch.indexOf('onUpload={'));
  assert.match(onTile, /if \(source === 'colour'\) \{\s*pick\(key as Choice\);\s*return setAsking\(false\);\s*\}/);
  assert.match(onTile, /if \(source === 'scene'\) return put\(photoBg\(key\), false\);/);
  assert.match(onTile, /put\(clip \? clipBg\(key, clip\.poster\) : photoBg\(key\), false\);/);
  assert.doesNotMatch(branch, /setAsking\(true\)|everySceneBackgroundPatch|data-scene-bg-scope/, 'the toolbar asks "every scene?"');
  /* Rows 3 and 4 belong to the source WORN — never shown under a source that is only being looked at. */
  for (const prop of ['colour={worn && ', 'worn && (current === \'glass\'', 'worn && media', 'shape={worn && ', 'motion={worn && ']) assert.ok(branch.includes(prop), `a row is drawn for a source that is not worn (${prop})`);
  /* The save itself is the row's shipped one: previewed on the page, noted, then ONE draft write. */
  assert.match(row, /lay\(touched\);\s*onSaving\?\.\(touched, redrawsBox\);/);
  assert.equal((row.match(/draftAction\(eventId, fd\)/g) ?? []).length, 2, 'the row gained a write path');
});

test('(4) the bar: the page follows the thumb with nothing saved; one write on release, on the stop it settles on; the centre stores nothing', async () => {
  /* The arithmetic, executed. The scene stores the POSITION (the Look's own shape): a release rests where it is let
     go, and within the Look's snap of the centre it IS the centre. */
  assert.equal(SCENE_SHADE_STOPS, null, 'the bar has stops again — the stored shape lost its number');
  assert.equal(sceneShadeAt(undefined), 0);
  /* The two words stored before the bar read at the Look's own places for them, and are not rewritten by reading. */
  assert.equal(sceneShadeAt('darker'), -70);
  assert.equal(sceneShadeAt('lighter'), 70);
  for (let at = SCENE_SHADE_MIN; at <= SCENE_SHADE_MAX; at += 1) {
    const settled = sceneShadeSettled(at);
    const stored = sceneShadeOf(at);
    assert.equal(settled, Math.abs(at) <= FADE_SNAP ? 0 : at, `${at}: a release does not rest where it is let go`);
    /* What is stored reads back at the place it settled on — the thumb never jumps after a save. */
    assert.equal(sceneShadeAt(stored), settled, `${at}: stored ${String(stored)} reads at ${sceneShadeAt(stored)}, settled ${settled}`);
    /* The sanitizer keeps it beside a picture — and never beside a colour. */
    const kept = sanitizeHubCanvas({ canvas: { media: 'https://x.test/a.jpg', own: true, shade: stored } });
    assert.equal(kept.shade, stored, `${at}: the page would not keep ${String(stored)}`);
    assert.equal(sanitizeHubCanvas({ canvas: { kind: 'color', color: '#c7a27c', own: true, shade: stored } }).shade, undefined, `${at}: a colour keeps a veil`);
    assert.equal(settled === 0, stored === undefined, `${at}: the centre stores something, or a side stores nothing`);
    assert.ok(sceneShadeWords(at).length > 3);
  }
  assert.equal(sceneShadeOf(-100), -100);
  assert.equal(sceneShadeOf(37), 37);
  assert.equal(sceneShadeOf(0), undefined);
  /* What may NOT be stored: the centre, a fraction, a position off the bar, anything that is not a place on it. */
  for (const bad of [0, 12.5, 101, -101, 'as-is', 'bright', null, true]) {
    assert.equal(sanitizeHubCanvas({ canvas: { media: 'https://x.test/a.jpg', own: true, shade: bad } }).shade, undefined, `${String(bad)} is stored`);
  }
  /* The words stored before the bar are still kept as they are. */
  for (const word of ['darker', 'lighter'] as const) assert.equal(sanitizeHubCanvas({ canvas: { media: 'https://x.test/a.jpg', own: true, shade: word } }).shade, word);
  /* Left of the centre the words turn light — said to a screen reader. */
  assert.equal(sceneShadeWords(-80), 'Darker 80% · light words');
  assert.equal(sceneShadeWords(40), 'Lighter 40%');
  assert.equal(sceneShadeWords(4), 'As is');

  /* THE BAR: a move shows, a release keeps — once, and only a change. */
  const bg = read(`${L}/stage-panel/stage-background.tsx`);
  const bar = bg.slice(bg.indexOf('data="scene-shade"'), bg.indexOf('{/* ══ ROW 4'));
  assert.match(bar, /onChange=\{\(n\) => \{\s*setLive\(n\);\s*shade\.onMove\(n\);\s*\}\}/);
  assert.match(bar, /onCommit=\{\(n\) => \{\s*const settled = sceneShadeSettled\(n\);\s*setLive\(settled\);\s*if \(settled !== shade\.at\) shade\.onKeep\(settled\);\s*else shade\.onMove\(settled\);\s*\}\}/);
  assert.doesNotMatch(bg.slice(bg.indexOf('onChange={(n) => {\n                setLive(n);'), bg.indexOf('onCommit={(n) => {')), /onKeep/, 'a move keeps');
  /* …and in the row: a move lays the scene on the page and saves NOTHING; a keep is one `putKeys`. */
  const row = read(`${E}/scene-background-row.tsx`);
  const shade = row.slice(row.indexOf('shade={\n          worn && media'), row.indexOf('shape={worn && '));
  assert.ok(shade.length > 300, 'anti-vacuity: the bar’s wiring was not found');
  const move = shade.slice(shade.indexOf('onMove: (n) => {'), shade.indexOf('onKeep: (n) => {'));
  assert.match(move, /onPreview\?\.\(sceneBgPreviewMessage\(\[\{ type: widgetType, canvas: next \}\], mediaUrl, theme, mediaUrls\)\);/);
  assert.doesNotMatch(move, /\bsave\(|putKeys\(|\bput\(|draftAction|latest\.current =/, 'a move of the bar writes');
  assert.match(move, /if \(fp === shadeShown\.current\) return;/, 'every pixel of a drag is sent to the page');
  assert.match(shade.slice(shade.indexOf('onKeep: (n) => {')), /putKeys\(\{ shade: sceneShadeOf\(n\) \}\);/);
  /* The slider is the app's one (its `onCommit` is the release). */
  assert.match(read('app/_components/slider.tsx'), /onCommit\?: \(value: number\) => void;/);
});

test('(5) not drawn any more: In frame, How close, "Use where", "More", the ⓘ, Remove — and the stored values are still read', () => {
  const bg = read(`${L}/stage-panel/stage-background.tsx`);
  assert.doesNotMatch(bg, /In frame|How close|Gallery|<About|data-stage-bg-gallery|every scene|Remove this scene/i, 'a control the owner removed is back on the Background');
  assert.doesNotMatch(bg, />More<|data-stage-bg="more"/);
  const row = read(`${E}/scene-background-row.tsx`);
  const branch = row.slice(row.indexOf('if (ss) {'), row.indexOf('<section data-scene-background-row'));
  assert.doesNotMatch(branch, /galleryNode|focal|zoom|scene-crop|scene-zoom/, 'the toolbar hands over the crop or the zoom');
  /* STILL HONOURED: a stored focal point and zoom survive the sanitizer and are what the frame draws. */
  const kept = sanitizeHubCanvas({ canvas: { media: 'https://x.test/a.jpg', own: true, focal: 3, zoom: 120, mediaMotion: 'parallax' } });
  assert.equal(kept.focal, 3);
  assert.equal(kept.zoom, 120);
  assert.equal(kept.mediaMotion, 'parallax');
  assert.match(read('lib/hub-canvas.ts'), /if \(inSet\(HUB_FOCAL_POINTS, canvas\.focal\)\) out\.focal = canvas\.focal;\s*if \(inSet\(HUB_ZOOMS, canvas\.zoom\)\) out\.zoom = canvas\.zoom;/);
  /* A pick here builds on the stored canvas — it never drops the crop a couple set before (`withBackground` / `putKeys` keep the rest). */
  assert.match(row, /const next = sanitizeHubCanvas\(\{ canvas: \{ \.\.\.latest\.current, \.\.\.keys \} \}\);/);
});

test('(6) the veil for every position: never under the reading floor, the stored words unchanged, further is never weaker', () => {
  const themes = Object.values(INVITE_THEMES);
  assert.ok(themes.length >= 3, 'anti-vacuity: the themes were not read');
  let asked = 0;
  for (const theme of themes) {
    /* THE TWO WORDS STORED BEFORE THE BAR lay the veils they always laid — recomputed here by the rule as it was
       (a dark veil from 0.55, a paper veil from 0.86, each raised until the words read). */
    const was = {
      darker: requiredScrim(theme.palette.lightInk, theme.palette.darkInk, ['#000000', '#ffffff'], 0.55, AA_BODY),
      lighter: requiredScrim(theme.palette.darkInk, '#ffffff', ['#000000', '#ffffff'], Math.max(0.86, SCENE_MEDIA_SCRIM), AA_BODY),
    };
    for (const word of ['darker', 'lighter'] as const) {
      const now = sceneMediaShade(word, theme);
      assert.equal(now.opacity, was[word], `${theme.id}: a scene stored as "${word}" draws another veil than before`);
      assert.equal(now.opacityEnd, Math.min(1, was[word] + (word === 'darker' ? 0.12 : 0.08)));
      /* …and the word and its place on the bar are the same veil. */
      assert.deepEqual(sceneMediaShade(sceneShadeAt(word), theme), now, `${theme.id}: "${word}" and its place draw differently — the thumb's first move would jump`);
    }
    let dark = 0;
    let paper = 0;
    for (let at = SCENE_SHADE_MIN; at <= SCENE_SHADE_MAX; at += 1) {
      if (at === 0) continue;
      const r = sceneMediaShade(at, theme);
      /* NEVER UNDER THE READING FLOOR, over the darkest and the lightest pixel a picture can have. */
      assert.ok(r.bodyContrast >= AA_BODY, `${theme.id} at ${at}: ${r.bodyContrast.toFixed(2)}:1`);
      assert.ok(r.opacity > 0 && r.opacity <= 1 && r.opacityEnd >= r.opacity && r.opacityEnd <= 1);
      /* LEFT of the centre: the theme's dark ink, the words its light ink; RIGHT: paper, the words its dark ink. */
      assert.equal(r.veil, at < 0 ? theme.palette.darkInk : '#ffffff', `${theme.id} at ${at}: the wrong veil`);
      assert.equal(r.text, at < 0 ? theme.palette.lightInk : theme.palette.darkInk);
      /* The words the page paints are the ink that was measured. */
      const vars = sceneMediaShadeVars(at, theme);
      assert.match(vars['--hub-scrim-top'] ?? '', /^rgb\(\d+ \d+ \d+ \/ \d\.\d\d\)$/);
      if (at < 0) {
        const hex = `#${vars['--color-ink']!.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
        assert.equal(hex.toLowerCase(), theme.palette.lightInk.toLowerCase(), `${theme.id} at ${at}: the page paints another ink than the one measured`);
      }
      asked += 1;
    }
    /* FURTHER FROM THE CENTRE IS NEVER A WEAKER VEIL, on either side. */
    for (let at = -1; at >= SCENE_SHADE_MIN; at -= 1) {
      const o = sceneMediaShade(at, theme).opacity;
      assert.ok(o >= dark - 1e-9, `${theme.id}: darker at ${at} is a weaker veil than at ${at + 1}`);
      dark = o;
    }
    for (let at = 1; at <= SCENE_SHADE_MAX; at += 1) {
      const o = sceneMediaShade(at, theme).opacity;
      assert.ok(o >= paper - 1e-9, `${theme.id}: lighter at ${at} is a weaker veil than at ${at - 1}`);
      /* Lighter is only ever MORE of the shipped scrim. */
      assert.ok(o >= SCENE_MEDIA_SCRIM, `${theme.id} at ${at}: less veil than "as is"`);
      paper = o;
    }
  }
  assert.ok(asked >= 600, `anti-vacuity: only ${asked} positions measured`);
  /* The least a position lays is its distance from the centre, anchored on the two words' own floors. */
  assert.deepEqual(sceneShadeStep(-70), { veil: 'dark', floor: 0.55, to: 0.12 });
  assert.equal(sceneShadeStep(70).veil, 'paper');
  assert.ok(Math.abs(sceneShadeStep(70).floor - 0.86) < 1e-9);
  assert.ok(sceneShadeStep(-35).floor < sceneShadeStep(-70).floor && sceneShadeStep(-100).floor > sceneShadeStep(-70).floor);
  /* ONE sanitizer for the Look's and a scene's shade — the first-load file grew by the one call, not a second rule. */
  const canvas = read('lib/hub-canvas.ts');
  assert.match(canvas, /const shade = sanitizeHubMainShade\(canvas\.shade\);\s*if \(shade !== undefined && \(ground\?\.kind === 'photo' \|\| ground\?\.kind === 'snippet'\)\) out\.shade = shade;/);
  assert.equal((canvas.match(/export function sanitizeHubMainShade\(/g) ?? []).length, 1);
  /* The frame draws whatever is stored through that one rule. */
  assert.match(read('lib/scene-frame-look.ts'), /canvas\.shade\s*\? sceneMediaShadeVars\(canvas\.shade, theme\)/);
});

test('(7) picture tiles: the name is ON the tile and always readable; one ring the row never cuts; no sticker, no stripes', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageBackground } = await import(`../${L}/stage-panel/stage-background`);
  const noop = () => {};
  const tiles = [
    { key: 'none', name: 'None', none: true, picture: { background: '#FFFFFF' }, tone: 'ink', fade: false },
    { key: 'color', name: 'Plain', picture: { background: '#3a2f25' }, tone: 'white', fade: false },
    { key: '/a.webp', name: 'Golden hour', picture: { backgroundImage: 'url("/a.webp")' }, tone: 'white', fade: true },
    { key: '/b.webp', name: 'Misty sunrise', picture: { backgroundImage: 'url("/b.webp")' }, tone: 'ink', fade: true },
  ] as const;
  const html = renderToStaticMarkup(
    React.createElement(StageBackground, { source: 'colour', sources: [{ key: 'colour', pro: false }], onSource: noop, tiles, tile: '/a.webp', onTile: noop, onUpload: true, upload: null, colour: null, customColour: () => null, opacity: null, shade: null, shape: null, onShape: noop, motion: null, onMotion: noop, pending: false }),
  );
  const un = (c: string) => c.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");
  const drawn = [...html.matchAll(/<button type="button" aria-pressed="(true|false)" aria-label="([^"]*)" data-stage-bg-tile="[^"]*" class="([^"]*)"><span class="([^"]*)" style="[^"]*" data-tile-face="(\w+)">([\s\S]*?)<\/span><\/button>/g)];
  assert.equal(drawn.length, 4, 'anti-vacuity: the four tiles were drawn');
  for (const m of drawn) {
    assert.equal(un(m[3]!), SP_BG_TILE, 'the tap is not the measured button');
    assert.equal(un(m[4]!), SP_BG_TILE_FACE, 'the face is not the picture tile');
  }
  assert.deepEqual(drawn.map((m) => `${m[2]}:${m[5]}`), ['None:none', 'Plain:flat', 'Golden hour:picture', 'Misty sunrise:picture']);
  /* THE NAME IS ON THE TILE: the last thing in the face, in the tile's tone — and it has no plate of its own. */
  for (const [m, t] of drawn.map((d, i) => [d, tiles[i]!] as const)) {
    const name = /<span data-tile-name="(\w+)" class="([^"]*)">([^<]*)<\/span>$/.exec(m[6]!);
    assert.ok(name, `${t.name}: the name is not the last thing on its tile`);
    assert.equal(name![1], t.tone);
    assert.equal(un(name![2]!), `${SP_BG_TILE_NAME} ${SP_BG_TILE_TONE[t.tone]}`);
    assert.equal(/data-tile-fade=""/.test(m[6]!), t.fade, `${t.name}: the foot fade is ${t.fade ? 'missing' : 'drawn on a flat tile'}`);
    if (t.fade) assert.ok(un(m[6]!).includes(`class="${SP_BG_TILE_FADE[t.tone]}"`), `${t.name}: the fade is not its tone’s`);
  }
  for (const cls of [SP_BG_TILE_NAME, SP_BG_TILE_TONE.white, SP_BG_TILE_TONE.ink]) assert.doesNotMatch(cls, /(?:^|\s)bg-|rounded|px-/, 'the name sits on a sticker again');
  assert.ok(has(SP_BG_TILE_NAME, 'text-[12px]') && has(SP_BG_TILE_NAME, 'font-semibold') && has(SP_BG_TILE_NAME, 'whitespace-nowrap'));
  /* "NONE": a white tile with one stroke — never a dashed empty box. */
  assert.ok(un(drawn[0]![6]!).includes(`class="${SP_BG_TILE_SLASH}"`));
  assert.equal((html.match(new RegExp(SP_BG_TILE_SLASH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/>/g, '&gt;'), 'g')) ?? []).length, 1);
  /* "＋ UPLOAD" keeps the template's add look, in the same tile. */
  assert.ok(un(html).includes(`data-stage-bg-tile="upload" class="${SP_BG_TILE}"><span class="${SP_BG_TILE_FACE} ${SP_BG_TILE_ADD}">`));

  /* ONE RING, NEVER CUT: 2 px of the toolbar's ground then 2 px of the accent, on the picked face alone; the face is
     shorter than the row by more than the ring takes above and below, at both of the toolbar's row heights. */
  const ring = SP_BG_TILE_FACE.split(' ').filter((c) => /aria-pressed/.test(c));
  assert.deepEqual(ring, ['group-aria-pressed/tile:shadow-[0_0_0_2px_var(--sp-page),0_0_0_4px_var(--sp-cta)]']);
  assert.doesNotMatch(`${SP_BG_TILE} ${SP_BG_TILE_FACE}`, /dashed|aria-pressed:border|ring-/, 'a second mark of "picked"');
  assert.ok(has(SP_BG_TILE, 'group/tile'));
  const short = Number(/h-\[calc\(var\(--sp-rh\)_-_(\d+)px\)\]/.exec(SP_BG_TILE_FACE)?.[1]);
  assert.ok(short >= 2 * SP_BG_TILE_RING_PX, `the face is only ${short}px shorter than its row — the ring is cut`);
  for (const h of [667, 812]) {
    const row = stageBarRow(h).row;
    assert.ok(row - short + 2 * SP_BG_TILE_RING_PX <= row && row - short >= 34, `${h}: the tile and its ring do not fit the ${row}-px row`);
    assert.ok(44 <= row, 'the 44-px tap is taller than its row');
  }
  assert.ok(has(SP_BG_STRIP, 'px-[10px]'), 'the first tile’s ring is cut at the row’s edge');

  /* EVERY NAME IS READABLE. The toolbar's ink IS the ink the rule measures with. */
  assert.match(STAGE_PANEL_VARS, new RegExp(`--sp-ink:${TILE_INK};`));
  /* a FLAT tile — every colour a couple can pick (a 9 × 9 × 9 sweep of the cube), as Plain, Opaque and Frosted: */
  let flats = 0;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  for (let r = 0; r <= 255; r += 31.875) for (let g = 0; g <= 255; g += 31.875) for (let b = 0; b <= 255; b += 31.875) {
    const tint = `#${hex(Math.round(r))}${hex(Math.round(g))}${hex(Math.round(b))}`;
    for (const under of [tint, tileGlassColour(tint, 'glass'), tileFrostFoot(tint)]) {
      const n = tileNameOnFlat(under);
      const c = n.fade ? tileFadeFloor(n.tone) : contrastRatio(n.tone === 'ink' ? TILE_INK : TILE_WHITE, under);
      assert.ok(c >= AA_BODY, `${tint}: a name at ${c.toFixed(2)} : 1 on ${under}`);
      flats++;
    }
  }
  assert.equal(flats, 9 * 9 * 9 * 3);
  assert.deepEqual(tileNameOnFlat('#FFFFFF'), { tone: 'ink', fade: false }, '"None" is not ink on white');
  /* a PICTURE — whatever it is: the fade alone keeps the name at 4.5 : 1 (white over a white picture, ink over a black one). */
  assert.ok(tileFadeFloor('white') >= AA_BODY, `white on the dark fade: ${tileFadeFloor('white').toFixed(2)}`);
  assert.ok(tileFadeFloor('ink') >= AA_BODY, `ink on the light fade: ${tileFadeFloor('ink').toFixed(2)}`);
  /* …and the fade DRAWN is the fade measured, under the whole of the name (4 px + a 14-px line) on the shortest face. */
  assert.ok(SP_BG_TILE_FADE.white.includes(`rgba(0,0,0,${String(TILE_FADE.dark).replace(/^0/, '')})`) && SP_BG_TILE_FADE.ink.includes(`rgba(255,255,255,${String(TILE_FADE.light).replace(/^0/, '')})`), 'the fade drawn is weaker than the fade measured');
  for (const f of Object.values(SP_BG_TILE_FADE)) {
    const pct = Number(/_0_(\d+)%,transparent/.exec(f)?.[1]);
    assert.ok((pct / 100) * (stageBarRow(667).row - short) >= 4 + 14, `the fade stops above the name’s foot (${pct}%)`);
  }
  assert.ok(has(SP_BG_TILE_FACE, 'pb-1') && has(SP_BG_TILE_NAME, 'leading-[14px]'));
  /* The tone follows the picture where it is measured: every ready-made scene, and an upload (nothing measured). */
  for (const b of STD_REALISTIC_BACKGROUNDS) assert.deepEqual(tileNameOnPicture(b.lum), { tone: b.lum >= TILE_LIGHT_FROM ? 'ink' : 'white', fade: true });
  assert.ok(STD_REALISTIC_BACKGROUNDS.some((b) => b.lum >= TILE_LIGHT_FROM) && STD_REALISTIC_BACKGROUNDS.some((b) => b.lum < TILE_LIGHT_FROM), 'anti-vacuity: both tones are in use');
  assert.deepEqual(tileNameOnPicture(null), { tone: 'white', fade: true });

  /* OPAQUE AND FROSTED ARE WHAT THEY DRAW — never stripes; and the row's file gives a scene's picture and an upload the same tile. */
  assert.match(tileGlassColour('#A78A55', 'glass'), /^#[0-9a-f]{6}$/i);
  assert.match(tileFrostCss('#A78A55'), /^linear-gradient\(180deg, rgba\(255,255,255,0\.85\), rgba\(255,255,255,0\.45\)\), #[0-9a-f]{6}$/i);
  const row = read(`${E}/scene-background-row.tsx`);
  const at = row.indexOf('const colourTile = ');
  const made = row.slice(at, row.indexOf('const shadeAt = sceneShadeAt(shown.shade);', at));
  assert.ok(at > 0 && made.length > 800, 'anti-vacuity: the tiles were found');
  assert.doesNotMatch(made, /repeating-linear-gradient|dashed|preview\('(?:glass|frost|none)'/, 'a stripe or a dashed box is back');
  assert.match(made, /if \(c === 'glass'\) return \{ key: c, name, picture: \{ background: tileGlassColour\(base, 'glass'\) \}, \.\.\.tileNameOnFlat\(tileGlassColour\(base, 'glass'\)\) \};/);
  assert.match(made, /if \(c === 'frost'\) return \{ key: c, name, picture: \{ background: tileFrostCss\(base\) \}, \.\.\.tileNameOnFlat\(tileFrostFoot\(base\)\) \};/);
  assert.equal((made.match(/\.\.\.tileNameOnPicture\(/g) ?? []).length, 6, 'a scene’s picture or an upload is not the same tile');
  assert.match(made, /STD_REALISTIC_BACKGROUNDS\.map\(\(b\) => \(\{ key: b\.src, name: b\.label, picture: cover\(b\.src\), \.\.\.tileNameOnPicture\(b\.lum\) \}\)\)/);
  /* 📦 Lazy only. */
  for (const f of [`${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, 'lib/hub-draft.ts', 'lib/hub-canvas.ts']) assert.doesNotMatch(readFileSync(join(WEB, f), 'utf8'), /bg-tile-name/);
});
