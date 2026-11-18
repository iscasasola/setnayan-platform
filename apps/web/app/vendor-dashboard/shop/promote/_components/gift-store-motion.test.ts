/**
 * 🛒 THE GIFT STORE'S MOTION — the Motion Standard 2026-11-18, and the "Added to your order" toast is SEEN.
 *
 * Measured on #7923 (OPUS REVIEW, 18 Nov): the store shipped two ad-hoc motions — a 1.4 s box-shadow animation (paint
 * every frame) and a 2.4 s toast — and its reduced-motion block set the toast to `opacity: 0`, so a supplier with
 * "reduce motion" on never saw that anything went into the order. This pins: transform + opacity only in the keyframes,
 * the standard's speeds, no `var()` in an animation's timing, the toast visible under reduced motion, and the section
 * taking the toast off the screen on a timer (so with no fade it still leaves).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = join(process.cwd(), 'app/vendor-dashboard/shop/promote/_components');
const css = readFileSync(join(here, 'gift-store.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const section = readFileSync(join(here, 'shop-gifts-section.tsx'), 'utf8');

test('keyframes move only transform and opacity', () => {
  const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]!);
  assert.ok(frames.length >= 2, 'expected the highlight and the toast keyframes');
  for (const f of frames) {
    const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]!);
    for (const p of props) assert.ok(p === 'opacity' || p === 'transform', `keyframe animates "${p}"`);
  }
});

test('every duration is a named speed (Tap 100/120 · Quick 200 · Release 280 · Move 320 · Rise 700)', () => {
  const durations = [...css.matchAll(/animation:\s*([^;]+);/g)].flatMap((m) => [...m[1]!.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)]);
  const allowedSpeeds = new Set([100, 120, 200, 280, 320, 700]);
  for (const d of durations) {
    const ms = d[2] === 's' ? Number(d[1]) * 1000 : Number(d[1]);
    // The toast's 2000 ms is a DELAY (how long it is read), not a speed — the only number allowed off the list.
    assert.ok(allowedSpeeds.has(ms) || ms === 2000, `off-standard time ${d[0]}`);
  }
  assert.doesNotMatch(css, /animation[^;]*var\(/, 'never var() in an animation timing');
});

test('under reduced motion the toast is still seen', () => {
  const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/.exec(css.trim())?.[1] ?? '';
  assert.ok(reduced.length > 0, 'a reduced-motion block exists');
  assert.doesNotMatch(reduced, /\.toast\s*\{[^}]*opacity\s*:\s*0/, 'the toast must not be hidden under reduced motion');
});

test('the section takes the toast off the screen on a timer', () => {
  assert.match(section, /setTimeout\(\(\) => setToast\(null\), GIFT_TOAST_MS\)/);
});
