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
 *   (8) a draft can take a LIVE Candlelight off the host's canvas;
 *  (10) "Your cover photo" is a card only when there IS a cover photo — never an
 *       empty placeholder, never the word "hero"; a follow with nothing to follow
 *       reads as what guests see;
 *   (9) a card is PHONE-SHAPED — 3 : 4 portrait, a fixed width that never grows —
 *       and the picture on the page is cropped where the page crops it.
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
  BACKGROUND_SOURCES_OFFERED,
  backgroundSourcesOffered,
  BACKGROUND_SOURCE_IS_PRO,
  BACKGROUND_SOURCE_LABEL,
  backgroundShadeValue,
  backgroundShadeWrite,
  backgroundSourceOf,
  backgroundWritePatch,
  coverCardShows,
  loopCardDrawsVideo,
  type BackgroundSource,
} from './background-source';
import { HUB_MAIN_FOCUSES, HUB_MAIN_PATTERNS, hubMovingBackgroundIds, mainGroundPosition, sanitizeHubMainGround, type HubMainGround } from './hub-canvas';
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
    [FOLLOW, { themeHasLoop: true, followsHero: true }, 'own', 'the cover photo, followed'],
    [FOLLOW, page, 'video', 'a follow with NO cover photo to follow — guests see the theme’s own loop'],
    [FOLLOW, { themeHasLoop: false, followsHero: false }, 'colour', 'the same on Classic — guests see the colour'],
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

