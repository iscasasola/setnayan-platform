/**
 * the-veil-stays-with-the-cover.test.ts — owner 2026-10-17, verbatim, on live `/cale-ice` after an unveil (cover words
 * over the sunset video, no veil anywhere): *"the veil disappears. it shouldn't. it should stay until cover is gone.
 * and return when cover scene returns"*.
 *
 * THE PROPERTY: after an unveil, the drape is present whenever the cover is on screen, absent whenever it is not, and
 * the veil never closes again in the visit.
 *
 *   1. The rule itself (`lib/reveal-stages.ts`) is EXECUTED over a sweep of cover positions — every scroll offset of a
 *      cover from fully below the screen to fully above it, for covers shorter and taller than the screen — and over
 *      a scrolled-away-and-back visit: the drape's presence equals "some of the cover is on screen", every time.
 *   2. The wiring is source-level (comment-stripped — the comments quote the retired code): the veil needs WebGL and a
 *      rAF loop, and there is no harness in this repo that drives it (as `the-veil-opens-on-a-tap.test.ts` says). The
 *      Playwright walk in the PR body is the in-browser half.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { COVER_SCENE_ATTR } from '@/lib/cover-scene';
import { COVER_SCENE_SELECTOR, coverOnScreen, drapeShift, drapeShows } from '@/lib/reveal-stages';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = stripComments(readFileSync(join(HERE, 'reveal-overlay.tsx'), 'utf8'));
const VEIL = stripComments(readFileSync(join(HERE, 'veil-reveal.tsx'), 'utf8'));

/** A cover of `height` px whose top sits at `top` on a `vh`-tall screen. */
const box = (top: number, height: number) => ({ top, bottom: top + height });
const intersects = (b: { top: number; bottom: number }, vh: number) => b.bottom > 0 && b.top < vh;

