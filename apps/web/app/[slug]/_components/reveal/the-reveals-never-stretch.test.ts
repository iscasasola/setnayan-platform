/**
 * 🔏🖥 THE COUPLE'S SEAL, AND NO REVEAL STRETCHES (owner 23 Nov 2026).
 *
 *   · *"envelope classic Seal needs to adapt to logo"* · *"envelope gatefold use wax seal logo as well"*: both envelopes
 *     press the couple's own seal — their minted recipe (pour, press, finish, wax), else a pour seeded from the event —
 *     and the logo is cropped to its own ink and fitted to the face at its own proportions.
 *   · *"do not stretch logo on desktop"* · *"keep it proportion"* · *"all reveal do not stretch. create more fabric,
 *     create more smoke, extend it"*: a wide screen gets MORE of each reveal's material at the drawing's size, never
 *     the phone's art pulled wider. `wideness()` is the one measure; `lay()` the one way to cover a wider canvas.
 *
 * Sabotage check (run once by hand): make the fabric's canvas `const cw = 512` in `scenes/drape.ts` → red;
 * give `makeSeal` a fixed colour → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PHONE_ASPECT, wideness } from './scenes/kit';

const DIR = join(process.cwd(), 'app/[slug]/_components/reveal');
const read = (rel: string) => stripComments(readFileSync(join(DIR, rel), 'utf8'));
const KIT = read('scenes/kit.ts');
const ENV = read('scenes/envelope.ts');
const STAGE = read('scene-reveal.tsx');
const OVERLAY = read('reveal-overlay.tsx');

test('🖥 wideness: 1 on the drawing’s phone (and anything narrower), the number of phone-widths beyond it', () => {
  assert.equal(wideness({ w: 300, h: 520 }), 1);
  assert.equal(wideness({ w: 375, h: 740 }), 1);
  assert.ok(Math.abs(wideness({ w: 1280, h: 800 }) - 1.6 / PHONE_ASPECT) < 1e-9);
  assert.equal(wideness({ w: 100, h: 0 }), 1, 'an unmeasured screen is a phone');
});

test('🔏 the logo is cropped to its own ink and fitted at its own proportions — on every reveal, every screen', () => {
  assert.match(KIT, /buildMarkCanvas\(markSvg/, 'the logo is read through the seal maker’s die (raster logos too)');
  assert.match(KIT, /const box = alphaBox\(die\)/, 'the logo mask is not cropped to its ink');
  assert.match(KIT, /Math\.max\(box\.w, box\.h\)/, 'the logo is not fitted by its longer side');
  assert.match(ENV, /const box = alphaBox\(logo\)/, 'the seal does not fit the logo to its face');
  assert.match(ENV, /Math\.hypot\(box\.w, box\.h\)/, 'the seal’s logo is not fitted inside the ring by its corners');
  assert.doesNotMatch(ENV, /drawImage\(logo, 58, 58, 140, 140\)/, 'the logo is squeezed into a fixed square again');
});

test('🔏 both envelopes press the couple’s seal: their recipe, their wax when minted, else the drawing’s gold', () => {
  assert.match(ENV, /const \{ recipe, color \} = c\.seal;/);
  assert.match(ENV, /recipe\.pour\.amount/, 'the seal’s size is not their pour');
  assert.match(ENV, /recipe\.pour\.irregularity/, 'the seal’s outline is not their pour');
  assert.match(ENV, /recipe\.press\.depth/, 'the seal’s depth is not their press');
  assert.match(ENV, /color \? new THREE\.Color\(color\)\.convertSRGBToLinear\(\) : 0xb98a2c/, 'the wax colour does not follow the minted seal');
  assert.match(ENV, /seal = makeSeal\(c, 0\.5, false\)/, 'the classic envelope lost its seal');
  assert.match(ENV, /seal = makeSeal\(c, 0\.4, true\)/, 'the gatefold has no seal');
  assert.match(ENV, /function placeSeal\(\)/, 'the gatefold’s seal does not ride its panel');
  /* the seal never breaks (owner 23 Nov): every piece of the gatefold's seal takes the one panel's transform */
  const place = ENV.slice(ENV.indexOf('function placeSeal()'));
  assert.match(place, /const tp = flaps\[0\]\?\.tip;/, 'the gatefold’s seal does not follow the first panel');
  assert.match(place, /for \(const half of seal\) \{/, 'the gatefold’s seal pieces move apart');
  assert.doesNotMatch(place, /\[right, left\] = seal/, 'the gatefold’s seal breaks in two again');
  assert.match(STAGE, /sealConfig\s*\?\s*\{ recipe: cb\.current\.sealConfig/, 'the stage does not pass the minted seal');
  assert.match(STAGE, /defaultConfigFromSeed\(cb\.current\.sealFallbackSeed/, 'an unminted event has no seal of its own');
  assert.match(OVERLAY, /sealConfig=\{sealConfig\}/, 'the guest page does not hand the seal to the reveal');
});

test('🖥 no reveal stretches its art: each lays more of it, or counts more of it, on a wide screen', () => {
  const uses: Array<[string, RegExp, string]> = [
    ['scenes/envelope.ts', /lay\(x, paper,/, 'the envelope paper is stretched'],
    ['scenes/envelope.ts', /lay\(x, dam,/, 'the damask is stretched'],
    ['scenes/envelope.ts', /lay\(x, calla,/, 'the calla relief is stretched'],
    ['scenes/envelope.ts', /Math\.round\(3 \* wide\)/, 'the scallops are pulled wider'],
    ['scenes/drape.ts', /const cw = Math\.round\(512 \* wide\)/, 'the satin’s weave is stretched'],
    ['scenes/drape.ts', /cf\.folds \* wide/, 'the folds are pulled wider'],
    ['scenes/drape.ts', /\(o\.cols \?\? 66\) \* Math\.min\(o\.wideMax \?\? 3, wide\)/, 'the cloth has no more threads on a wide screen'],
    ['scenes/air.ts', /Math\.round\(\(ny \* c\.W\) \/ c\.H\)/, 'the smoke’s cells are not square'],
    ['scenes/air.ts', /lay\(fx, foil,/, 'the scratch foil is stretched'],
    ['scenes/bloom.ts', /N = Math\.round\(1500 \* Math\.min\(4, wideness/, 'the petals thin out on a wide screen'],
    ['scenes/bloom.ts', /MW = Math\.round\(MH \* \(c\.W \/ c\.H\)\)/, 'the night sky is stretched'],
  ];
  for (const [f, re, why] of uses) assert.match(read(f), re, `${f}: ${why}`);
  for (const f of ['scenes/envelope.ts', 'scenes/drape.ts', 'scenes/air.ts']) {
    assert.doesNotMatch(read(f), /drawImage\((paper|dam|calla|satin|foil), [^)]*\b(cw|face\.width|512), (ch|face\.height|888)\)/, `${f}: an art file is drawn to the canvas’s size`);
  }
});
