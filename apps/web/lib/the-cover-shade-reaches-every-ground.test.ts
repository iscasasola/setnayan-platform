/**
 * 🌗 THE COVER SCENE'S Darker ↔ Lighter REACHES THE GROUND — every ground kind, the video included, on the canvas
 * while the thumb moves and on the guest page after Apply.
 *
 * Owner 2026-10-17, on cale-ice (the cover playing his sunset clip): *"darker lighter not showing"* — he moved the bar
 * well toward Lighter and the cover looked the same. MEASURED (two causes, both fixed here):
 *   · the legibility scrim CANCELLED the veil — it was the weakest scrim holding AA over the VEILED ground, so as
 *     Lighter's white veil grew the paper scrim shrank by exactly as much (0.50 → 0.01) and the cover's colours were the
 *     same, byte for byte, from 0 to +60 (Darker the same from −30 to −60): a bar that moved and a page that did not;
 *   · the canvas showed nothing while the thumb moved (`onMove: () => {}`) — the approved prototype repaints on every
 *     `input`; the Maker waited for the release, the save and a redraw.
 *
 *   (1) every ground that takes a shade is drawn darker at −60 and lighter at +60 than at the centre — as a guest
 *       sees it (the veil AND the scrim the page lays, composited over the ground's own samples)
 *   (2) the shade lies OVER the picture — after the still and after the clip — so a video, a stranger's still, reduced
 *       motion and Save-Data all wear the same shade; a glass takes none
 *   (3) the canvas follows the thumb with the PAGE'S OWN look (`coverShadeLook` is exactly what `coverSceneLayer`
 *       draws at that position), laid over every child of the ground by the bridge, and taken off by the redraw
 *   (4) the words still hold AA at every position
 *
 * Each claim was broken once and seen red (the sabotage run is in the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COVER_INK, COVER_PAPER, coverGroundSamples, coverShadeLook } from './cover-scene';
import { hubMovingBackgroundIds, type HubCoverGround } from './hub-canvas';
import { compositeOver, contrastRatio, relativeLuminance } from './hub-legibility';
import { stripComments } from './strip-comments';
import { COVER_SHADE_PREVIEW_ATTR, coverShadePreviewCss, sanitizeCoverShadePreview } from '../app/[slug]/_components/cover-shade-preview';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const LOOP = hubMovingBackgroundIds()[0]!;
/* Every ground the bar reaches (`sanitizeHubCoverGround`: all but a glass). Addresses are passthrough URLs, so the
   page's own resolver hands them back as they are. */
const GROUNDS: ReadonlyArray<[string, HubCoverGround]> = [
  ['clip (cale-ice’s sunset)', { kind: 'snippet', media: 'https://media.test/sunset.mp4', poster: 'https://media.test/still.jpg' }],
  ['photo', { kind: 'photo', media: 'https://media.test/photo.jpg' }],
  ['Scene ◆ loop', { kind: 'loop', loop: LOOP } as HubCoverGround],
  ['Plain', { kind: 'color', color: '#8A6F5A' }],
  ['Diagonal', { kind: 'diagonal', color: '#5B7A8C' }],
  ['Glow', { kind: 'glow', color: '#A9834B' }],
];
const at = (g: HubCoverGround, shade: number): HubCoverGround => {
  const { shade: _was, ...rest } = g;
  return (shade === 0 ? rest : { ...rest, shade }) as HubCoverGround;
};

async function layerOf(g: HubCoverGround) {
  const { coverSceneLayer } = await import('../app/[slug]/_lib/cover-scene-layer');
  const layer = coverSceneLayer(g, { heroPhotoUrl: 'https://media.test/photo.jpg', loopMedia: () => ({ still: '/std/backgrounds/ballroom.webp', clip: '/realstories/jack-jill-cebu.mp4' }) });
  assert.ok(layer, 'the cover drew nothing for a ground it should draw');
  return layer!;
}

/** What a guest sees of the ground at one sample: the veil, then the scrim, laid over it — the page's own order. */
function seen(sample: string, layer: { veil: { color: string; opacity: number } | null; scrim: { color: string; opacity: number } }): string {
  const veiled = layer.veil ? compositeOver(layer.veil.color, layer.veil.opacity, sample) : sample;
  return layer.scrim.opacity > 0 ? compositeOver(layer.scrim.color, layer.scrim.opacity, veiled) : veiled;
}
const meanLum = (colours: readonly string[]) => colours.reduce((s, c) => s + relativeLuminance(c), 0) / colours.length;

test('(1) every ground is drawn darker at −60 and lighter at +60 than at the centre, as a guest sees it', async () => {
  for (const [name, g] of GROUNDS) {
    const own = coverGroundSamples(at(g, 0));
    const lum: Record<number, number> = {};
    for (const s of [-60, -30, 0, 30, 60]) lum[s] = meanLum(own.map((c) => seen(c, layerSync(g, s))));
    assert.ok(lum[60]! - lum[0]! > 0.04, `${name}: Lighter +60 barely changes the cover (${lum[0]!.toFixed(3)} → ${lum[60]!.toFixed(3)}) — the scrim cancels the veil`);
    assert.ok(lum[30]! - lum[0]! > 0.015, `${name}: Lighter +30 does not show (${lum[0]!.toFixed(3)} → ${lum[30]!.toFixed(3)})`);
    assert.ok(lum[0]! - lum[-60]! > 0.04, `${name}: Darker −60 barely changes the cover (${lum[0]!.toFixed(3)} → ${lum[-60]!.toFixed(3)})`);
    /* …and every step on one side moves it the same way (never back). */
    assert.ok(lum[-60]! <= lum[-30]! + 1e-9 && lum[30]! <= lum[60]! + 1e-9, `${name}: the bar does not move the cover in one direction (${JSON.stringify(lum)})`);
    /* The layer the guest page draws is the look the Maker shows (3) — checked on every ground here too. */
    for (const s of [-60, 30, 60]) {
      const layer = await layerOf(at(g, s));
      const look = coverShadeLook(g, s);
      assert.deepEqual({ veil: layer.veil, scrim: layer.scrim, tone: layer.tone }, look, `${name} at ${s}: the canvas preview is not what the page draws`);
    }
  }
});

