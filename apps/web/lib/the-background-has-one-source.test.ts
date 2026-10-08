/**
 * the-background-has-one-source.test.ts — STUDIO › LOOK › BACKGROUND IS ONE
 * SOURCE ▾ AND ITS PICTURE CARDS.
 *
 * Owner 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
 * ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.1 and
 * § 6 row 2), verbatim: *"main background does not show the animated
 * backgrounds, color, upload media and everything we can do for the background
 * restudy this and create a better approach to design background."*
 *
 * Held here, each where it can be EXECUTED:
 *   (1) the source is READ off what is stored — nothing new is stored;
 *   (2) the five sources, and ◆ exactly where the shipped Pro rule asks for Pro;
 *   (3) the panel draws ONE dropdown and the cards of the source on screen, and
 *       a tap is the SAME save the old row made;
 *   (4) never a broken image — every card has a drawn fallback under its picture;
 *   (5) a Video card is the loop itself: muted, metadata only, playing only on
 *       screen, and no `<video>` at all under "reduce motion";
 *   (6) Shade ▾ on every source, Candlelight its darkest step — one pick, one save;
 *   (7) Look draws each control ONCE (the page fill, the hero video, Candlelight);
 *   (8) a draft can take a LIVE Candlelight off the host's canvas.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import {
  BACKGROUND_MAIN_INFO,
  BACKGROUND_SHADE_CANDLELIGHT,
  BACKGROUND_SOURCES,
  BACKGROUND_SOURCE_IS_PRO,
  BACKGROUND_SOURCE_LABEL,
  backgroundShadeValue,
  backgroundShadeWrite,
  backgroundSourceOf,
  backgroundWritePatch,
  loopCardDrawsVideo,
  type BackgroundSource,
} from './background-source';
import { HUB_MAIN_PATTERNS, hubMovingBackgroundIds, sanitizeHubMainGround, type HubMainGround } from './hub-canvas';
import { mainGroundChange, sanitizeHubDraftEventValue } from './hub-draft';
import { STD_REALISTIC_BACKGROUNDS } from './std-backgrounds';
import { MAIN_GROUND_PATTERN_CSS } from './main-ground-patterns';
import { MAIN_GROUND_SHADES } from './main-ground-shade';
import { BACKGROUND_EFFECTS } from './ombre';

(globalThis as unknown as { React: unknown }).React = React;
/* The panel reaches the draft action, which is server-only — stood in for, as the other render guards do. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const G = 'app/[slug]/_components';

const FRAME = ['#112233', '#445566'];
/** One stored main background of each kind — sanitised, so it is a value the app can really hold. */
const stored = (raw: unknown): HubMainGround => {
  const m = sanitizeHubMainGround(raw);
  assert.ok(m, `the fixture is not a main background the app stores: ${JSON.stringify(raw)}`);
  return m;
};
const SCENE = stored({ kind: 'photo', media: STD_REALISTIC_BACKGROUNDS[0]!.src, tint: { match: true, frame: FRAME } });
const OWN_PHOTO = stored({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/a.jpg', tint: { match: true, frame: FRAME } });
const OWN_CLIP = stored({ kind: 'snippet', media: 'r2://setnayan-media/events/E1/main-background/a.mp4', poster: 'r2://setnayan-media/events/E1/main-background/a.jpg', tint: { match: true, frame: FRAME } });
const FOLLOW = stored({ follow: 'hero', of: 'r2://setnayan-media/events/E1/landing-page-hero/h.jpg', tint: { match: true, frame: FRAME } });
const LOOP = stored({ ground: 'loop', loop: hubMovingBackgroundIds()[0] });
const PATTERN = stored({ ground: 'pattern', pattern: 'dots' });
const NONE = stored({ ground: 'none' });
const THEME = stored({ ground: 'theme' });

/* ── (1) the source is read off what is stored ────────────────────────── */

test('(1) the source is what the stored main background IS — nothing new is stored', () => {
  const page = { themeHasLoop: true, followsHero: false };
  const rows: Array<[HubMainGround | null, typeof page, BackgroundSource, string]> = [
    [NONE, page, 'colour', '"Just the colour"'],
    [PATTERN, page, 'pattern', 'a pattern on the colour'],
    [SCENE, page, 'scene', 'a ready-made still'],
    [OWN_PHOTO, page, 'own', 'their own photo'],
    [OWN_CLIP, page, 'own', 'their own clip'],
    [FOLLOW, page, 'own', 'the hero follow'],
    [LOOP, page, 'video', 'a moving background of ours'],
    [THEME, page, 'video', 'the theme’s own, on a theme with a loop'],
    [THEME, { themeHasLoop: false, followsHero: false }, 'colour', 'the theme’s own, on Classic'],
    [null, { themeHasLoop: true, followsHero: true }, 'own', 'nothing stored, a hero photo to follow'],
    [null, { themeHasLoop: true, followsHero: false }, 'video', 'nothing stored, no hero, a theme with a loop'],
    [null, { themeHasLoop: false, followsHero: false }, 'colour', 'nothing stored, Classic'],
  ];
  for (const [main, p, want, what] of rows) assert.equal(backgroundSourceOf(main, p), want, what);
  // Every source is reachable from a stored value — none is a dead tab.
  assert.deepEqual([...new Set(rows.map((r) => r[2]))].sort(), [...BACKGROUND_SOURCES].sort());
  // No column, no key: the module reads, and the panel asks it.
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /const storedSource = backgroundSourceOf\(current, \{/);
  assert.doesNotMatch(read('lib/background-source.ts'), /supabase|\.from\(|localStorage/, 'the source is kept somewhere of its own');
});

/* ── (2) five sources, ◆ where the shipped rule asks for Pro ──────────── */

test('(2) Colour · Pattern · Scene · Video · Your photo or video — ◆ exactly where Apply asks for Event Hub Pro', () => {
  assert.deepEqual([...BACKGROUND_SOURCES], ['colour', 'pattern', 'scene', 'video', 'own']);
  assert.deepEqual(
    BACKGROUND_SOURCES.map((k) => BACKGROUND_SOURCE_LABEL[k]),
    ['Colour', 'Pattern', 'Scene', 'Video', 'Your photo or video'],
  );
  // The mark is the SHIPPED rule, run: going to this source from "just the colour" adds a look, or it does not.
  const reach: Record<BackgroundSource, HubMainGround> = { colour: NONE, pattern: PATTERN, scene: SCENE, video: LOOP, own: OWN_PHOTO };
  for (const k of BACKGROUND_SOURCES) {
    const change = mainGroundChange(k === 'colour' ? PATTERN : NONE, reach[k]);
    const asksPro = change === 'add' || change === 'change';
    assert.equal(BACKGROUND_SOURCE_IS_PRO[k], asksPro, `${k}: the ◆ and Apply disagree (the rule says ${change})`);
  }
});

/* ── (3) one dropdown, the cards of the source, the same saves ────────── */

test('(3) the Studio draws ONE Source dropdown and the cards of the source on screen; a tap is the save its old row made', () => {
  const panel = read(`${E}/main-background-panel.tsx`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.ok(studio.length > 2000, 'anti-vacuity: the Studio branch was not found');
  // ONE dropdown for the set of sources — never a segmented bar, never a second list.
  assert.equal((studio.match(/dataAttr="data-bg-source-pick"/g) ?? []).length, 1);
  assert.match(studio, /options=\{BACKGROUND_SOURCES\.filter\(\(k\) => k !== 'video' \|\| loops\.length > 0\)\.map\(\(k\) => \(\{\s*key: k,\s*label: BACKGROUND_SOURCE_LABEL\[k\],/);
  assert.match(studio, /proOn && BACKGROUND_SOURCE_IS_PRO\[k\] \? \{ trail: PRO_TRAIL \}/, 'a Pro source is not marked ◆');
  // Picking a source LOOKS — it never writes (the page changes when a card is tapped).
  const pickSource = /onPick=\{\(k\) => \{\s*setUploadOpen\(false\);\s*setViewed\(k as BackgroundSource\);\s*\}\}/;
  assert.match(studio, pickSource, 'picking a source does more than show its cards');
  // What it is, behind the ⓘ — the words Background has carried since 2026-10-06, no longer a paragraph.
  assert.match(studio, /<BgRow label="Source" data="source" info=\{BACKGROUND_MAIN_INFO\}>/);
  assert.match(BACKGROUND_MAIN_INFO, /^The main background — behind every stage and every page/);
  assert.doesNotMatch(read(`${L}/studio-tools.tsx`), /data-studio-main-background-line/, 'the line is a paragraph under the bar again');
  // Each source's cards are the shipped list, and the tap is the shipped save.
  assert.match(studio, /view === 'colour'\s*\? BACKGROUND_EFFECTS\.filter\(\(e\) => Boolean\(page\) \|\| e === 'plain'\)\.map/);
  assert.match(studio, /view === 'pattern'\s*\? HUB_MAIN_PATTERNS\.map[\s\S]{0,520}onPick=\{\(\) => save\(\{ ground: 'pattern', pattern: k \}, FAILED\)\}/);
  assert.match(studio, /view === 'scene'\s*\? STD_REALISTIC_BACKGROUNDS\.map[\s\S]{0,520}onPick=\{\(\) => pickExisting\(\{ kind: 'photo', ref: b\.src, stillUrl: b\.src \}\)\}/);
  assert.match(studio, /view === 'video'\s*\? loops\.map[\s\S]{0,620}onPick=\{\(\) => pickGround\(l\.id\)\}/);
  assert.match(studio, /name="Your cover photo"[\s\S]{0,260}onPick=\{\(\) => pickGround\('src:hero'\)\}/);
  assert.match(studio, /name="Photo or video" data="upload"[\s\S]{0,160}onPick=\{\(\) => setUploadOpen\(\(o\) => !o\)\}/, 'the Upload card does not open the uploader in place');
  assert.match(studio, /<FileUpload[\s\S]{0,400}compressImage\s*compressVideo\s*videoCompressProfile="maker"/, 'the upload is not the shipped one (compressed on the phone)');
  // 🎬 The hero video (it was under Music) sits with the couple's other pictures.
  assert.match(studio, /\{view === 'own' \? heroVideo : null\}/);
  // The colour of the page (and of a pattern) opens the Mood Board's ONE picker.
  assert.match(studio, /<StudioColourField\s+data="background"[\s\S]{0,260}palette=\{five\}/);
  // Only the ring of the source the page WEARS is drawn — a card of another source is never "on".
  assert.match(studio, /const active = view === storedSource;/);
  for (const on of [/on=\{active && effect === e\}/, /on=\{active && pattern === k\}/, /on=\{active && own\?\.media === b\.src\}/, /on=\{active && loopNow === l\.id\}/]) assert.match(studio, on);
  // The lists the cards are drawn from are real, and as long as the plan says.
  assert.equal(BACKGROUND_EFFECTS.length, 4);
  assert.equal(HUB_MAIN_PATTERNS.length, 4);
  assert.equal(STD_REALISTIC_BACKGROUNDS.length, 10);
  assert.equal(hubMovingBackgroundIds().length, 9, 'the nine theme videos');
  // The shipped Maker (flag off) keeps its one dropdown — this is the Studio's only.
  assert.match(panel, /<PickMenu\s+label="Behind every scene"\s+value=\{groundValue\}\s+options=\{\[\.\.\.loops\.map\(groundLoopOption\), \.\.\.groundOwnOptions\]\}\s+onPick=\{pickGround\}/);
});

/* ── (4) never a broken image ─────────────────────────────────────────── */

test('(4) every card has a drawn fallback under its picture — never a broken image', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const card = renderToStaticMarkup(
    React.createElement(C.BgCard, { name: 'Dots', data: 'pattern:dots', on: true, onPick: () => {}, swatch: '#abcdef', pro: true }),
  );
  assert.match(card, /data-bg-card="pattern:dots"/);
  assert.match(card, /aria-pressed="true"/);
  assert.match(card, /data-bg-card-picture=""[^>]*style="background:#abcdef"/, 'the card has no drawn fallback');
  assert.match(card, />Dots</);
  assert.match(card, /aria-label="Event Hub Pro"[^>]*>◆</, 'a Pro card is not marked ◆');
  assert.doesNotMatch(card, /<img|<video/, 'a card with no picture draws an image tag');
  // A pattern card is the guest page's own pattern over the page colour — one definition, two readers.
  for (const k of HUB_MAIN_PATTERNS) assert.match(MAIN_GROUND_PATTERN_CSS[k].image, /rgb\(var\(--color-ink\) \/ 0\.\d+\)/, `${k} is not drawn in the page's ink`);
  assert.match(read(`${G}/main-ground.tsx`), /const PATTERN_CSS = MAIN_GROUND_PATTERN_CSS;/, 'the guest page draws a second copy of the patterns');
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /swatch=\{`\$\{MAIN_GROUND_PATTERN_CSS\[k\]\.image\}, \$\{paper\}`\}/);
  // Every `<BgCard` of the panel names its fallback; every picture is laid over one (`StillOverSwatch`).
  const cards = panel.split(/<BgCard(?=[\s>])/).slice(1);
  assert.ok(cards.length >= 9, `anti-vacuity: only ${cards.length} cards found`);
  for (const c of cards) assert.match(c.slice(0, c.indexOf('>')), /swatch=\{/, `a card has no fallback: ${c.slice(0, 60)}`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.ok(studio.length > 2000, 'anti-vacuity: the Studio branch was not found');
  assert.doesNotMatch(studio, /<img\b/, 'the Studio draws a bare <img> (a broken glyph could show)');
  // A loop's fallback is its own two sampled colours — never a guess.
  const P = await import(`../${E}/main-background-panel`);
  for (const id of hubMovingBackgroundIds()) assert.match(P.loopSwatch(id, '#fff'), /^linear-gradient\(160deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/i);
});

/* ── (5) the video cards ──────────────────────────────────────────────── */

test('(5) a Video card is the loop itself: muted, metadata only, playing only on screen, still under "reduce motion"', async () => {
  // The rule, run.
  assert.equal(loopCardDrawsVideo({ src: 'https://x/loop.mp4', reducedMotion: false, failed: false }), true);
  assert.equal(loopCardDrawsVideo({ src: 'https://x/loop.mp4', reducedMotion: true, failed: false }), false, 'a video is drawn under "reduce motion"');
  assert.equal(loopCardDrawsVideo({ src: 'https://x/loop.mp4', reducedMotion: false, failed: true }), false, 'a failed loop is drawn again');
  assert.equal(loopCardDrawsVideo({ src: null, reducedMotion: false, failed: false }), false);
  // What is drawn.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const poster = React.createElement('i', { 'data-stub': 'poster' });
  const html = renderToStaticMarkup(React.createElement(C.LoopPicture, { src: 'https://x/loop.mp4' }, poster));
  assert.match(html, /^<i data-stub="poster"><\/i><video /, 'the loop is not laid OVER its poster');
  const video = /<video [^>]*>/.exec(html)?.[0] ?? '';
  for (const attr of ['muted=""', 'loop=""', 'playsInline=""', 'preload="metadata"', 'aria-hidden="true"']) assert.ok(video.includes(attr), `the loop is missing ${attr}: ${video}`);
  assert.doesNotMatch(video, /autoplay/i, 'the loop starts on its own (it must wait until it is on screen)');
  assert.doesNotMatch(video, /controls/);
  assert.match(video, /opacity-0/, 'the loop shows before it is moving (a black box could show)');
  assert.equal(renderToStaticMarkup(React.createElement(C.LoopPicture, { src: null }, poster)), '<i data-stub="poster"></i>', 'a loop with no address still draws a <video>');
  // How it plays — the observer, the pause, the removal.
  const src = read(`${E}/background-cards.tsx`);
  const loop = src.slice(src.indexOf('export function LoopPicture('));
  assert.match(loop, /const shown = loopCardDrawsVideo\(\{ src, reducedMotion: reduced, failed \}\);/);
  assert.match(loop, /new IntersectionObserver\(/);
  assert.match(loop, /if \(e\.isIntersecting && e\.intersectionRatio >= 0\.6\) \{[\s\S]{0,200}void video\.play\(\)\.catch\(\(\) => \{\}\);\s*\} else \{\s*video\.pause\(\);/, 'the loop does not play only while on screen');
  assert.match(loop, /onError=\{\(\) => setFailed\(true\)\}/, 'a loop that cannot load stays');
  assert.match(src, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  // The panel hands every Video card its loop, and the editor page builds that address.
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /<LoopPicture src=\{l\.loopUrl \?\? null\}>\s*<StillOverSwatch src=\{l\.stillUrl\} swatch=\{loopSwatch\(l\.id, colours\.canvas\)\} \/>\s*<\/LoopPicture>/);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /loopUrl: resolveThemeGround\(id, \{ ownColours: false \}\)\?\.loop \?\? null,/);
});

/* ── (6) Shade ▾ ──────────────────────────────────────────────────────── */

test('(6) Shade ▾ is on every source and Candlelight is its darkest step — one pick, one draft save', () => {
  // The value on screen.
  assert.equal(backgroundShadeValue({ art: null, shade: null }), 'as-is');
  assert.equal(backgroundShadeValue({ art: 'daylight', shade: 'dark' }), 'dark');
  assert.equal(backgroundShadeValue({ art: 'candlelight', shade: 'dark' }), BACKGROUND_SHADE_CANDLELIGHT);
  // What one pick writes — only what changes.
  const picture = { art: null, shade: null, takesShade: true } as const;
  assert.equal(backgroundShadeWrite('as-is', picture), null, 'picking what is on writes something');
  assert.deepEqual(backgroundShadeWrite('darker', picture), { art: null, step: 'darker', stepMoves: true });
  assert.deepEqual(backgroundShadeWrite(BACKGROUND_SHADE_CANDLELIGHT, picture), { art: 'candlelight', step: null, stepMoves: false });
  // Candlelight is worn INSTEAD of a veil: picking it takes the veil off, in the same pick.
  assert.deepEqual(backgroundShadeWrite(BACKGROUND_SHADE_CANDLELIGHT, { art: null, shade: 'dark', takesShade: true }), { art: 'candlelight', step: null, stepMoves: true });
  // …and leaving Candlelight says Daylight out loud (an absent field would leave it on).
  assert.deepEqual(backgroundShadeWrite('light', { art: 'candlelight', shade: null, takesShade: true }), { art: 'daylight', step: 'light', stepMoves: true });
  assert.deepEqual(backgroundShadeWrite('as-is', { art: 'candlelight', shade: null, takesShade: false }), { art: 'daylight', step: null, stepMoves: false });
  // A flat colour or a pattern has no picture to veil: no step is ever stored on it.
  assert.deepEqual(backgroundShadeWrite(BACKGROUND_SHADE_CANDLELIGHT, { art: null, shade: null, takesShade: false }), { art: 'candlelight', step: null, stepMoves: false });
  // ONE save carries both halves, in the shapes the draft holds.
  const patch = backgroundWritePatch({ main: NONE, events: { site_bg_color: '#aabbcc', site_art_direction: 'candlelight' } });
  assert.deepEqual(patch, { widgets: { hero: { main: NONE } }, events: { site_bg_color: '#aabbcc', site_art_direction: 'candlelight' } });
  assert.deepEqual(backgroundWritePatch({ events: { site_art_direction: 'daylight' } }), { events: { site_art_direction: 'daylight' } });
  assert.deepEqual(backgroundWritePatch({ main: null }), { widgets: { hero: { main: null } } }, '"Your cover photo" (nothing stored) is not written');
  assert.equal(sanitizeHubDraftEventValue('site_art_direction', 'candlelight'), 'candlelight');
  assert.equal(sanitizeHubDraftEventValue('site_art_direction', 'daylight'), 'daylight');
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', '#AABBCC'), '#aabbcc');
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', null), null, 'the page colour cannot be handed back to the Mood Board');
  // The panel: the row is drawn for whatever the page wears, with the list its source can take.
  const panel = read(`${E}/main-background-panel.tsx`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.match(studio, /\{active \? \(\s*<>\s*<BgRow label="Shade" data="shade"/, 'Shade is not drawn on every source');
  assert.match(studio, /\.\.\.MAIN_GROUND_SHADES\.filter\(\(k\) => takes\.shade \|\| k === 'as-is'\)\.map\(\(k\) => \(\{ key: k, label: MAIN_GROUND_SHADE_LABEL\[k\] \}\)\),\s*\{ key: BACKGROUND_SHADE_CANDLELIGHT, label: BACKGROUND_SHADE_CANDLELIGHT_LABEL,/);
  assert.equal(MAIN_GROUND_SHADES.length, 5);
  assert.match(studio, /const w = backgroundShadeWrite\(k, \{ art, shade: extra\('shade'\), takesShade: takes\.shade && Boolean\(current\) \}\);/);
  assert.match(studio, /if \(w\.art\) write\.events = \{ site_art_direction: w\.art \};\s*if \(w\.stepMoves\) write\.main = withExtra\('shade', w\.step\);\s*saveLook\(write, FAILED\);/);
  assert.match(panel, /fd\.set\('patch', JSON\.stringify\(backgroundWritePatch\(write\)\)\);\s*return draft\(eventId, fd\);/, 'a pick is more than one draft save');
  // Blur · Focus · Motion keep their rows where they mean something.
  for (const attr of ['data-studio-blur-pick', 'data-studio-focus-pick', 'data-main-ground-motion-pick', 'data-studio-shade-pick']) assert.ok(studio.includes(`dataAttr="${attr}"`), `${attr} is gone`);
});

/* ── (7) each control once ────────────────────────────────────────────── */

test('(7) Look draws each control ONCE: in the Studio the Background holds the page fill, the hero video and Candlelight', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { LookPanel } = await import(`../${L}/details-look-pages`);
  const stub = (name: string) => React.createElement('div', { 'data-stub': name });
  const look = (background: unknown) => ({ background, page: stub('page-fill'), video: stub('hero-video'), colours: stub('art'), palette: null, font: stub('font'), buttons: stub('buttons'), music: stub('music') });
  const paint = (stagesStudio: boolean, background: unknown) =>
    renderToStaticMarkup(
      React.createElement(
        MakerContext.Provider,
        { value: { stagesStudio, lookPages: { logo: null, hero: null, reveal: null, revealOptions: null, heroParts: null, revealStages: [], publicLandingUrl: '/a', look: look(background) } } },
        React.createElement(LookPanel, { sections: ['background'], extras: { background: stub('old-extras') } }),
      ),
    );
  const studio = paint(true, stub('main-background'));
  assert.match(studio, /data-stub="main-background"/);
  assert.doesNotMatch(studio, /data-stub="page-fill"|data-stub="hero-video"|data-stub="old-extras"/, 'the Studio draws the page fill, the hero video or the old extras a second time');
  // The shipped Maker keeps them as rows of Look…
  const shipped = paint(false, stub('main-background'));
  for (const s of ['main-background', 'page-fill', 'hero-video', 'old-extras']) assert.match(shipped, new RegExp(`data-stub="${s}"`), `the shipped Maker lost ${s}`);
  // …and so does a Studio with no main background panel to hold them (the app-store shell): never dropped.
  const shell = paint(true, null);
  for (const s of ['page-fill', 'hero-video', 'old-extras']) assert.match(shell, new RegExp(`data-stub="${s}"`), `with no Background panel, ${s} has no home`);
  // The panel is handed both, by the page that builds them once.
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /heroVideo=\{heroVideoPanel\}/);
  assert.match(page, /key: 'hero-video',[\s\S]{0,260}panel: heroVideoPanel,/, 'the hero video is built twice');
  assert.equal(page.split('part="video"').length - 1, 1, 'the hero video is built twice');
  assert.match(page, /page=\{\{\s*bgColor: \(drafted\.site_bg_color as string \| null\) \?\? null,/);
  // 🌗 Candlelight: in the Studio (with the panel) Elements › Colours no longer posts it; elsewhere it does.
  const { ColorsPanel } = await import(`../${E}/pro-panels`);
  const base = { action: () => {}, eventId: 'E1', rowKey: 'colors', part: 'art' as const, bgColor: null, buttonColor: null, artDirection: 'daylight' as const };
  const art = (stagesStudio: boolean, background: unknown) =>
    renderToStaticMarkup(
      React.createElement(MakerContext.Provider, { value: { stagesStudio, lookPages: { look: look(background) } } }, React.createElement(ColorsPanel, base)),
    );
  assert.doesNotMatch(art(true, stub('bg')), /name="site_art_direction"/, 'Candlelight is set in two places in the Studio');
  assert.match(art(true, stub('bg')), /name="site_magic_traveller"/, 'Magic Move left with it');
  assert.match(art(false, stub('bg')), /name="site_art_direction"/, 'the shipped Maker lost Candlelight');
  assert.match(art(true, null), /name="site_art_direction"/, 'with no Background panel, Candlelight has no home');
});

/* ── (8) a draft takes a live Candlelight off ─────────────────────────── */

test('(8) a draft that turns Candlelight off takes the layout’s attribute off the host’s canvas — and puts it back', async () => {
  const { takeCandlelightOff } = await import(`../${G}/candlelight-off-on-canvas`);
  // The rule, run on a stand-in for the layout's scope.
  const attrs: Record<string, string> = { 'data-art': 'candlelight', 'data-hub-theme': 'velvet' };
  const asked: string[] = [];
  const scope = {
    removeAttribute: (n: string) => void delete attrs[n],
    setAttribute: (n: string, v: string) => void (attrs[n] = v),
  };
  const from = { closest: (sel: string) => (asked.push(sel), attrs['data-art'] === 'candlelight' ? scope : null) };
  const undo = takeCandlelightOff(from);
  assert.deepEqual(asked, ["[data-art='candlelight']"], 'it looks for something other than the scope that wears Candlelight');
  assert.ok(!('data-art' in attrs), 'the canvas stays dark: the attribute was not lifted');
  assert.equal(attrs['data-hub-theme'], 'velvet', 'it touched more than Candlelight');
  assert.equal(typeof undo, 'function');
  undo!();
  assert.equal(attrs['data-art'], 'candlelight', 'the attribute is not put back when the drafted scope leaves');
  // Nothing above wears it: nothing is touched, nothing to undo.
  assert.equal(takeCandlelightOff({ closest: () => null }), null);
  assert.equal(takeCandlelightOff(null), null);
  // Mounted by the HOST's drafted scope only, and only while that draft is not Candlelight.
  const host = read(`${G}/host-draft-look.tsx`);
  assert.match(host, /\{look && look\.art !== 'candlelight' \? <CandlelightOffOnCanvas \/> : null\}/);
  assert.doesNotMatch(host, /Known limit/);
  const mark = read(`${G}/candlelight-off-on-canvas.tsx`);
  assert.match(mark, /useLayoutEffect\(\(\) => takeCandlelightOff\(ref\.current\) \?\? undefined, \[\]\);/);
  // ⛔ Never for a guest: the layout (every guest) does not import it; only the host's canvas wrapper does.
  for (const f of ['app/[slug]/layout.tsx', `${G}/guest-look-scope.tsx`]) assert.doesNotMatch(read(f), /candlelight-off-on-canvas|CandlelightOffOnCanvas/, `${f} mounts it for guests`);
  assert.match(read('app/[slug]/page.tsx'), /draftLook \? <HostDraftLook look=\{draftLook\}>\{node\}<\/HostDraftLook> : node;/, 'the drafted scope is no longer the host’s only');
});