test('🎭 the drape is present exactly while some of the cover is on screen — every position, every cover height', () => {
  let checked = 0;
  for (const vh of [667, 812, 844, 720]) {
    for (const height of [vh, Math.round(vh * 0.6), Math.round(vh * 1.7)]) {
      for (let top = -height - 40; top <= vh + 40; top += 7) {
        const b = box(top, height);
        const inView = coverOnScreen(b, vh);
        assert.equal(inView, intersects(b, vh), `cover ${height}px at top ${top} on a ${vh}px screen`);
        // After the unveil the drape follows the cover…
        assert.equal(drapeShows({ unveiled: true, coverInView: inView }), intersects(b, vh));
        // …before it there is no drape (the closed veil is the whole opening, not a drape).
        assert.equal(drapeShows({ unveiled: false, coverInView: inView }), false);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 1000, `the sweep ran ${checked} positions — it must not be vacuous`);
  // The bars' own edge: the bottom passing the top of the screen IS gone (`cover-scene-menu.tsx`, `bottom<=0`).
  assert.equal(coverOnScreen(box(-800, 800), 800), false, 'a cover whose bottom is AT the top edge is gone');
  assert.equal(coverOnScreen(box(-799, 800), 800), true, 'one pixel of cover keeps the drape');
  assert.equal(coverOnScreen(null, 800), false, 'a cover that is not drawn (another tab) has no drape');
});

test('🎭 the drape leaves WITH the cover and comes back with it — a scroll down and back up, frame by frame', () => {
  const vh = 812;
  const height = vh;
  const path = [0, 40, 200, 500, 811, 812, 900, 2400, 900, 812, 811, 300, 0];
  const seen: boolean[] = [];
  for (const scrollY of path) {
    const b = box(-scrollY, height);
    const show = drapeShows({ unveiled: true, coverInView: coverOnScreen(b, vh) });
    seen.push(show);
    if (show) {
      // It rides the cover's top edge: scrolled 200 px → drawn 200 px higher, never lower than its place.
      assert.equal(drapeShift(b.top), -scrollY);
    }
  }
  assert.deepEqual(seen, [true, true, true, true, true, false, false, false, false, false, true, true, true]);
  assert.equal(drapeShift(120), 0, 'a cover starting lower never pushes the drape down');
  assert.equal(drapeShift(Number.NaN), 0);
});

test('🎭 the overlay finds the cover by the cover’s own attribute — the copy kept as text has not drifted', () => {
  assert.equal(COVER_SCENE_SELECTOR, `header[${COVER_SCENE_ATTR}]`);
  assert.match(OVERLAY, /document\.querySelector<HTMLElement>\(COVER_SCENE_SELECTOR\)/, 'the overlay no longer looks for the Cover Scene');
});

test('🎭 the overlay draws the drape from the rule, watches the cover, and pauses the cloth off screen', () => {
  // Drape mode begins at the unveil gesture, off the Save the Date only, never in the Maker's ▶ preview.
  assert.match(OVERLAY, /const unveiled = lifting \|\| open;/);
  assert.match(OVERLAY, /const drapeMode = firstPageOnly && unveiled && !preview;/);
  // ONE IntersectionObserver on the cover, and the scroll for the ride.
  assert.match(OVERLAY, /new IntersectionObserver\(schedule, \{ threshold: 0 \}\)/, 'the cover is not observed');
  assert.match(OVERLAY, /const inView = coverOnScreen\(box, window\.innerHeight\);\s*setCoverInView\(inView\);/);
  assert.match(OVERLAY, /translate3d\(0, \$\{drapeShift\(box\.top\)\}px, 0\)/, 'the drape no longer rides the cover out');
  // Hidden and PAUSED while away — the same expression for both.
  const hidden = /drapeMode && !drapeShows\(\{ unveiled, coverInView \}\) \? 'invisible'/.test(OVERLAY);
  assert.ok(hidden, 'the drape is not hidden when the cover is gone');
  assert.match(OVERLAY, /paused=\{drapeMode && !drapeShows\(\{ unveiled, coverInView \}\)\}/, 'the cloth keeps rendering off screen');
  assert.match(OVERLAY, /keepsOpen=\{firstPageOnly && !preview\}/, 'the hub veil can be closed again');
});

test('🎭 once unveiled it is never retired and never closed again in the visit', () => {
  // Nothing un-unveils: `lifting` and `open` only ever go true.
  assert.equal(/setLifting\(false\)|setOpen\(false\)/.test(OVERLAY), false, 'something closes the opened veil again');
  // The ~1.8 s retire after the lift is gone; the scroll retire is only for a veil never opened.
  assert.equal(/'std-reveal-done', onDone/.test(OVERLAY), false, 'the lift retires the drape again');
  assert.match(
    OVERLAY,
    /if \(!firstPageOnly \|\| !active \|\| unveiled\) return;\s*const onScroll = \(\) => \{\s*if \(window\.scrollY > window\.innerHeight\) setGone\(true\);/,
    'scrolling past the first page retires an OPENED veil — the drape must come back with the cover',
  );
  // The opened veil does not hold the page's scrub hand-overs: the mark comes off at the unveil.
  assert.match(OVERLAY, /toggleAttribute\(REVEAL_UP_ATTR, showing && !drapeMode\)/);

  // The veil: with `keepsOpen`, the unveil makes the hit-zone inert, the lift's end keeps it so, and a swipe down
  // after the unveil does not re-cover.
  const free = /const freeThePage = \(pointerId: number\) => \{[\s\S]*?\n {4}\};/.exec(VEIL)?.[0] ?? '';
  assert.ok(free, 'the veil’s `freeThePage` moved — re-anchor this guard');
  assert.match(free, /if \(keepsOpenRef\.current && grabRef\.current\) grabRef\.current\.style\.pointerEvents = 'none';/, 'the drape still takes a hand after the unveil');
  assert.match(VEIL, /revealedRef\.current = true;\s*if \(keepsOpenRef\.current && grabRef\.current\) grabRef\.current\.style\.pointerEvents = 'none';/);
  assert.match(
    VEIL,
    /if \(dyC > 40 && dur < 460 && dyC > Math\.abs\(dxC\) \* 1\.0\) \{\s*if \(keepsOpenRef\.current && \(freed \|\| revealedRef\.current\)\) return;\s*freed = false;\s*setLift\(0\);/,
    'a swipe down re-covers the hub veil — one unveil per visit',
  );
  // Nothing else turns the hit-zone back on after it was armed.
  assert.equal((VEIL.match(/style\.pointerEvents = 'auto'/g) ?? []).length, 1, 'a second place re-arms the hit-zone');
});

test('🎭 off screen the cloth draws no frames; Save-Data and reduced motion draw the drape still', () => {
  const loop = /const loop = \(now: number\) => \{[\s\S]*?\n {4}\};/.exec(VEIL)?.[0] ?? '';
  assert.ok(loop, 'the veil’s loop moved — re-anchor this guard');
  assert.match(loop, /^const loop = \(now: number\) => \{\s*if \(pausedRef\.current\) \{\s*raf = 0;\s*return;\s*\}/, 'the paused loop still draws');
  assert.match(loop, /\(saveData \|\| reducedMotionRef\.current\) && \+\+settledFrames > 90\) \{[\s\S]*?renderer\.render\(scene, camera\);\s*still = true;\s*raf = 0;\s*return;/);
  assert.match(VEIL, /wakeRef\.current = \(\) => \{\s*if \(raf \|\| still \|\| pausedRef\.current\) return;/);
  assert.match(VEIL, /useEffect\(\(\) => \{\s*if \(!paused\) wakeRef\.current\(\);\s*\}, \[paused\]\);/, 'a returning cover does not wake the drape');
});
