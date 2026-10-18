/**
 * the-picture-is-an-effect.test.ts — LOOK RESTUDY ROW 8: THE EFFECTS BLOCK'S "THE PICTURE".
 *
 * Owner 2026-10-08 (DECISION_LOG "LOOK › BACKGROUND, AMENDED"; the approved amendment's Effects sheet, frames A07 ·
 * A08): *"Effects: Lantern / Parallax / etc"* · *"parallax is an effect also"*. Parallax ◆ (a switch) and Blur ▾ sit
 * in the Effects block beside the overlays, on EVERY source; with no picture both are shown OFF with the reason,
 * never hidden; Parallax reaches every picture — a scene, a video of ours, the couple's clip — on the shipped
 * page-scroll parallax. Held here: the pure writes, the sanitiser, the guest layer, the panel and the Apply rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { effectsSummary, pictureTakes, withBlur, withParallax, PICTURE_LINE } from './background-effect';
import { sanitizeHubMainGround, resolveMainGround, type HubMainGround } from './hub-canvas';
import { mainGroundChange } from './hub-draft';

// The components are compiled with the classic JSX runtime here — React must be in scope, as the sibling guards set it.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const E = 'app/dashboard/[eventId]/website/editor/_components';

const SCENE: HubMainGround = { kind: 'photo', media: '/std/backgrounds/aurora.webp' };
const CLIP: HubMainGround = { kind: 'snippet', media: 'r2://setnayan-media/events/e/main-background/c.mp4', poster: 'r2://setnayan-media/events/e/main-background/c.jpg' };
const LOOP: HubMainGround = { ground: 'loop', loop: 'whimsical' };
const COLOUR: HubMainGround = { ground: 'none' };

test('1 · Parallax and Blur write the main background, every other key kept — and are refused where there is no picture', () => {
  for (const m of [SCENE, CLIP, LOOP]) {
    assert.equal(pictureTakes(m), true, JSON.stringify(m));
    const on = withParallax({ ...m, effect: { kind: 'bokeh', intensity: 'subtle' } } as HubMainGround, true) as Record<string, unknown>;
    assert.equal(on.motion, 'parallax');
    assert.deepEqual(on.effect, { kind: 'bokeh', intensity: 'subtle' }, 'the effect on top was dropped');
    assert.equal('motion' in (withParallax(on as HubMainGround, false) as object), false, 'Parallax off left the key');
    assert.equal((withBlur(m, 'soft') as Record<string, unknown>).blur, 'soft');
    assert.equal('blur' in (withBlur(withBlur(m, 'strong'), 'none') as object), false, 'Blur None left the key');
  }
  for (const m of [COLOUR, { ground: 'pattern', pattern: 'dots' } as HubMainGround, { ground: 'theme' } as HubMainGround, null]) {
    assert.equal(pictureTakes(m), false);
    assert.equal(withParallax(m, true), m, 'a colour was given Parallax');
    assert.equal(withBlur(m, 'soft'), m, 'a colour was given Blur');
  }
  assert.equal(effectsSummary('Lanterns', { parallax: true, blur: 'soft' }), 'Lanterns · Parallax · Blur · Soft');
  assert.equal(effectsSummary(null, null), 'Off');
});

test('2 · the sanitiser keeps Parallax on every picture, and the guest resolver draws it', () => {
  for (const m of [SCENE, CLIP, LOOP]) {
    assert.equal((sanitizeHubMainGround({ ...m, motion: 'parallax' }) as Record<string, unknown> | null)?.motion, 'parallax', `Parallax dropped on ${JSON.stringify(m)}`);
  }
  assert.equal('motion' in (sanitizeHubMainGround({ ground: 'none', motion: 'parallax' }) as object), false, 'a colour stores Parallax');
  const clip = resolveMainGround(sanitizeHubMainGround({ ...CLIP, motion: 'parallax' }), { photoRef: null, videoRef: null }, () => null);
  assert.equal(clip?.parallax, true, 'a clip with Parallax is drawn still');
  // The page's layer: a video of ours carries it, and ONE wrapper moves the still AND the clip.
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(layer, /if \(loop && isHubMainLoop\(main\) && main\.motion === 'parallax'\) loop\.ground\.parallax = true;/, 'a video of ours never moves');
  const ground = read('app/[slug]/_components/main-ground.tsx');
  assert.match(ground, /<div className="absolute inset-0" \{\.\.\.\(parallax \? \{ 'data-pahina-parallax': 'page' \} : \{\}\)\}>/, 'the parallax wrapper is gone');
  assert.doesNotMatch(ground, /parallax && !clip/, 'a clip is kept out of the parallax again');
});

test('3 · Parallax on any picture is Pro to add at Apply', () => {
  assert.notEqual(mainGroundChange(LOOP, { ...LOOP, motion: 'parallax' } as HubMainGround), 'same', 'Parallax on a video of ours reads as no change');
  assert.notEqual(mainGroundChange(SCENE, { ...SCENE, motion: 'parallax' } as HubMainGround), 'same');
});

test('4 · the Effects block draws "The picture" on every source — off, with the reason, where there is no picture', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BgEffects } = await import(`../${E}/background-effects`);
  const noop = () => {};
  const paint = (takes: boolean) =>
    renderToStaticMarkup(
      React.createElement(BgEffects, {
        eventId: 'E1', effect: null, locked: true, swatch: '#fff', picture: null,
        onPick: noop, onChange: noop,
        ...{ treatment: { takes, parallax: takes, proMark: true, onParallax: noop, blur: takes ? 'soft' : 'none', onBlur: noop } },
      }),
    );
  const on = paint(true);
  assert.match(on, /The picture/);
  assert.match(on, /role="switch" aria-checked="true" aria-label="Parallax"/);
  assert.match(on, /data-studio-blur-pick/, 'Blur ▾ is not the one dropdown');
  assert.match(on, /Parallax · Blur · Soft/, 'the closed row does not say what is on');
  const off = paint(false);
  assert.match(off, /role="switch" aria-checked="false" aria-label="Parallax" data-bg-parallax="" disabled=""/, 'Parallax is hidden or live on a colour');
  assert.ok(off.includes(PICTURE_LINE.parallaxOff) && off.includes(PICTURE_LINE.blurOff), 'the reason is not said');
  // The panel hands it in, and no longer draws Motion or Blur rows of its own.
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /treatment=\{\{\s*takes: pictureTakes\(current\),/);
  const studio = panel.slice(panel.indexOf('if (studio) {'), panel.indexOf('<p className="text-[14px] font-semibold text-ink">Behind every scene</p>'));
  assert.doesNotMatch(studio, /<BgRow label="Motion"|<BgRow label="Blur"/, 'Motion or Blur is drawn twice');
});