/** The page's own veil/scrim at a position, with no I/O — `coverShadeLook` is proven equal to the layer in (1). */
function layerSync(g: HubCoverGround, s: number) {
  return coverShadeLook(g, s);
}

test('(2) the shade lies OVER the picture — after its still and its clip — and a glass takes none', async () => {
  const { CoverSceneGround } = await import('../app/[slug]/_components/cover-scene-ground');
  for (const [name, g] of GROUNDS) {
    for (const s of [-60, 60]) {
      const layer = await layerOf(at(g, s));
      assert.ok(layer.veil && layer.veil.opacity > 0, `${name} at ${s}: no veil is laid`);
      const html = renderToStaticMarkup(React.createElement(CoverSceneGround, { layer }));
      const shadeAt = html.indexOf('data-cover-scene-shade');
      assert.ok(shadeAt > 0, `${name} at ${s}: the shade is not drawn on the cover`);
      for (const [what, re] of [['clip', /<video\b/g], ['still', /background-image:url\(/g]] as const) {
        for (const m of html.matchAll(re)) assert.ok(m.index! < shadeAt, `${name} at ${s}: the ${what} is drawn ABOVE the shade — it would not be shaded`);
      }
      /* Nothing above the shade but the scrim, in the same box: no stacking of its own lifts the picture over it. */
      assert.doesNotMatch(html, /<video[^>]*class="[^"]*\bz-\d/, `${name}: the clip carries a z-index that can lift it over the shade`);
    }
  }
  /* A clip that cannot play (reduced motion · Save-Data · a closed switch · a stranger) leaves its still — under the same veil. */
  const clipLayer = await layerOf(at(GROUNDS[0]![1], 60));
  const stillOnly = renderToStaticMarkup(React.createElement(CoverSceneGround, { layer: { ...clipLayer, clip: null } }));
  assert.ok(stillOnly.indexOf('background-image:url(') < stillOnly.indexOf('data-cover-scene-shade'), 'the clip’s still is not under the shade');
  /* A glass is a pane, not a picture: it takes no veil. */
  assert.equal((await layerOf({ kind: 'glass', color: '#FFFFFF', opacity: 80, shade: 60 } as HubCoverGround)).veil, null, 'a glass took a shade');
});

test('(3) the canvas follows the thumb: the look is laid over every child of the ground and taken off by the redraw', () => {
  const look = coverShadeLook(GROUNDS[0]![1], 60);
  const message = sanitizeCoverShadePreview({ source: 'setnayan-editor', t: 'coverShade', ...look });
  assert.ok(message && message !== 'off', 'the bridge refuses the Maker’s own shade message');
  const css = coverShadePreviewCss(message);
  /* Painted by the ground box's ::after — after every child, so OVER the clip and its still. */
  assert.match(css, /\[data-cover-scene-ground\]>div::after\{content:"";position:absolute;inset:0;[^}]*background-image:linear-gradient\(rgba\(/, 'the preview is not laid over the ground’s children');
  assert.match(css, /\[data-cover-scene-shade\][^{]*\[data-cover-scene-scrim\]\{display:none!important\}/, 'the drawn shade is not stepped aside — two shades would stack');
  /* Nothing from a message becomes CSS unchecked. */
  assert.equal(sanitizeCoverShadePreview({ veil: { color: 'red;}body{x', opacity: 0.4 }, scrim: { color: '#FFFFFF', opacity: 0.2 }, tone: 'ink' }), null);
  assert.equal(sanitizeCoverShadePreview({ veil: null, scrim: { color: '#FFFFFF', opacity: 7 }, tone: 'ink' }), null);
  assert.equal(sanitizeCoverShadePreview({ off: true }), 'off');
  /* The wiring: the rows post on every move; the bridge lays it, and takes it off in the redraw's commit. */
  const rows = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx'), 'utf8'));
  assert.match(rows, /onMove: \(n\) => showCoverShade\(coverShadeLook\(ground!, n\)\)/, 'the cover’s bar paints nothing while the thumb moves');
  const bridge = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/editor-bridge.tsx'), 'utf8'));
  assert.match(bridge, /data\.t === 'coverShade'[\s\S]{0,300}applyCoverShadePreview\(document, look\)/, 'the bridge does not lay the cover’s shade');
  assert.match(bridge, /const undoLaidPreviews = \(\) => \{[\s\S]{0,400}undoCoverShadePreview\(document\)/, 'the redraw does not take the laid shade off — two shades would show');
  assert.ok(COVER_SHADE_PREVIEW_ATTR.length > 0);
});

test('(4) the words still hold AA at every position of the bar, on every ground', () => {
  for (const [name, g] of GROUNDS) {
    for (let s = -100; s <= 100; s += 10) {
      const look = coverShadeLook(g, s);
      const ink = look.tone === 'ink' ? COVER_INK : COVER_PAPER;
      for (const sample of coverGroundSamples(at(g, 0))) {
        const c = contrastRatio(ink, seen(sample, look));
        assert.ok(c >= 4.5 - 1e-6, `${name} at ${s}: the words fall to ${c.toFixed(2)}:1 over ${sample}`);
      }
    }
  }
});
