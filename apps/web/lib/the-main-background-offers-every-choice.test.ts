/**
 * the-main-background-offers-every-choice.test.ts — owner, 2026-09-29, on the
 * Maker's "Main · behind every scene" panel (Luxe): *"the background animated
 * video cannot be unpicked. also the upload media is not on the background.
 * and the theme background is also not there."* (DECISION_LOG "THE MAIN
 * BACKGROUND OFFERS EVERY CHOICE…").
 *
 *   1 · the stored choice: the theme's own · none — two new states on the one
 *       draft key the Main background already has (`config_json.main`, no
 *       migration); a pick of either is free, media stays Pro;
 *   2 · "None" turns the theme's loop OFF on the page (the same switch the hero
 *       uses) and lays nothing over the colour;
 *   3 · the panel is ONE list of four, the loop is never forced, and Upload
 *       media is the scene picker's pictures + the in-place upload;
 *   4 · Parallax on the couple's own photo rides the shipped parallax.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

import {
  hubMainGround,
  isHubMainChoice,
  mainGroundIsNone,
  resolveMainGround,
  sanitizeHubMainGround,
  type HubMainGround,
} from './hub-canvas';
import { mainGroundChange } from './hub-draft';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));
const PANEL = 'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx';
const PHOTO = 'r2://setnayan-media/events/E1/main-background/p.jpg';
const HERO = 'r2://setnayan-media/events/E1/landing-page-hero/h.jpg';
const TINT = { match: true, frame: ['#a0a0a0'] };
const hero = { photoRef: HERO, videoRef: null, guestVideoRef: null };
const noClip = () => null;

/* ── 1 · THE STORED CHOICE ───────────────────────────────────────────────── */

test('1 · "the theme\'s own" and "none" are stored choices on the one Main key — nothing else sneaks in', () => {
  assert.deepEqual(sanitizeHubMainGround({ ground: 'theme' }), { ground: 'theme' });
  assert.deepEqual(sanitizeHubMainGround({ ground: 'none' }), { ground: 'none' });
  assert.equal(sanitizeHubMainGround({ ground: 'loop' }), null);
  assert.deepEqual(sanitizeHubMainGround({ ground: 'none', media: PHOTO, kind: 'photo' }), { ground: 'none' }, 'a choice carries no media');
  assert.deepEqual(hubMainGround({ main: { ground: 'none' } }), { ground: 'none' });
  // Parallax is kept on the couple's own PHOTO only.
  assert.equal((sanitizeHubMainGround({ kind: 'photo', media: PHOTO, motion: 'parallax' }) as { motion?: string }).motion, 'parallax');
  assert.equal((sanitizeHubMainGround({ kind: 'snippet', media: PHOTO, motion: 'parallax' }) as { motion?: string }).motion, undefined);
});

test('1b · a choice beats the hero: with a measured hero up, "the theme\'s own" draws NO picture', () => {
  const follow: HubMainGround = { follow: 'hero', of: HERO, tint: TINT };
  assert.ok(resolveMainGround(follow, hero, noClip), 'fixture: the hero would paint');
  assert.equal(resolveMainGround({ ground: 'theme' }, hero, noClip), null);
  assert.equal(resolveMainGround({ ground: 'none' }, hero, noClip), null);
  assert.equal(mainGroundIsNone({ ground: 'none' }), true);
  assert.equal(mainGroundIsNone({ ground: 'theme' }), false);
  assert.equal(mainGroundIsNone(follow), false);
});

test('1c · picking the theme\'s own or none is FREE; putting media (or Parallax) up is Pro', () => {
  const own: HubMainGround = { kind: 'photo', media: PHOTO, tint: TINT };
  assert.equal(mainGroundChange(own, { ground: 'none' }), 'remove', 'taking media down is a removal');
  assert.equal(mainGroundChange(null, { ground: 'none' }), 'none');
  assert.equal(mainGroundChange(null, { ground: 'theme' }), 'none');
  assert.equal(mainGroundChange({ follow: 'hero', of: HERO, tint: TINT }, { ground: 'theme' }), 'remove');
  assert.equal(mainGroundChange({ ground: 'none' }, own), 'add', 'media is Pro');
  assert.equal(mainGroundChange(own, { ...own, motion: 'parallax' }), 'add', 'Parallax is Pro, like the photo');
});

/* ── 2 · NONE TURNS THE LOOP OFF ─────────────────────────────────────────── */

