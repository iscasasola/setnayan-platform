/**
 * the-main-background-moves-for-guests.test.ts — audit 2026-10-02, Batch F1
 * item 4: *"Main background video plays for the host only — guests see a
 * still"*. The owner had already ruled (DECISION_LOG 2026-09-29, answer 2,
 * verbatim *"make it move"*) that a couple's clip plays for guests; the Main
 * background ("behind every scene") still met the CLOSED hero-masthead switch
 * (`GUEST_HERO_VIDEO_PLAYBACK`) twice over — once as the gate passed in, once
 * as `hero.guestVideoRef` for the default "follows the hero" source.
 *
 *   1 · ONE gate for both sources: the couple's own clip AND the hero clip the
 *       Main background follows reach a guest through the scene-clip kill
 *       switch — and both fall back to the still when it is closed;
 *   2 · the switch is ON in code (production gets the code value);
 *   3 · the page asks THAT gate, and signs the guest's clip from it;
 *   4 · on the phone: the still paints first and stays unless the clip MOVES;
 *       muted, inline, looping, no controls, never under reduced motion or
 *       Save-Data, resting off-screen and in a background tab.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

import { resolveMainGround, type HubMainGround } from './hub-canvas';
import {
  GUEST_HERO_VIDEO_PLAYBACK,
  GUEST_SCENE_CLIP_PLAYBACK,
  mainGroundClipRefForGuests,
  sceneClipRefForGuests,
} from './guest-hero-video';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

const HERO = 'r2://setnayan-media/events/E1/landing-page-hero/h.jpg';
const HERO_CLIP = 'r2://setnayan-media/events/E1/landing-page-hero-video/h.mp4';
const OWN_CLIP = 'r2://setnayan-media/events/E1/main-background/c.mp4';
const OWN_STILL = 'r2://setnayan-media/events/E1/main-background/c.jpg';
const TINT = { match: true, frame: ['#a0a0a0'] };
/* The masthead's own answer stays closed (`guestVideoRef: null`) — the Main
   background must not depend on it. */
const hero = { photoRef: HERO, videoRef: HERO_CLIP, guestVideoRef: null };
const closedGate = (ref: string) => sceneClipRefForGuests(ref, false);

/* ── 1 · ONE GATE FOR BOTH SOURCES ───────────────────────────────────────── */

test('1 · the hero clip the Main background follows reaches a guest through the gate, not the masthead switch', () => {
  const follow: HubMainGround = { follow: 'hero', of: HERO, tint: TINT };
  const open = resolveMainGround(follow, hero, mainGroundClipRefForGuests);
  assert.equal(open?.source, 'hero');
  assert.equal(open?.stillRef, HERO, 'the still is always there to paint first');
  assert.equal(open?.clipRef, HERO_CLIP, 'the host');
  assert.equal(open?.guestClipRef, HERO_CLIP, 'a guest sees the same clip the host sees');
  const closed = resolveMainGround(follow, hero, closedGate);
  assert.equal(closed?.guestClipRef, null, 'switch closed: the guest is back on the still');
  assert.equal(closed?.stillRef, HERO);
  assert.equal(closed?.clipRef, HERO_CLIP, 'the host keeps their own clip either way');
  // A hero with no clip has nothing to gate.
  assert.equal(resolveMainGround(follow, { ...hero, videoRef: null }, mainGroundClipRefForGuests)?.guestClipRef, null);
});

test('1 · the couple\'s OWN clip meets the very same gate', () => {
  const own: HubMainGround = { kind: 'snippet', media: OWN_CLIP, poster: OWN_STILL, tint: TINT };
  const open = resolveMainGround(own, hero, mainGroundClipRefForGuests);
  assert.equal(open?.guestClipRef, OWN_CLIP);
  assert.equal(open?.stillRef, OWN_STILL);
  assert.equal(resolveMainGround(own, hero, closedGate)?.guestClipRef, null);
});

/* ── 2 · THE KILL SWITCH IS ON IN CODE ───────────────────────────────────── */

