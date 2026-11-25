/**
 * 🎭 THE TEN REVEALS SHARE ONE MOTION, AND EACH LOADS ONLY WHEN CHOSEN (owner 23 Nov 2026).
 *
 *   · No reveal has timing of its own: the scene stage and the veil read the lift, the tap, the swipe and the speed
 *     from `lib/reveal-motion.ts`; no scene file reads a clock or schedules a timer.
 *   · ONE tap opens it; the unveil runs inside the gesture (the page and the song start there); Scratch opens at 60 %.
 *   · ♿ Reduced motion: the closed reveal STILL, and a short cross-fade on the tap.
 *   · A reveal's engine loads only when it is the one chosen: three.js and the stage come through `next/dynamic`,
 *     each scene through its own `import()`, its art from `public/reveal/art/` at run time.
 *   · The gift box is the tenth reveal (owner 23 Nov, "ten reveals approved"): a scene of its own, still under reduced
 *     motion, its sparkle a slow wave, its ribbon never under the box.
 *
 * Sabotage check (run once by hand): give `scenes/bloom.ts` a `setTimeout` → the timing test goes red; import
 * `./scenes/doors` statically in `scene-reveal.tsx` → the loading test goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REVEAL_TEMPLATE_IDS } from '@/lib/reveal-config-pure';
import { stripComments } from '@/lib/strip-comments';
import { REVEAL_LIBRARY } from './reveal-templates';

const DIR = join(process.cwd(), 'app/[slug]/_components/reveal');
const read = (rel: string) => readFileSync(join(DIR, rel), 'utf8');
const strip = stripComments;
const SCENES = readdirSync(join(DIR, 'scenes')).filter((f) => f.endsWith('.ts'));
const STAGE = strip(read('scene-reveal.tsx'));
const VEIL = strip(read('veil-reveal.tsx'));
const OVERLAY = strip(read('reveal-overlay.tsx'));

test('the library is the nine reveals (the envelope in two styles), each with one instruction', () => {
  assert.deepEqual(
    REVEAL_LIBRARY.map((r) => r.id),
    [...REVEAL_TEMPLATE_IDS],
  );
  for (const r of REVEAL_LIBRARY) assert.ok(r.hint.length > 0 && r.hint.split(' ').length <= 6, `${r.id}: one short instruction`);
  assert.equal(REVEAL_LIBRARY.find((r) => r.id === 'veil-sheer')?.hint, 'Tap or swipe up to unveil', 'the veil keeps the owner’s words');
});

test('⏱ no reveal has timing of its own — the stage and the veil read the one rule set', () => {
  for (const f of SCENES) {
    const src = strip(read(`scenes/${f}`));
    assert.doesNotMatch(src, /setTimeout|setInterval|requestAnimationFrame|performance\.now|Date\.now/, `${f} keeps a clock of its own`);
    assert.doesNotMatch(src, /from '@\/lib\/reveal-motion';[\s\S]*\b(LIFT_K|DONE|SWIPE_MS|TAP_MS)\b\s*=/, `${f} redefines a shared rule`);
  }
  for (const [name, src] of [
    ['scene-reveal.tsx', STAGE],
    ['veil-reveal.tsx', VEIL],
  ] as const) {
    assert.match(src, /from '@\/lib\/reveal-motion'/, `${name} does not read the shared rules`);
    assert.match(src, /stepLift\(lift, (target|liftTarget)\)/, `${name}: the lift does not close by the shared step`);
    assert.match(src, /handsFreeTarget\(p\)/, `${name}: the hands-free curve is its own`);
    assert.match(src, /revealPlaysAt\(/, `${name}: the speed is not the couple’s 9 · 12 · 16, at the reveal’s own pace`);
    assert.match(src, /readGesture\(\{/, `${name}: the tap and swipe are read with numbers of its own`);
    assert.match(src, /REVEAL_MOTION\.DONE/, `${name}: "revealed" is its own threshold`);
    assert.doesNotMatch(src, /\b0\.985\b|lift \+= \(/, `${name}: a copy of a shared number is back`);
  }
});

test('👆 ONE tap opens it, and the unveil runs inside the gesture (the page and the song start there)', () => {
  const up = STAGE.slice(STAGE.indexOf('const onUp = '), STAGE.indexOf('const onCancel = '));
  assert.ok(up.length > 100, 'the stage’s pointerup moved — re-anchor this guard');
  assert.match(up, /gesture === 'tap'\) tapOpen\(nx, ny, true\)/);
  assert.match(up, /if \(gesture === 'open'\) \{\s*opened\(nx, ny, true(, [^;]+)?\);/);
  const opened = STAGE.slice(STAGE.indexOf('const opened = '), STAGE.indexOf('const tapOpen = '));
  assert.match(opened, /if \(gesture\) \{[\s\S]*?cb\.current\.onUnveil\?\.\(\)/, 'the unveil is not called inside the gesture');
  assert.match(STAGE, /const onDown = [\s\S]*?primeUnveilPress\(\);/, 'the press no longer primes the song (PR #7129)');
  assert.match(OVERLAY, /<SceneReveal[\s\S]*?onUnveil=\{\(\) => \{\s*unveilInGesture\(\);/, 'the overlay does not start the page and the song in the gesture');
  /* Scratch: no tap opens it; 60 % rubbed does. */
  const air = strip(read('scenes/air.ts'));
  assert.match(air, /noTap: true/);
  assert.match(air, /if \(pct >= SCRATCH_OPENS_AT\) c\.open\(0, 0\);/);
});