test('2 · "None" hides the theme\'s loop and poster with the SAME switch the hero uses — and paints nothing else', async () => {
  const { MainGround, MainGroundNone } = await import('../app/[slug]/_components/main-ground');
  const none = renderToStaticMarkup(React.createElement(MainGroundNone));
  const HIDE = '[data-guest-ground] [data-theme-loop],[data-guest-ground] [data-theme-poster]{display:none}';
  assert.ok(none.includes(HIDE), 'the loop and its poster are switched off');
  assert.doesNotMatch(none, /<div|<video|background-image/, 'nothing laid over the colour');
  const withHero = renderToStaticMarkup(
    React.createElement(MainGround, { still: 'https://x.test/a.jpg', clip: null, adaptive: { tint: null, scrim: 0.3 } as never, vars: {} }),
  );
  assert.ok(withHero.includes(HIDE), 'one switch, not two');
  // The page asks for it first, before any ownership read (it is free), and only where a loop exists.
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  const body = layer.slice(layer.indexOf('export async function mainGroundLayerFor'));
  const noneAt = body.indexOf('if (mainGroundIsNone(hubMainGround(heroConfig))) {');
  assert.ok(noneAt > 0 && noneAt < body.indexOf('websiteProActiveFor'), '"none" is answered before the Pro read');
  assert.match(body, /return INVITE_THEMES\[theme\]\?\.media \? <MainGroundNone \/> : null;/);
});

/* ── 3 · THE PANEL IS ONE LIST OF FOUR ───────────────────────────────────── */

