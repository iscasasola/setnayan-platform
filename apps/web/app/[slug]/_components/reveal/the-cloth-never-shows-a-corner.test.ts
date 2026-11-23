/**
 * 🖼🧵⏱ THE CLOTH NEVER SHOWS A CORNER, THE FABRIC GOES THE WAY IT IS PULLED, AND EACH REVEAL KEEPS ITS PACE
 * (owner 23 Nov 2026).
 *
 *   · *"let tha fabric be 10% larger than the screen so corners will not peek (all corners)"* · *"Veil and Curtains must
 *     exceed 10% beyond the corners so the corners doesnt peek"*: the live veil and every scene cloth (the veil's still
 *     face, the curtains, the fabric) are pinned above the top and hang below the bottom by more than a tenth of the
 *     screen, from ONE pair of numbers (`lib/veil-cloth.ts`), and reach past both sides by a fifth; closed, a hanging
 *     cloth's outer edges are held past the sides, so a hem that draws in never shows a bottom corner.
 *   · *"the upper part must not cut vertically. We want the illusion that it is larger than the screen"*: the classic
 *     envelope reaches 12 % past every edge (the stage frames in by its `bleed`).
 *   · *"Where they touch will drage the fabric from the center to that direction"*: a tap pulls the fabric from its
 *     centre toward the touch, a swipe any way pulls it along the swipe.
 *   · *"Veil curtain slower · Evelope doesnt get slow but should be at slowest"*: the envelopes always play at the slowest
 *     speed, the veil and the curtains one step slower than they are given (never slower than the envelopes), and the
 *     Maker offers only the paces a reveal really has, in the seconds it plays them.
 *
 * Sabotage check (run once by hand): put the veil's top pin back to `vh * 1.06` → red; make `revealPlaysAt` return the
 * speed it is given for the envelopes → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CLOTH_TOP, EDGE_HOLD, clothLength, holdEdges, pullWay } from '@/lib/veil-cloth';
import { REVEAL_SPEEDS, SLOWEST_REVEAL_SPEED, revealPlaysAt, revealSpeedChoices } from '@/lib/reveal-motion';
import { revealTuneKnobsFor } from '@/lib/std-reveal-effects';

const ROOT = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const R = 'app/[slug]/_components/reveal';
const VEIL = read(`${R}/veil-reveal.tsx`);
const DRAPE = read(`${R}/scenes/drape.ts`);
const STAGE = read(`${R}/scene-reveal.tsx`);

test('🖼 every cloth reaches more than 10 % past the top and the bottom, whatever its reach', () => {
  assert.ok(CLOTH_TOP >= 1.1, 'the cloth’s top pin shows the top corners');
  for (let reach = -20; reach <= 30; reach++) {
    const hem = CLOTH_TOP - clothLength(1, reach);
    assert.ok(hem <= -1.1, `a reach of ${reach} lets the bottom corners show (hem at ${hem.toFixed(3)})`);
  }
  assert.match(VEIL, /topPin = vh \* CLOTH_TOP;/, 'the live veil keeps a top pin of its own');
  assert.match(VEIL, /clothH = clothLength\(vh, cfgRef\.current\.reaches\);/, 'the live veil keeps a length of its own');
  assert.match(VEIL, /const pinW = 2 \* vw \* 1\.2;/, 'the live veil no longer reaches past the sides');
  assert.match(DRAPE, /this\.topPin = vh \* CLOTH_TOP;/, 'the scene cloth keeps a top pin of its own');
  assert.match(DRAPE, /this\.clothH = clothLength\(vh, cf\.reach\);/, 'the scene cloth keeps a length of its own');
  assert.match(DRAPE, /x0: side < 0 \? -vw \* 1\.2 : -lap,/, 'the left curtain shows the left corners');
  assert.match(DRAPE, /x1: side < 0 \? lap : vw \* 1\.2,/, 'the right curtain shows the right corners');
  assert.match(DRAPE, /x0: -c\.vw \* 1\.25, x1: c\.vw \* 1\.25, mode: 'slide'/, 'the fabric no longer reaches past the sides');
  /* a hanging cloth draws in toward its hem: closed, its outer edges are held past the sides */
  assert.ok(EDGE_HOLD >= 1.1, 'the held edges show the bottom corners');
  const px = new Float32Array([-2, 0, 2, -0.5, 0, 0.5]);
  holdEdges(px, 3, 2, 1, 1, true, true);
  assert.deepEqual([...px.slice(3)], [-EDGE_HOLD, 0, EDGE_HOLD].map((v) => Math.fround(v)), 'a hem that hangs in is not held out');
  assert.match(VEIL, /holdEdges\(px, cols, rows, vw, 1 - ss\(0, 0\.2, lift\), true, true\);/, 'the live veil’s hem shows the bottom corners');
  assert.match(DRAPE, /if \(!slide\) holdEdges\(px, cols, rows, vw, 1 - ss\(0, 0\.2, lift\), this\.side <= 0, this\.side >= 0\);/, 'the curtains’ hems show the bottom corners');
});