test('(2) Source ▾ offers Colour · Scene · Video · Upload — no Pattern to pick; a stored pattern is still said — ◆ exactly where Apply asks for Event Hub Pro', () => {
  // Owner 2026-10-08, on the local copy: "Color · no more Pattern · Scene · Video · Upload".
  assert.deepEqual([...BACKGROUND_SOURCES_OFFERED], ['colour', 'scene', 'video', 'own']);
  assert.deepEqual(BACKGROUND_SOURCES_OFFERED.map((k) => BACKGROUND_SOURCE_LABEL[k]), ['Colour', 'Scene', 'Video', 'Upload']);
  for (const stored of ['colour', 'scene', 'video', 'own'] as const) {
    assert.deepEqual([...backgroundSourcesOffered(stored)], ['colour', 'scene', 'video', 'own'], `${stored}: Pattern is offered`);
  }
  for (const label of Object.values(BACKGROUND_SOURCE_LABEL)) assert.doesNotMatch(label, /your photo or video/i, 'the source is still named "Your photo or video"');
  // 🔑 A pattern ALREADY stored is still read, said and drawn: the Source names it as the current value — never "Colour" over a page that wears dots.
  assert.equal(backgroundSourceOf(PATTERN, { themeHasLoop: true, followsHero: false }), 'pattern');
  assert.deepEqual([...backgroundSourcesOffered('pattern')], ['colour', 'pattern', 'scene', 'video', 'own']);
  assert.equal(BACKGROUND_SOURCE_LABEL.pattern, 'Pattern');
  // …what a stored background can BE is still all five (guests keep their pattern).
  assert.deepEqual([...BACKGROUND_SOURCES], ['colour', 'pattern', 'scene', 'video', 'own']);
  assert.match(read(`${G}/main-ground.tsx`), /export function PatternGround\(/, 'the guest page no longer draws a stored pattern');
  assert.match(read('app/[slug]/_lib/main-ground-layer.tsx'), /if \(main && 'ground' in main && main\.ground === 'pattern'\) \{\s*return <PatternGround pattern=\{main\.pattern\}/, 'a stored pattern is no longer drawn for guests');
  assert.ok(Object.keys(MAIN_GROUND_PATTERN_CSS).length >= 4, 'the patterns’ own definitions are gone');
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
  assert.match(studio, /options=\{backgroundSourcesOffered\(storedSource\)\.filter\(\(k\) => k !== 'video' \|\| loops\.length > 0\)\.map\(\(k\) => \(\{\s*key: k,\s*label: BACKGROUND_SOURCE_LABEL\[k\],/, 'the dropdown does not list what the rule offers');
  // A stored pattern draws ONLY its own card (ringed) — no other pattern can be picked any more.
  assert.match(studio, /\{view === 'pattern'\s*\? HUB_MAIN_PATTERNS\.filter\(\(k\) => k === pattern\)\.map\(\(k\) => \(/, 'a new pattern can still be picked');
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
  assert.match(studio, /view === 'pattern'\s*\? HUB_MAIN_PATTERNS\.filter\(\(k\) => k === pattern\)\.map[\s\S]{0,520}onPick=\{\(\) => save\(\{ ground: 'pattern', pattern: k \}, FAILED\)\}/);
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
  assert.match(panel, /swatch=\{patternCardSwatch\(k, paper\)\.image\}\s*swatchSize=\{patternCardSwatch\(k, paper\)\.size\}/);
  /* 🧵 A PATTERN CARD MUST SHOW ITS PATTERN — on ANY page colour (the preview walk 2026-10-08: on a dark paper,
     `#1e2229`, Fine lines · Dots · Lace were three identical dark rectangles). The card's stroke is MEASURED
     here against its paper, for light, dark and mid papers; and the four cards are four different pictures. */
  const { patternCardSwatch, patternCardInk, PATTERN_CARD_MIN_CONTRAST, PATTERN_CARD_INKS } = await import('./main-ground-pattern-cards');
  const { compositeOver, contrastRatio } = await import('./hub-legibility');
  assert.equal(patternCardInk('#1e2229'), PATTERN_CARD_INKS.light, 'a dark paper gets the dark ink (invisible)');
  assert.equal(patternCardInk('#ffffff'), PATTERN_CARD_INKS.dark);
  for (const paper of ['#1e2229', '#000000', '#17160f', '#ffffff', '#f6f1e7', '#808080', '#5b1a22', '#d9c4cf']) {
    const pictures = HUB_MAIN_PATTERNS.map((k) => patternCardSwatch(k, paper));
    assert.equal(new Set(pictures.map((p) => p.image)).size, HUB_MAIN_PATTERNS.length, `on ${paper} two pattern cards are the same picture`);
    HUB_MAIN_PATTERNS.forEach((k, i) => {
      const { image, size } = pictures[i]!;
      assert.ok(image.endsWith(`, ${paper}`), `${k} on ${paper}: the page colour is not under the pattern`);
      assert.equal(size, MAIN_GROUND_PATTERN_CSS[k].size);
      assert.doesNotMatch(image, /var\(--color-ink\)/, `${k} on ${paper}: drawn in the DASHBOARD's ink, not one measured for this paper`);
      const strokes = [...image.matchAll(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)];
      assert.ok(strokes.length >= 1, `anti-vacuity: no stroke found in ${k}`);
      for (const [, r, g, b, a] of strokes) {
        const ink = '#' + [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
        const seen = contrastRatio(compositeOver(ink, Number(a), paper), paper);
        assert.ok(seen >= PATTERN_CARD_MIN_CONTRAST, `${k} on ${paper}: the stroke reads ${seen.toFixed(2)}:1 — a card that does not show its pattern`);
      }
      // Never a second drawing: with the page's ink put back, the card IS the one definition.
      const back = image.slice(0, -`, ${paper}`.length).replace(/rgb\(\d+ \d+ \d+ \/ [\d.]+\)/g, 'INK');
      assert.equal(back, MAIN_GROUND_PATTERN_CSS[k].image.replace(/rgb\(var\(--color-ink\) \/ 0?\.\d+\)/g, 'INK'), `${k}: the card is a different drawing from the guest page's`);
    });
  }
  // The guest page keeps the page's OWN ink (it flips light on a dark paper by the look resolver) — untouched.
  for (const k of HUB_MAIN_PATTERNS) assert.match(MAIN_GROUND_PATTERN_CSS[k].image, /rgb\(var\(--color-ink\) \/ 0?\.\d+\)/);
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
  assert.match(studio, /if \(w\.art\) write\.events = \{ site_art_direction: w\.art \};\s*if \(w\.stepMoves\) write\.main = withExtra\('shade', w\.step\);\s*pickLook\(write, FAILED\);/);
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

/* ── (9) a card is phone-shaped ───────────────────────────────────────── */

/** The declarations of the stylesheet's ONE rule for `selector` (comments blanked). */
function cssRule(selector: string): Record<string, string> {
  const css = read('app/globals.css');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...css.matchAll(new RegExp(`(^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))];
  assert.equal(hits.length, 1, `expected ONE \`${selector}\` rule, found ${hits.length}`);
  return Object.fromEntries(
    hits[0]![2]!
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
  );
}
/** Any class or inline declaration that would size, stretch or reshape an element. */
const SIZING_CLASS = /^(?:[a-z-]+:)*(?:w-|h-|min-w-|max-w-|min-h-|max-h-|size-|aspect-|basis-|flex-(?:1|auto|initial|grow|shrink)|grow|shrink|col-span|self-stretch)/;
const SIZING_STYLE = /(?:^|;)\s*(?:width|height|min-width|max-width|inline-size|block-size|aspect-ratio|flex|flex-grow|flex-basis)\s*:/;
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';

test('(9) a card is PHONE-SHAPED: a 3 : 4 portrait frame of a fixed width that can never grow, cropped where the page crops', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const P = await import(`../${E}/main-background-panel`);
  // What the rendered card WEARS is what is measured: its classes, resolved against the stylesheet.
  const sizeOf = (classes: string[], what: string) => {
    const frames = classes.filter((c) => c === 'sn-phone-card');
    assert.equal(frames.length, 1, `${what}: the picture does not wear the Maker’s ONE picture-card frame (.sn-phone-card)`);
    const stray = classes.filter((c) => SIZING_CLASS.test(c));
    assert.deepEqual(stray, [], `${what}: a class beside the frame sizes the picture`);
    const rule = cssRule('.sn-phone-card');
    const [w, h] = (rule['aspect-ratio'] ?? '').split('/').map((n) => Number(n.trim()));
    return { ratio: w! / h!, width: rule['inline-size'] ?? '', flex: rule['flex'] ?? '' };
  };
  for (const [what, props, child] of [
    ['a colour card, picked', { name: 'Plain', data: 'fill:plain', on: true, onPick: () => {}, swatch: '#abcdef' }, null],
    ['a pattern card', { name: 'Dots', data: 'pattern:dots', on: false, onPick: () => {}, swatch: 'x', swatchSize: '12px 12px' }, null],
    ['a Pro video card with a long name', { name: 'Cinderella moonlit frost and more', data: 'loop:x', on: false, onPick: () => {}, swatch: '#000', pro: true, moving: true }, React.createElement(C.LoopPicture, { src: 'https://x.test/a.mp4' })],
    ['the Upload card', { name: 'Photo or video', data: 'upload', on: false, onPick: () => {}, swatch: '#fff', pro: true }, React.createElement(C.UploadPicture)],
    ['a picture card', { name: 'Your photo', data: 'own:a', on: true, onPick: () => {}, swatch: '#fff' }, React.createElement(P.StillOverSwatch, { src: 'https://x.test/a.jpg', swatch: '#fff' })],
  ] as const) {
    const html = renderToStaticMarkup(React.createElement(C.BgCard, props, child));
    const picture = /<span[^>]*data-bg-card-picture=""[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(picture, `${what}: no picture element`);
    const size = sizeOf(attr(picture, 'class').split(/\s+/), what);
    assert.equal(size.ratio, 3 / 4, `${what}: the frame is not 3 : 4`);
    assert.ok(size.ratio < 1, `${what}: the frame is not PORTRAIT`);
    assert.match(size.width, /^var\(--phone-card-w, \d+px\)$/, `${what}: the frame has no fixed inline size`);
    assert.equal(size.flex, 'none', `${what}: the frame may grow or shrink`);
    assert.doesNotMatch(attr(picture, 'style'), SIZING_STYLE, `${what}: an inline style resizes the frame`);
    // The CARD itself: exactly as wide as its picture, never growing in a wide panel, never shrinking in a narrow one.
    const card = /<button[^>]*>/.exec(html)![0];
    const cls = attr(card, 'class').split(/\s+/);
    assert.ok(cls.includes('flex-none'), `${what}: the card can flex — in a wide panel it becomes a strip`);
    assert.ok(cls.includes('w-min'), `${what}: the card is not as wide as its picture`);
    assert.deepEqual(cls.filter((c) => c !== 'w-min' && c !== 'flex-none' && SIZING_CLASS.test(c)), [], `${what}: a class resizes the card`);
    assert.doesNotMatch(attr(card, 'style'), SIZING_STYLE);
    // The name: one line, cut with …, never widening the card; the ◆ is outside the cut.
    const name = /<span[^>]*data-bg-card-name=""[^>]*>/.exec(html)![0];
    for (const c of ['w-0', 'min-w-full']) assert.ok(attr(name, 'class').split(/\s+/).includes(c), `${what}: a long name can widen the card (${c} missing)`);
    assert.match(html, /<span class="truncate">[^<]+<\/span>/, `${what}: the name is not cut on one line`);
    if ('pro' in props) assert.match(html, /<\/span><span aria-label="Event Hub Pro" class="shrink-0[^"]*">◆<\/span>/, `${what}: the ◆ can be cut off with the name`);
    // The ring is on the frame itself (a shadow, so it keeps the frame's shape and radius).
    assert.match(attr(picture, 'class'), props.on ? /(?:^| )ring-2 ring-terracotta-700(?: |$)/ : /(?:^| )ring-1 ring-ink\/10(?: |$)/, `${what}: the ring is not on the frame`);
  }
  // The strip scrolls sideways and never stretches its cards to one height or width.
  const strip = renderToStaticMarkup(React.createElement(C.BgCards, { label: 'Video', source: 'video' }, null));
  const stripCls = attr(/^<div[^>]*>/.exec(strip)![0], 'class').split(/\s+/);
  for (const c of ['flex', 'overflow-x-auto', 'items-start']) assert.ok(stripCls.includes(c), `the strip is not ${c}`);
  assert.deepEqual(stripCls.filter((c) => /^(?:grid|flex-wrap|justify-(?:between|stretch))/.test(c)), [], 'the strip lays its cards out to fill the panel');
  // Every card of the panel is a BgCard — no second, hand-sized card in the Studio.
  const panel = read(`${E}/main-background-panel.tsx`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.ok(studio.length > 2000, 'anti-vacuity: the Studio branch was not found');
  assert.doesNotMatch(studio, /GroundCarousel|aspect-\[|h-\[(?:66|86)px\]/, 'the Studio draws a card that is not the phone frame');
  // A loop and a still fill the frame, cropped (the frame's own rule covers them too).
  const media = cssRule('.sn-phone-card :is(img, video)');
  assert.equal(media['object-fit'], 'cover');
  // 🎯 Cropped WHERE THE PAGE CROPS: one rule, read by the guest page and by the card of the picture on the page.
  assert.deepEqual([null, ...HUB_MAIN_FOCUSES].map((f) => mainGroundPosition(f)), ['center', 'center top', 'center bottom']);
  const guest = read(`${G}/main-ground.tsx`);
  assert.match(guest, /const position = mainGroundPosition\(focus\);/, 'the guest page positions its background by a rule of its own');
  assert.doesNotMatch(guest, /'center top'|'center bottom'/, 'the guest page keeps a second copy of the crop rule');
  assert.match(studio, /const heldAt = mainGroundPosition\(takes\.focus \? \(extra\('focus'\) as HubMainFocus \| null\) : null\);/);
  // …and the card ON the page really is handed that position (a `held` that answers nothing would crop every card at its centre).
  assert.match(studio, /const held = \(isOn: boolean \| null \| undefined\) => \(isOn \? \{ position: heldAt \} : \{\}\);/, 'the card of the picture on the page is not held where Focus holds it');
  assert.doesNotMatch(studio, /object-(?:top|bottom)|'center top'|'center bottom'/, 'the cards keep a second copy of the crop rule');
  const stills = studio.split('<StillOverSwatch').slice(1).map((c) => c.slice(0, c.indexOf('/>')));
  assert.ok(stills.filter((c) => /\{\.\.\.held\(active/.test(c)).length >= 5, 'a picture that can be ON the page is not cropped where the page crops it');
  for (const f of HUB_MAIN_FOCUSES) {
    const at = mainGroundPosition(f);
    assert.match(renderToStaticMarkup(React.createElement(P.StillOverSwatch, { src: 'https://x.test/a.jpg', swatch: '#fff', position: at })), new RegExp(`style="object-position:${at}"`), `Focus ${f} does not reach the card`);
  }
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(P.StillOverSwatch, { src: 'https://x.test/a.jpg', swatch: '#fff' })), /object-position/);
});

/* ── (10) no cover photo, no card ─────────────────────────────────────── */

test('(10) "Your cover photo" is drawn only when there is one — no empty card, never the word "hero", and a stale follow reads as what guests see', async () => {
  // The rule, executed.
  const REF = 'r2://setnayan-media/events/E1/landing-page-hero/h.jpg';
  assert.equal(coverCardShows({ classic: false, photoRef: REF, photoUrl: 'https://x.test/h.jpg' }), true);
  assert.equal(coverCardShows({ classic: false, photoRef: null, photoUrl: null }), false, 'no cover photo still draws a card');
  assert.equal(coverCardShows({ classic: false, photoRef: REF, photoUrl: null }), false, 'a cover photo with no picture to draw is an empty card');
  assert.equal(coverCardShows({ classic: false, photoRef: null, photoUrl: 'https://x.test/h.jpg' }), false);
  assert.equal(coverCardShows({ classic: true, photoRef: REF, photoUrl: 'https://x.test/h.jpg' }), false, 'Classic never follows a cover');
  // The panel ASKS it, for the one card that follows the cover — and that card is the photo itself.
  const panel = read(`${E}/main-background-panel.tsx`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.ok(studio.length > 2000, 'anti-vacuity: the Studio branch was not found');
  const at = studio.indexOf('data="src:hero"');
  assert.ok(at > 0 && studio.indexOf('data="src:hero"', at + 1) === -1, 'expected ONE cover card in the Studio');
  const before = studio.slice(studio.lastIndexOf('{coverCardShows(', at), at);
  assert.match(before, /^\{coverCardShows\(\{ classic: themeId === 'house', photoRef: hero\.photoRef, photoUrl: hero\.photoUrl \}\) \? \(\s*<BgCard\s+name="Your cover photo"\s*$/, 'the cover card is drawn without asking whether there is a cover photo');
  const card = studio.slice(at, studio.indexOf('</BgCard>', at));
  assert.match(card, /<StillOverSwatch src=\{hero\.photoUrl\}/, 'the cover card is not the photo itself');
  assert.doesNotMatch(card, /disabled=|\? \(|: \(/, 'the cover card has an empty / disabled state');
  assert.doesNotMatch(studio, /Add a cover photo first|add a hero photo/i, 'a placeholder card tells the couple to add a cover photo');
  // Never the word "hero" in what the Studio's Background SAYS (names, labels, ⓘ text, lines).
  const said = [
    ...[...studio.matchAll(/\b(?:name|label|info)="([^"]*)"/g)].map((m) => m[1]!),
    ...[...studio.matchAll(/label: [`']([^`']*)[`']/g)].map((m) => m[1]!),
    ...[...studio.matchAll(/>\s*([A-Z][^<>{}]{3,})\s*</g)].map((m) => m[1]!),
    BACKGROUND_MAIN_INFO,
    ...Object.values(BACKGROUND_SOURCE_LABEL),
  ];
  assert.ok(said.length >= 12, `anti-vacuity: only ${said.length} strings read`);
  assert.ok(said.includes('Your cover photo'));
  for (const w of said) assert.doesNotMatch(w, /\bhero\b/i, `the Studio says “${w}”`);
  // A stored follow whose photo is gone is NOT "Your photo or video": the Source reads what guests see.
  assert.match(studio, /followsHero: Boolean\(follow\) \|\| \(!current && Boolean\(hero\.photoRef\) && themeId !== 'house'\),/);
  assert.match(panel, /const follow = current && isHubMainFollow\(current\) && current\.of === hero\.photoRef \? current : null;/);
  const { resolveMainGround } = await import('./hub-canvas');
  const gate = (r: string) => r;
  assert.equal(resolveMainGround(FOLLOW, { photoRef: null, videoRef: null }, gate), null, 'anti-vacuity: a follow with no cover photo draws a picture for guests');
  assert.equal(backgroundSourceOf(FOLLOW, { themeHasLoop: true, followsHero: false }), 'video');
  assert.equal(backgroundSourceOf(FOLLOW, { themeHasLoop: false, followsHero: false }), 'colour');
  assert.equal(resolveMainGround(FOLLOW, { photoRef: (FOLLOW as { of: string }).of, videoRef: null }, gate)?.source, 'hero');
  assert.equal(backgroundSourceOf(FOLLOW, { themeHasLoop: true, followsHero: true }), 'own');
});
