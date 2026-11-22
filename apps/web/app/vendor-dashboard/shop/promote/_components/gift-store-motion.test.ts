/**
 * 🛒 THE GIFT STORE'S MOTION — the Motion Standard 2026-11-18, and the "Added to your order" toast is SEEN.
 *
 * Measured on #7923 (OPUS REVIEW, 18 Nov): the store shipped two ad-hoc motions — a 1.4 s box-shadow animation (paint
 * every frame) and a 2.4 s toast — and its reduced-motion block set the toast to `opacity: 0`, so a supplier with
 * "reduce motion" on never saw that anything went into the order. This pins: transform + opacity only in the keyframes,
 * the standard's speed and curve tokens, no `var()` inside a keyframe, the toast visible under reduced motion, and the section
 * taking the toast off the screen on a timer (so with no fade it still leaves).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const here = join(process.cwd(), 'app/vendor-dashboard/shop/promote/_components');
const css = stripComments(readFileSync(join(here, 'gift-store.module.css'), 'utf8'));
const section = readFileSync(join(here, 'shop-gifts-section.tsx'), 'utf8');

test('keyframes move only transform and opacity', () => {
  const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]!);
  assert.ok(frames.length >= 2, 'expected the highlight and the toast keyframes');
  for (const f of frames) {
    const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]!);
    for (const p of props) assert.ok(p === 'opacity' || p === 'transform', `keyframe animates "${p}"`);
  }
});

test('every speed and curve is a Motion Standard token, never a typed number', () => {
  const anims = [...css.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1]!).filter((v) => v.trim() !== 'none');
  assert.ok(anims.length >= 2, 'expected the highlight and the toast animations');
  for (const a of anims) {
    for (const part of a.split(',')) {
      // name · speed token · curve token · [the toast's read wait] · fill
      assert.match(
        part.trim(),
        /^[\w-]+ var\(--sn-m-(?:tap|quick|release|move|rise)\) var\(--sn-m-(?:settle|spring)\)(?: var\(--gift-toast-read\))? (?:backwards|forwards|both)$/,
        `off-standard animation "${part.trim()}"`,
      );
    }
  }
  assert.doesNotMatch(css, /cubic-bezier\(/, 'a curve is a token, never typed');
  // The toast's read time is a DELAY (a wait), not a speed — the only number allowed, and it is named.
  assert.match(css, /--gift-toast-read:\s*2000ms;/);
});

test('never var() inside a @keyframes block (Chrome runs it linear — § 3.7)', () => {
  const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]!);
  for (const f of frames) assert.doesNotMatch(f, /var\(/);
});

test('under reduced motion the toast is still seen', () => {
  const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/.exec(css.trim())?.[1] ?? '';
  assert.ok(reduced.length > 0, 'a reduced-motion block exists');
  assert.doesNotMatch(reduced, /\.toast\s*\{[^}]*opacity\s*:\s*0/, 'the toast must not be hidden under reduced motion');
});

test('the section takes the toast off the screen on a timer', () => {
  assert.match(section, /setTimeout\(\(\) => setToast\(null\), GIFT_TOAST_MS\)/);
});
