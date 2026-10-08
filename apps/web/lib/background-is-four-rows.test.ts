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
import { SP_BG_ROW, SP_BG_STRIP, SP_BG_TILE, SP_ROWS } from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';
import { SCENE_SHADE_MAX, SCENE_SHADE_MIN, sceneShadeAt, sceneShadeOf, sceneShadeSettled, sceneShadeWords } from './scene-shade-bar';

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
  assert.ok(has(SP_BG_TILE, 'min-w-[84px]') && has(SP_BG_TILE, 'shrink-0'));
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
  /* The arithmetic, executed. Three stops today: a scene stores one of two words. */
  assert.equal(sceneShadeAt(undefined), 0);
  assert.equal(sceneShadeAt('darker'), -70);
  assert.equal(sceneShadeAt('lighter'), 70);
  for (let at = SCENE_SHADE_MIN; at <= SCENE_SHADE_MAX; at += 1) {
    const settled = sceneShadeSettled(at);
    const stored = sceneShadeOf(at);
    /* What is stored reads back at the place it settled on — the thumb never jumps after a save. */
    assert.equal(sceneShadeAt(stored), settled, `${at}: stored ${String(stored)} reads at ${sceneShadeAt(stored)}, settled ${settled}`);
    /* The sanitizer keeps it beside a picture. */
    const kept = sanitizeHubCanvas({ canvas: { media: 'https://x.test/a.jpg', own: true, shade: stored } });
    assert.equal(kept.shade, stored, `${at}: the page would not keep ${String(stored)}`);
    assert.equal(settled === 0, stored === undefined, `${at}: the centre stores something, or a side stores nothing`);
    assert.ok(sceneShadeWords(at).length > 3);
  }
  assert.equal(sceneShadeOf(-100), 'darker');
  assert.equal(sceneShadeOf(100), 'lighter');
  assert.equal(sceneShadeOf(0), undefined);
  /* Left of the centre the words turn light — said to a screen reader. */
  assert.equal(sceneShadeWords(-80), 'Darker · light words');
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
