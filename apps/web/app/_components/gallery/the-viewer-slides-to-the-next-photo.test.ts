/**
 * 🔒 THE SHARED PHOTO VIEWER SLIDES TO THE NEXT PHOTO (ruling 5951; owner 9 Nov, approved Portfolio v3: *"animate the
 * shift to next photo"*). `gallery-lightbox.tsx`'s `screen` layout — every `PhotoViewer` (Memories, Portfolio) — used
 * to SNAP: a release past 60 px called `onNext` and the next photo replaced the one under the finger.
 *
 *   1 · a release past the line SLIDES (`slideTo`), a short drag springs back, and ‹ › slide too — none calls the
 *       caller's move directly any more in the screen layout;
 *   2 · the caller's move runs when the photo has LEFT (`transitionend`, phase `out`), and the next lands from the far
 *       side (`pre` → `in`) — 280 ms ease-out;
 *   3 · reduced motion = a crossfade: opacity only, no travel;
 *   4 · ← → do the same, but never while a panel is up or a field has the keys;
 *   5 · no timer anywhere (a photo never moves on a clock — `lib/photos-never-move-by-themselves.test.ts`).
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-12): `onClick={() => slideTo(1)}` → `onClick={onNext}` (red: 1);
 *   `onTransitionEnd={onSlideEnd}` dropped (red: 2); `screen.panel ||` dropped from the key handler (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SLIDE_FADE_MS, SLIDE_MS } from './gallery-lightbox';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'gallery-lightbox.tsx'), 'utf8'));
const SCREEN = SRC.slice(SRC.indexOf('if (screen) {'), SRC.indexOf('return createPortal(\n    <div\n      data-photo-viewer=""'));

test('1 · a release, ‹ and › slide; a short drag springs back', () => {
  assert.ok(SCREEN.length > 500, 'the screen layout moved — re-anchor this guard');
  assert.match(SRC, /else if \(screen && dragX < -60 && onNext\) slideTo\(1\);/, 'a release past the line does not slide to the next');
  assert.match(SRC, /else if \(screen && dragX > 60 && onPrev\) slideTo\(-1\);/, 'a release past the line does not slide to the previous');
  assert.match(SRC, /else if \(screen && dragX !== 0\) springBack\(\);/, 'a short drag no longer springs back');
  assert.match(SCREEN, /onClick=\{\(\) => slideTo\(-1\)\} aria-label="Previous photo"/, '‹ snaps again');
  assert.match(SCREEN, /onClick=\{\(\) => slideTo\(1\)\} aria-label="Next photo"/, '› snaps again');
});

test('2 · the move runs once the photo has left; the next lands from the far side', () => {
  assert.match(SCREEN, /onTransitionEnd=\{onSlideEnd\}/, 'the slide is not driven by transitionend');
  assert.match(SRC, /if \(slide\.phase === 'out'\) \{[\s\S]{0,200}\(slide\.dir > 0 \? onNext : onPrev\)\?\.\(\);/, 'the caller is not moved when the photo has left');
  assert.match(SRC, /phase: 'pre', dir \} : \{ x: dir \* width\(\), ms: 0/, 'the next photo does not wait beyond the far edge');
  assert.match(SRC, /transform \$\{slide\.ms\}ms cubic-bezier\(\.2,\.8,\.2,1\)/, 'the slide lost its ease-out');
  assert.equal(SLIDE_MS, 280);
});

test('3 · reduced motion is a crossfade, never travel', () => {
  assert.match(SRC, /prefers-reduced-motion: reduce/);
  assert.match(SRC, /reduced\(\) \? \{ x: 0, ms: SLIDE_FADE_MS, fade: true, phase: 'out', dir \}/, 'reduced motion travels');
  assert.match(SCREEN, /opacity: slide\.fade \? 0 : 1/);
  assert.ok(SLIDE_FADE_MS > 0 && SLIDE_FADE_MS < SLIDE_MS);
});

test('4 · ← → slide too, never while a panel is up or a field is typing', () => {
  assert.match(SRC, /if \(screen\.panel \|\| \(t && \(t\.tagName === 'INPUT' \|\| t\.tagName === 'TEXTAREA'/, 'arrow keys move the photo under a panel or a field');
  assert.match(SRC, /e\.key === 'ArrowRight' && onNext\) slideTo\(1\)/);
});

test('5 · no timer moves a photo', () => {
  assert.doesNotMatch(SRC, /\bset(Timeout|Interval)\s*\(/, 'the viewer moves on a clock again');
});
