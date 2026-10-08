/**
 * the-fade-bar-is-one-line.test.ts — ONE BAR: BLACK ← AS IS → WHITE, SNAPPING TO THE CENTRE, WRITING ONCE.
 *
 * Owner, 2026-10-08, on Studio › Look › Background (DECISION_LOG "LOOK › BACKGROUND, AMENDED"): *"when scene, video
 * or upload is picked: I want a line bar where it can fade to white or fade to black · fade to white drag line bar to
 * right · fade to black drag to left · snap to center"*. Contract:
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A, § 3 and § 4 (the watches), prototype frames A04–A06.
 *
 *   (1) THE VALUE — a whole number −100…100; 0 is "as is" and is never stored; a word stored before the bar reads
 *       at its own place and is never rewritten.
 *   (2) THE HAND — a finger's place is the bar's value across the whole line; a release within ±8 of the centre
 *       lands ON it; "As is" and a double-tap return to it; keys move it.
 *   (3) THE WORDS — "As is" · "Lighter 60%" · "Darker 70% · light words": light words for every position left of
 *       the centre and for none at or right of it.
 *   (4) THE COST — a drag writes NOTHING until it ends: each position goes to the sample screen (in the browser),
 *       the release is ONE draft write, and a release where it started writes nothing. No timer, no write per frame.
 *   (5) THE SAMPLE — a position is worn at once: the veil the page's own rule measures, the words flipped left of
 *       the centre.
 *   (6) A ▾ OPENS — every dropdown of the Studio's Background is the house `PickMenu`; nothing there cycles.
 *
 * (What a position DOES to the words — never under the reading floor — is `shade-never-crosses-the-floor`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { FADE_INFO, FADE_SNAP, fadeAtPointer, fadeClamp, fadeFlipsWords, fadeKey, fadeMain, fadeOf, fadePercent, fadeSettled, fadeWords } from './background-fade';
import { HUB_MAIN_SHADE_AT, hubMainFadeAt, sanitizeHubMainGround, sanitizeHubMainShade, type HubMainGround } from './hub-canvas';
import { pagePaperAndInk } from './adaptive-theme';
import { INVITE_THEMES } from './invite-themes';
import { lookSampleGround } from './look-sample';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import { backgroundPickRedraws } from './background-pick';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'app/dashboard/[eventId]/website/editor/_components';
const L = 'app/dashboard/[eventId]/launch/_components';
const FRAME = ['#f4efe6', '#3a2f28', '#8a6f52'];
const PHOTO = { kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/c.jpg', tint: { match: true, frame: FRAME } } as unknown as HubMainGround;

test('(1) the value is a whole number −100…100; the centre is never stored; a word from before the bar reads at its own place', () => {
  // What may be stored.
  for (const n of [-100, -9, -1, 1, 60, 100]) assert.equal(sanitizeHubMainShade(n), n);
  for (const junk of [0, 101, -101, 0.5, NaN, '60', 'as-is', null, undefined]) assert.equal(sanitizeHubMainShade(junk), undefined, `${String(junk)} was stored`);
  // The bar's own write: a number, and at the centre NOTHING (the key is taken off).
  assert.deepEqual(fadeMain(PHOTO, 60), { ...PHOTO, shade: 60 });
  assert.deepEqual(fadeMain(PHOTO, -70), { ...PHOTO, shade: -70 });
  assert.equal('shade' in fadeMain({ ...PHOTO, shade: 60 } as HubMainGround, 0), false, '0 was stored — "as is" must be absent');
  assert.equal('shade' in fadeMain({ ...PHOTO, shade: 'darker' } as HubMainGround, 0), false);
  // Everything else of the background is as it was.
  const dressed = { ...PHOTO, blur: 'soft', focus: 'top', motion: 'parallax' } as unknown as HubMainGround;
  assert.deepEqual(fadeMain(dressed, 33), { ...dressed, shade: 33 });
  // …and what it writes survives the draft's own sanitiser, as written.
  assert.equal((sanitizeHubMainGround(fadeMain(PHOTO, -35)) as { shade?: unknown }).shade, -35);
  assert.equal('shade' in (sanitizeHubMainGround(fadeMain(PHOTO, 0)) as object), false);
  // OLD → NEW: the four words read at −70 · −45 · +45 · +70; nothing stored reads at the centre.
  assert.deepEqual([fadeOf({ ...PHOTO, shade: 'darker' } as HubMainGround), fadeOf({ ...PHOTO, shade: 'dark' } as HubMainGround), fadeOf({ ...PHOTO, shade: 'light' } as HubMainGround), fadeOf({ ...PHOTO, shade: 'lighter' } as HubMainGround)], [-70, -45, 45, 70]);
  assert.equal(fadeOf(PHOTO), 0);
  assert.equal(fadeOf(null), 0);
  assert.equal(fadeOf({ ...PHOTO, shade: 60 } as HubMainGround), 60);
  assert.equal(fadeOf({ ...PHOTO, shade: 'dusk' } as unknown as HubMainGround), 0, 'noise read as a fade');
  assert.equal(hubMainFadeAt('dark'), HUB_MAIN_SHADE_AT.dark);
  // A word is never REWRITTEN by being read: only a move of the bar writes, and then it writes a number.
  assert.equal((fadeMain({ ...PHOTO, shade: 'dark' } as HubMainGround, fadeOf({ ...PHOTO, shade: 'dark' } as HubMainGround)) as { shade?: unknown }).shade, -45);
  assert.doesNotMatch(read('lib/background-fade.ts'), /shade: '(?:darker|dark|light|lighter)'/, 'the bar writes a word');
});

test('(2) a finger’s place is the bar’s value across the whole line; a release near the centre lands ON it; keys move it', () => {
  // A 343-px track whose line is inset 22 px each end (the thumb's half-width): the ends are reachable.
  const at = (x: number) => fadeAtPointer(x, 16, 343, 22);
  assert.equal(at(16 + 22), -100, 'the left end is not fade-to-black');
  assert.equal(at(16 + 343 - 22), 100, 'the right end is not fade-to-white');
  assert.equal(at(16 + 343 / 2), 0);
  assert.equal(at(-500), -100, 'a finger past the end leaves the range');
  assert.equal(at(5000), 100);
  // Right of the centre is positive (white), left negative (black) — and it only ever grows to the right.
  let was = -101;
  for (let x = 16; x <= 16 + 343; x += 7) {
    const n = at(x);
    assert.ok(Number.isInteger(n) && n >= was, `the bar goes backwards at ${x}px`);
    was = n;
  }
  assert.equal(fadeAtPointer(100, 0, 0), 0, 'a track not laid out yet gave a position');
  // SNAP TO CENTRE: within ±8 a release IS the centre; just outside it stays where it is.
  assert.equal(FADE_SNAP, 8);
  for (let n = -8; n <= 8; n++) assert.equal(fadeSettled(n), 0, `${n} did not snap to the centre`);
  assert.deepEqual([fadeSettled(-9), fadeSettled(9), fadeSettled(60), fadeSettled(-100)], [-9, 9, 60, -100]);
  assert.equal(fadeSettled(250), 100);
  assert.equal(fadeSettled(NaN), 0);
  // The thumb's place: 0 % at black, 50 % at the centre, 100 % at white.
  assert.deepEqual([fadePercent(-100), fadePercent(0), fadePercent(100), fadePercent(60)], [0, 50, 100, 80]);
  // Keys: one step, ten, the ends — held inside the range; any other key is not the bar's.
  assert.deepEqual([fadeKey('ArrowRight', 0), fadeKey('ArrowLeft', 0), fadeKey('ArrowUp', 5), fadeKey('ArrowDown', 5)], [1, -1, 6, 4]);
  assert.deepEqual([fadeKey('PageUp', 95), fadeKey('PageDown', -95), fadeKey('Home', 3), fadeKey('End', 3)], [100, -100, -100, 100]);
  for (const k of ['Enter', ' ', 'Tab', 'a']) assert.equal(fadeKey(k, 0), null);
  assert.equal(fadeClamp(12.6), 13);
});

test('(3) the value in words — and light words for EVERY position left of the centre, for none at or right of it', () => {
  assert.equal(fadeWords(0), 'As is');
  assert.equal(fadeWords(60), 'Lighter 60%');
  assert.equal(fadeWords(-70), 'Darker 70% · light words');
  assert.equal(fadeWords(-1), 'Darker 1% · light words');
  for (let n = -100; n <= 100; n++) {
    assert.equal(fadeFlipsWords(n), n < 0, `${n}: the words' side is wrong`);
    assert.equal(fadeWords(n).includes('light words'), n < 0);
    // What the bar SAYS is what the page DOES: the page's own rule flips the words at exactly the same positions.
    const page = pagePaperAndInk(INVITE_THEMES.house);
    assert.equal(Boolean(shadeWordVars(mainGroundShade(n, page, FRAME), page)['--color-cream']), fadeFlipsWords(n), `${n}: the bar and the page disagree about the words`);
  }
  // The ⓘ says the floor, in the approved words.
  assert.match(FADE_INFO, /it snaps back to centre/);
  assert.match(FADE_INFO, /The fade never goes under the reading floor — if your words would not read, it is raised a little for you\./);
});

test('(4) a drag writes nothing until it ends — each position goes to the sample, the release is ONE write, and a release where it started writes nothing', async () => {
  const bar = read(`${E}/background-fade-bar.tsx`);
  // It is a slider with a range and its value in words.
  for (const mark of ['role="slider"', 'aria-label="Fade"', 'aria-valuemin={-100}', 'aria-valuemax={100}', 'aria-valuenow={at}', 'aria-valuetext={fadeWords(at)}']) assert.ok(bar.includes(mark), `the bar lost ${mark}`);
  // WHILE the thumb moves: `onMove` only — never the save.
  const move = bar.slice(bar.indexOf('const move = ('), bar.indexOf('const end = ('));
  assert.match(move, /onMove\(next\);/);
  assert.doesNotMatch(move, /onCommit/, 'a position is saved while the thumb is still moving');
  assert.match(move, /if \(next === liveRef\.current\) return;/, 'the same position is shown twice');
  const onMoveHandler = bar.slice(bar.indexOf('onPointerMove='), bar.indexOf('onPointerUp='));
  assert.doesNotMatch(onMoveHandler, /onCommit|end\(/, 'the bar writes per frame');
  // THE RELEASE: settle (the snap), then ONE commit — only if the value changed.
  const end = bar.slice(bar.indexOf('const end = ('), bar.indexOf('const pointerAt = ('));
  assert.match(end, /const settled = fadeSettled\(liveRef\.current\);/, 'a release does not snap');
  assert.match(end, /if \(settled !== fadeClamp\(value\)\) onCommit\(settled\);/, 'a release where it started writes');
  assert.equal((end.match(/onCommit\(/g) ?? []).length, 1);
  assert.match(bar, /onPointerUp=\{end\}\s*onPointerCancel=\{end\}/);
  // "As is" and a double-tap: the centre, in one write (and none when it is already there).
  const centre = bar.slice(bar.indexOf('const toCentre = ('), bar.indexOf('return ('));
  assert.match(centre, /if \(disabled \|\| at === 0\) return;/);
  assert.match(centre, /if \(fadeClamp\(value\) !== 0\) onCommit\(0\);/);
  assert.match(bar, /onDoubleClick=\{toCentre\}/);
  assert.match(bar, /data-bg-fade-as-is=""[\s\S]{0,120}onClick=\{toCentre\}/);
  // A held key moves many times and saves ONCE, when it is let go.
  const keyDown = bar.slice(bar.indexOf('onKeyDown='), bar.indexOf('onKeyUp='));
  assert.doesNotMatch(keyDown, /onCommit/, 'every key repeat writes');
  assert.match(bar.slice(bar.indexOf('onKeyUp='), bar.indexOf('onBlur=')), /if \(landed !== fadeClamp\(value\)\) onCommit\(landed\);/);
  // No timer, no poll, no request of its own, no router.
  assert.doesNotMatch(bar, /setTimeout|setInterval|requestAnimationFrame|fetch\(|router\.|useRouter|makerSave|hubDraftAction/, 'the bar waits, asks or saves by itself');

  // RENDERED: at the centre the thumb is ringed terracotta and there is no "As is" button; off the centre there is.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BgFadeBar } = await import(`../${E}/background-fade-bar`);
  const paint = (value: number) => renderToStaticMarkup(React.createElement(BgFadeBar, { value, onMove: () => {}, onCommit: () => {} }));
  const centred = paint(0);
  assert.match(centred, /data-bg-fade="0"/);
  assert.match(centred, />As is<\/span>/);
  assert.doesNotMatch(centred, /data-bg-fade-as-is/, 'the "As is" button shows when the bar is already there');
  assert.match(centred, /data-bg-fade-thumb="centre"[^>]*style="left:50%"/);
  assert.match(centred, /border-terracotta-700/);
  const right = paint(60);
  assert.match(right, />Lighter 60%<\/span>/);
  assert.match(right, /data-bg-fade-as-is=""/);
  assert.match(right, /aria-valuenow="60" aria-valuetext="Lighter 60%"/);
  assert.match(right, /data-bg-fade-thumb=""[^>]*style="left:80%"/);
  assert.match(paint(-70), />Darker 70% · light words<\/span>/);
  // A word stored before the bar shows at its place.
  assert.match(paint(fadeOf({ ...PHOTO, shade: 'lighter' } as HubMainGround)), />Lighter 70%<\/span>/);
  // The thumb is a 44-px target around a 28-px circle; the track is 44 px tall and takes the finger (no page scroll under it).
  assert.match(right, /class="absolute top-1\/2 flex h-11 w-11 /);
  assert.match(right, /<i class="block h-7 w-7 rounded-full /);
  assert.match(right, /data-bg-fade-track="" class="[^"]*\bh-11\b[^"]*\btouch-none\b/);

  // THE PANEL: a position → the sample (no write); the release → the Studio's one pick (one draft write).
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /onMove=\{\(at\) => tellLookSample\(eventId, \{ main: fadeTo\(at\) \}\)\}/, 'a drag is not shown on the sample');
  assert.match(panel, /onCommit=\{\(at\) => pickLook\(\{ main: fadeTo\(at\) \}, FAILED\)\}/, 'a release is not the one pick');
  assert.match(panel, /const fadeTo = \(at: number\) => \(current \? fadeMain\(current, at\) : current\);/);
  // …and a pick with a fade is one the server measures: held while the sample is the screen (one write, no render).
  assert.equal(backgroundPickRedraws({ main: PHOTO, bg: null, art: null }, { main: fadeMain(PHOTO, 60), bg: null, art: null }, true), true);
  assert.equal(backgroundPickRedraws({ main: fadeMain(PHOTO, 60), bg: null, art: null }, { main: PHOTO, bg: null, art: null }, true), false, 'leaving a fade asks for a render');
});

test('(5) the sample wears a position at once — the page’s own veil, the words flipped left of the centre', () => {
  const row = { role_palette: null, site_button_color: null };
  for (const themeId of ['house', 'velvet', 'galeriya'] as const) {
    const page = pagePaperAndInk(INVITE_THEMES[themeId]);
    for (const at of [-100, -70, -9, 9, 45, 100]) {
      const g = lookSampleGround(fadeMain(PHOTO, at), row, themeId);
      const shade = mainGroundShade(at, page, FRAME);
      assert.deepEqual(g.veil, { color: shade.veil, opacity: shade.opacity }, `${themeId} · ${at}: the sample's veil is not the page's`);
      assert.equal(g.veil!.color, at < 0 ? page.ink : page.paper);
      assert.equal(Boolean(g.vars['--color-cream']), at < 0, `${themeId} · ${at}: the sample's words are on the wrong side`);
    }
    // The centre: no fade veil at all — the picture as it is (the page's own paper veil only).
    assert.equal(lookSampleGround(fadeMain(PHOTO, 0), row, themeId).veil, null);
  }
});

test('(6) a ▾ in the Studio’s Background always opens its choices — the house PickMenu; nothing cycles', () => {
  const panel = read(`${E}/main-background-panel.tsx`);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  // Every row of word choices is a PickMenu with its whole list and the current value.
  const menus = [...studio.matchAll(/<PickMenu\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(menus.length >= 4, `anti-vacuity: only ${menus.length} dropdowns read`);
  for (const m of menus) {
    assert.match(m, /\bvalue=\{/, 'a dropdown does not show the current choice');
    assert.match(m, /\boptions=\{/, 'a dropdown has no list to open');
    assert.match(m, /\bonPick=\{/);
  }
  // No control of the Background files draws a chevron of its own, or steps to "the next value" on a tap.
  for (const f of [`${E}/main-background-panel.tsx`, `${E}/background-cards.tsx`, `${E}/background-colour-wells.tsx`, `${E}/background-fade-bar.tsx`]) {
    const src = read(f);
    assert.doesNotMatch(src, /ChevronDown|ChevronsUpDown|▾/, `${f} draws a ▾ that is not a PickMenu`);
    assert.doesNotMatch(src, /\[\(\w+\.indexOf\([^)]*\) \+ 1\) % \w+\.length\]/, `${f} cycles to the next value on a tap`);
  }
  // The old extras (the store shell's list) show a bar position as what it IS, never as "As is".
  const tools = read(`${L}/studio-tools.tsx`);
  assert.match(tools, /value=\{fadeSet !== null \? 'fade' : \(extra\('shade'\) \?\? 'as-is'\)\}/);
  assert.match(tools, /\.\.\.\(fadeSet !== null \? \[\{ key: 'fade', label: fadeWords\(fadeSet\) \}\] : \[\]\)/);
});