test('🖼 the classic envelope is larger than the screen: no edge of it ever shows', () => {
  const ENV = read(`${R}/scenes/envelope.ts`);
  const classic = ENV.slice(ENV.indexOf('export const envelopeClassic'), ENV.indexOf('export const envelopeGatefold'));
  assert.match(classic, /bleed: CLOTH_TOP,/, 'the classic envelope is cut at the screen’s edges again');
  assert.match(STAGE, /camera\.zoom = s\.bleed \?\? 1;/, 'the stage does not frame in by the bleed');
});

test('🧵 the fabric goes the way it is pulled: from its centre toward the touch, or along the swipe', () => {
  const at = (x: number, y: number) => pullWay(null, { x, y }, 1, 2);
  assert.deepEqual(at(0, 0), { x: 0, y: -1 }, 'a touch at the centre does not pull it down');
  assert.deepEqual(at(0.5, 0), { x: 1, y: 0 }, 'a touch right of centre does not pull it right');
  assert.deepEqual(at(0, 0.8), { x: 0, y: 1 }, 'a touch above the centre does not pull it up');
  assert.deepEqual(pullWay({ x: -1, y: 0 }, { x: 0.5, y: 0 }, 1, 2), { x: -1, y: 0 }, 'a swipe left is not followed');
  const fabric = DRAPE.slice(DRAPE.indexOf('export const fabric'));
  assert.match(fabric, /anyDir: true,/, 'the fabric opens only one way');
  assert.match(DRAPE, /const u = pullWay\(this\.pullDir, sp, vw, vh\);/, 'the hand walks one fixed way again');
  assert.match(STAGE, /opened\(nx, ny, true, sc\.anyDir && m > 0 \? \{ x: dx \/ m, y: -dy \/ m \} : undefined\)/, 'the swipe’s way never reaches the scene');
});

test('⏱ the envelopes play at the slowest, the veil and curtains one step slower, the rest as given', () => {
  for (const s of REVEAL_SPEEDS) {
    assert.equal(revealPlaysAt('envelope-classic', s), SLOWEST_REVEAL_SPEED);
    assert.equal(revealPlaysAt('envelope-gatefold', s), SLOWEST_REVEAL_SPEED);
    assert.equal(revealPlaysAt('fabric', s), s);
    for (const k of ['veil-sheer', 'beach-curtains']) {
      const p = revealPlaysAt(k, s);
      assert.ok(p <= SLOWEST_REVEAL_SPEED, `${k} plays slower than the envelopes`);
      assert.equal(p, REVEAL_SPEEDS[Math.min(REVEAL_SPEEDS.length - 1, REVEAL_SPEEDS.indexOf(s) + 1)]);
    }
  }
  assert.equal(revealPlaysAt('veil-sheer', undefined), 16, 'the house veil is not one step slower');
  assert.deepEqual(revealSpeedChoices('envelope-classic').map((o) => o.plays), [16]);
  assert.deepEqual(revealSpeedChoices('veil-sheer').map((o) => o.plays), [12, 16]);
  assert.deepEqual(revealSpeedChoices('fabric').map((o) => o.plays), [9, 12, 16]);
  assert.ok(!revealTuneKnobsFor('envelope-gatefold', { petals: false, butterflies: false }).some((k) => k.key === 'speed'), 'the envelopes offer a speed that changes nothing');
  assert.match(STAGE, /const speed = revealPlaysAt\(kind, cb\.current\.speedSec\);/, 'the scene stage decides its own seconds');
  assert.match(VEIL, /const autoDur = revealPlaysAt\('veil-sheer', cfgRef\.current\.speed\);/, 'the veil decides its own seconds');
  assert.doesNotMatch(STAGE + VEIL, /snapRevealSpeed\(/, 'an engine reads the speed past the reveal’s pace');
  const maker = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  assert.match(maker, /label: `\$\{o\.plays\} s`/, 'the Maker names a speed the reveal does not play');
  assert.doesNotMatch(maker, /REVEAL_SPEEDS\.map/, 'the Maker offers every speed whatever the reveal plays');
});