test('3 · the Maker offers a moving background ◆ · same as my hero · Upload media · Just the colour — every one tappable', () => {
  // 🎞 2026-10-05 (DECISION_LOG "THEMES ARE REPLACED BY THREE DIRECT GLOBAL
  // SETTINGS"): "the theme's own" became MOVING BACKGROUNDS — every shipped
  // loop in ONE dropdown, picked on its own, never the theme's fonts/colours.
  const panel = read(PANEL);
  const comp = panel.slice(panel.indexOf('export function MainBackgroundPanel'));
  // 🧭 ONE DROPDOWN since 2026-10-06 (controller sweep; owner rule "any set of choices is a dropdown"):
  // every loop under "Moving background", then Same as my hero · Upload media, then Just the colour.
  assert.match(comp, /<PickMenu\s+label="Behind every scene"[\s\S]*?options=\{\[\s*\.\.\.loops\.map\(/, 'the choices are not ONE dropdown');
  for (const key of ['src:hero', 'src:media', 'src:none']) {
    assert.match(comp, new RegExp(`key: '${key}'`), `the ${key} choice is not a row of the dropdown`);
  }
  assert.match(comp, /group: 'Moving background'/);
  assert.doesNotMatch(comp, /<Choice\s+on=\{choice === '(hero|media|none)'\}/, 'a background choice is a button again (a pill stack)');
  // 🎞 By a name you can picture (owner 2026-09-29, OWNER ANSWERS (11)) — "Luxe chandeliers", built on the server.
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /loops=\{hubMovingBackgroundIds\(\)\.map\(\(id\) => \(\{\s*id,\s*name: themeBackgroundName\(id\),/, 'a loop is not named by its picture-able name');
  assert.match(comp, /label: 'Just the colour'/);
  // The page's own loop stays the stored choice it always was (nothing a couple had becomes a charge); any other is a loop of ours.
  assert.match(comp, /id === themeId \? \{ ground: 'theme' \} : \{ ground: 'loop', loop: id \}/, 'a loop pick is not a stored choice');
  assert.match(comp, /save\(\{ ground: 'none' \}/, 'none is a stored choice — the loop can be turned off');
  // The loop is never forced: only "Same as my hero" can be unavailable (no hero photo), never None or Upload.
  const noneRow = comp.slice(comp.indexOf("key: 'src:none'"), comp.indexOf("key: 'src:none'") + 120);
  assert.ok(noneRow.length > 20 && !/disabledNote/.test(noneRow), 'None is always available');
  const uploadRow = comp.slice(comp.indexOf("key: 'src:media'"), comp.indexOf("key: 'src:none'"));
  assert.ok(!/disabledNote/.test(uploadRow), 'Upload is always available');
  assert.doesNotMatch(comp, /Pick another theme/, 'no "go pick a theme" dead end — a couple no longer picks one');
  assert.doesNotMatch(comp, /Your hero is the written invitation card, so .* own background stays behind your scenes/, 'the forced-loop note is gone');
});

test('3c · a moving background stores ONLY a shipped loop, and the guest page draws it through the one gated mount', async () => {
  const { sanitizeHubMainGround, hubMovingBackgroundIds, isHubMainLoop } = await import('./hub-canvas');
  const { INVITE_THEMES } = await import('./invite-themes');
  const ids = hubMovingBackgroundIds();
  assert.ok(ids.length >= 9, `anti-vacuity: ${ids.length} loops`);
  assert.ok(!ids.includes('house'), 'Classic has no loop to offer');
  for (const id of ids) assert.ok(INVITE_THEMES[id].media, `${id} is offered with no loop`);
  assert.deepEqual(sanitizeHubMainGround({ ground: 'loop', loop: 'velvet' }), { ground: 'loop', loop: 'velvet' });
  assert.equal(sanitizeHubMainGround({ ground: 'loop', loop: 'house' }), null, 'a theme with no loop is stored as a loop');
  assert.equal(sanitizeHubMainGround({ ground: 'loop', loop: 'not-a-theme' }), null);
  assert.equal(sanitizeHubMainGround({ ground: 'loop' }), null);
  assert.ok(isHubMainLoop({ ground: 'loop', loop: 'cyber' }) && !isHubMainLoop({ ground: 'theme' }));
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(layer, /const loop = isHubMainLoop\(main\) \? movingBackground\(main\.loop\) : null;/);
  // Only the loop is drawn — never the loop theme's fonts or colours: the page's own theme dresses the veil.
  assert.match(layer, /const adaptive = resolveAdaptiveTheme\(dressedTheme\(theme, event\.role_palette\), mainGround\.tint\);/);
  assert.match(layer, /tint: \{ match: false, frame: \[media\.samples\.light, media\.samples\.dark\] \}/, 'a loop recolours the page');
  // The host's canvas tries it before Pro; a guest never passes `tryOn`.
  assert.match(read('app/[slug]/_components/site-body.tsx'), /tryOn: isEditorCanvas,/);
});

test('3b · Upload media is the scene picker\'s pictures, the ready-made scenes and the in-place upload', () => {
  const comp = read(PANEL);
  assert.match(comp, /import \{ ClipTile, PhotoTile, type SceneUpload \} from '\.\/scene-background-row';/, 'the SAME tiles as a scene');
  assert.match(comp, /photoChoices\.map\(\(p\) =>/);
  assert.match(comp, /sceneUploads\.map\(\(u\) =>/);
  assert.match(comp, /STD_REALISTIC_BACKGROUNDS\.map\(\(b\) =>/, 'the ready-made Save the Date scenes');
  assert.match(comp, /<FileUpload[\s\S]*?pathPrefix=\{`events\/\$\{eventId\}\/main-background`\}[\s\S]*?compressImage[\s\S]*?compressVideo[\s\S]*?onChange=\{onUploaded\}/, 'upload in place');
  assert.match(comp, /options=\{HUB_MEDIA_MOTIONS\.map/, 'Still · Parallax on a photo — one PickMenu');
  assert.match(comp, /const proMark = makerProMark\(\{ owns: ownsPro, storeShell: false \}\);/, '◆ PRO while tried — never a lock');
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /photoChoices=\{photoChoices\}\s*videoChoice=\{videoChoice\}\s*sceneUploads=\{sceneUploads\}\s*mediaUsedBytes=\{mediaUsedBytes\}\s*\/>/);
  // Apply accepts every picture the picker offers.
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /const mainIsOwn = \(ref: unknown\) =>[\s\S]*?isStdLibrarySrc\(ref\)\);/);
});

/* ── 4 · PARALLAX ON THE MAIN BACKGROUND ─────────────────────────────────── */

test('4 · Parallax on the couple\'s own photo is the shipped parallax, in page-scroll mode', async () => {
  const { MainGround } = await import('../app/[slug]/_components/main-ground');
  const html = renderToStaticMarkup(
    React.createElement(MainGround, { still: 'https://x.test/a.jpg', clip: null, adaptive: { tint: null, scrim: 0.3 } as never, vars: {}, parallax: true }),
  );
  assert.match(html, /data-pahina-parallax="page"/);
  const still = renderToStaticMarkup(
    React.createElement(MainGround, { still: 'https://x.test/a.jpg', clip: null, adaptive: { tint: null, scrim: 0.3 } as never, vars: {} }),
  );
  assert.doesNotMatch(still, /data-pahina-parallax/);
  const motion = readFileSync(join(ROOT, 'app/[slug]/_components/pahina-motion.tsx'), 'utf8');
  assert.match(motion, /if\(el\.getAttribute\('data-pahina-parallax'\)==='page'\)\{p=\(window\.scrollY\|\|0\)\/sh;\}/);
  assert.equal(resolveMainGround({ kind: 'photo', media: PHOTO, tint: TINT, motion: 'parallax' }, hero, noClip)?.parallax, true);
  assert.ok(isHubMainChoice({ ground: 'none' }));
});

// 🎞 OWNER 2026-09-29, "OWNER ANSWERS — TEN OPEN QUESTIONS" (11): each theme's own
// background has a short name you can picture; every theme with a loop has one.
test('every theme with a background loop has a picture-able name; Classic (no loop) has none', async () => {
  const { INVITE_THEMES, INVITE_THEME_IDS, THEME_BACKGROUND_NAMES, themeBackgroundName } = await import('./invite-themes');
  for (const id of INVITE_THEME_IDS) {
    const name = THEME_BACKGROUND_NAMES[id];
    if (INVITE_THEMES[id].media) {
      assert.ok(name && name.trim().length > 3, `${id} has a loop and no name`);
      assert.ok(name!.startsWith(INVITE_THEMES[id].name.split(' ').pop()!) || name!.startsWith(INVITE_THEMES[id].name.split(' ')[0]!), `${id}: "${name}" does not say which theme it is`);
      assert.equal(themeBackgroundName(id), name);
    } else assert.equal(name, null, `${id} has no loop yet is named`);
  }
  assert.equal(THEME_BACKGROUND_NAMES.velvet, 'Luxe chandeliers', 'the owner’s own example');
});