test('♿ reduced motion: no opening at all — the page is complete at once (16 Oct 2026 ruling, restored 23 Nov 2026)', () => {
  assert.match(OVERLAY, /!reducedMotion &&\s*!alreadySeen/, 'reduced motion no longer stands the opening down');
  assert.match(readFileSync(join(process.cwd(), 'lib/hub-veil.ts'), 'utf8'), /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\)return;/, 'the hold is written for a reduced-motion guest');
});

test('♿ the still face (the dashboard preview) — the closed reveal stands still, and the one tap cross-fades it away', () => {
  assert.match(OVERLAY, /if \(veil && !reducedMotion\)/, 'the live veil plays for a reduced-motion guest');
  assert.match(OVERLAY, /still=\{reducedMotion\}/);
  assert.match(STAGE, /if \(still\) return;\s*if \(autoplay\)/, 'a still reveal starts a loop');
  assert.match(STAGE, /fadeAway\(REVEAL_REDUCED_FADE_MS\)/);
});

test('📦 a reveal’s engine loads only when it is the one chosen', () => {
  assert.match(OVERLAY, /const SceneReveal = dynamic\(\(\) => import\('\.\/scene-reveal'\), \{ ssr: false \}\);/);
  assert.match(OVERLAY, /const VeilReveal = dynamic\(\(\) => import\('\.\/veil-reveal'\), \{ ssr: false \}\);/);
  assert.doesNotMatch(OVERLAY, /^import [^;]*from 'three'|from '\.\/scenes\//m, 'three.js or a scene rides the guest page’s first load');
  assert.doesNotMatch(STAGE, /^import [^;]*from '\.\/scenes\/(?!kit')/m, 'a scene is imported statically — every reveal would load with every other');
  for (const id of REVEAL_TEMPLATE_IDS) assert.match(STAGE, new RegExp(`'?${id}'?: \\(\\) => import\\('\\./scenes/`), `${id} has no scene of its own`);
  for (const f of SCENES) {
    for (const m of strip(read(`scenes/${f}`)).matchAll(/art\('([a-z]+)'\)/g)) {
      assert.ok(existsSync(join(process.cwd(), 'public/reveal/art', `${m[1]}.webp`)), `${f}: art ${m[1]} is missing`);
    }
  }
});

test('🎁 the gift box is the tenth reveal (owner 23 Nov, "ten reveals approved"; drawing v25 `gift3.js`)', () => {
  assert.ok(REVEAL_LIBRARY.some((r) => r.id === 'gift-box'), 'the gift box is not in the chooser');
  assert.match(STAGE, /'gift-box': \(\) => import\('\.\/scenes\/gift'\)/, 'the gift box has no scene of its own');
  const GIFT = strip(read('scenes/gift.ts'));
  /* ♿ reduced motion: everything holds still — no breeze, no travelling light */
  assert.match(GIFT, /air\.gust = RM \? 0 :/, 'the breeze blows under reduced motion');
  assert.match(GIFT, /if \(!RM\) spk\.position\.set/, 'the sheen light travels under reduced motion');
  /* ✨ the sparkle is a slow wave (5.6 s), never a strobe */
  assert.match(GIFT, /t \/ 5\.6/, 'the glints no longer come and go on the slow wave');
  /* 🎀 the ribbon never goes under the box: it collides with the lid and the base, drawn vertices included */
  assert.match(GIFT, /\{ x: LX, y: LY, z: ZT, z0: ZT - SK \},\s*\{ x: BX, y: BY, z: BZ \}/, 'the box is no longer solid to its ribbon');
  /* the card is a window onto the guest's own page */
  assert.match(GIFT, /blending: THREE\.NoBlending/, 'the card no longer shows the page through it');
});