test('2 · the scene-clip kill switch is ON, and the Main background gate follows it', () => {
  assert.equal(GUEST_SCENE_CLIP_PLAYBACK, true, 'owner 2026-09-29: "make it move"');
  assert.equal(mainGroundClipRefForGuests(OWN_CLIP), OWN_CLIP);
  assert.equal(mainGroundClipRefForGuests('  '), null, 'a blank ref is not a clip');
  // The masthead / editorial / realstories switch is a separate question and stays as it was.
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false);
});

/* ── 3 · THE PAGE ASKS THAT GATE ─────────────────────────────────────────── */

test('3 · mainGroundLayerFor resolves with the Main background gate and signs the guest\'s clip from it', () => {
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  // Resolved in the one shared module (2026-10-03), which the page asks.
  assert.match(layer, /guestMainGround\(theme, ownsPro, heroConfig, event\)/);
  assert.match(
    read('lib/guest-main-ground.ts'),
    /resolveMainGround\(hubMainGround\(heroConfig\), resolveHero\(event\), mainGroundClipRefForGuests\)/,
  );
  assert.doesNotMatch(layer, /heroVideoRefForGuests/, 'the Main background no longer asks the masthead switch');
  assert.match(layer, /sign\(viewerIsHost \? mainGround\.clipRef : mainGround\.guestClipRef\)/);
  const hubCanvas = read('lib/hub-canvas.ts');
  const body = hubCanvas.slice(hubCanvas.indexOf('export function resolveMainGround('));
  assert.doesNotMatch(body.slice(0, 2000), /guestVideoRef/, 'the hero source must not read the masthead\'s answer');
});

/* ── 4 · WHAT A GUEST'S PHONE DOES ───────────────────────────────────────── */

test('4 · the still paints first; the clip is muted, inline, looping, control-free and invisible until it moves', async () => {
  const { MainGround } = await import('../app/[slug]/_components/main-ground');
  const html = renderToStaticMarkup(
    React.createElement(MainGround, {
      still: 'https://x.test/still.jpg',
      clip: 'https://x.test/clip.mp4',
      adaptive: { tint: null, scrim: 0.3 } as never,
      vars: {},
    }),
  );
  const stillAt = html.indexOf('background-image:url(&quot;https://x.test/still.jpg&quot;)');
  const videoAt = html.indexOf('<video');
  assert.ok(stillAt > 0, 'the still is drawn');
  assert.ok(videoAt > stillAt, 'and drawn beneath the clip, so it shows whenever the clip does not');
  const video = /<video[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(video, /src="https:\/\/x\.test\/clip\.mp4"/);
  assert.match(video, /poster="https:\/\/x\.test\/still\.jpg"/);
  assert.match(video, /\bloop=""/);
  assert.match(video, /\bplaysinline=""/i, 'iOS plays it in place, never full screen');
  assert.match(video, /preload="metadata"/);
  assert.match(video, /style="opacity:0"/, 'invisible until its first frame moves');
  assert.match(video, /aria-hidden="true"/);
  assert.doesNotMatch(video, /\bcontrols\b/, 'no guest-side controls');
  assert.doesNotMatch(video, /\bautoplay\b/i, 'it starts from script, where reduced motion and Save-Data are asked first');

  const clip = read('app/[slug]/_components/scene-clip.tsx');
  assert.match(clip, /prefers-reduced-motion: reduce/);
  assert.match(clip, /connection\?\.saveData === true/, 'Save-Data keeps the still');
  assert.match(clip, /if \(reduce\?\.matches \|\| saveData \|\| typeof IntersectionObserver === 'undefined'\) \{\s*v\.pause\(\);\s*return;/);
  assert.match(clip, /new IntersectionObserver/, 'rests off-screen');
  assert.match(clip, /addEventListener\('visibilitychange', sync\)/, 'rests in a background tab');
  assert.match(clip, /onPlaying: \(\) => setMoving\(true\)/, 'revealed only once it is moving');
  // Muted is set as a property by React on the client; the loop must ask for it.
  assert.match(clip, /\bmuted\s+loop\s+playsInline\b/);
});
