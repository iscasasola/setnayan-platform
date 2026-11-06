/**
 * the-veil-feels-the-scroll.test.ts — owner 2026-10-25: *"when we scroll we want the veil to be affected due to scroll"*.
 *
 * The page's scroll / swipe velocity is a gentle wind on the cloth (`lib/veil-cloth.ts` · `addScrollDelta` /
 * `takeScrollWind`). Held here: the force is CLAMPED however hard the flick (so it can never throw the cloth over its
 * crown), it DECAYS to exactly zero once the hand stops, and the veil reads it from passive listeners with no layout
 * read — inside the sim, so reduced motion (which never starts the sim) gets none of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  addScrollDelta,
  noteScrollY,
  restAtTop,
  restingAtTop,
  takeScrollWind,
  veilMaySleep,
  SCROLL_WIND_MAX,
  SCROLL_WIND_MIN,
  TOP_REST_MS,
  type ScrollWind,
} from '@/lib/veil-cloth';

const here = dirname(fileURLToPath(import.meta.url));
const VEIL = stripComments(readFileSync(join(here, 'veil-reveal.tsx'), 'utf8'));

test('the scroll wind is clamped — no flick, however hard, exceeds the bounds', () => {
  const w: ScrollWind = { v: 0 };
  for (const d of [1e6, 5000, -1e6, Infinity, NaN, -Infinity]) {
    addScrollDelta(w, d);
    const f = takeScrollWind(w);
    assert.ok(Number.isFinite(f), `finite for ${d}`);
    assert.ok(f <= SCROLL_WIND_MAX && f >= SCROLL_WIND_MIN, `in bounds for ${d}: ${f}`);
  }
  const down: ScrollWind = { v: 0 };
  for (let i = 0; i < 50; i++) addScrollDelta(down, 400);
  assert.equal(takeScrollWind(down), SCROLL_WIND_MAX, 'a hard scroll down lifts at most at full strength');
  const up: ScrollWind = { v: 0 };
  for (let i = 0; i < 50; i++) addScrollDelta(up, -400);
  assert.equal(takeScrollWind(up), SCROLL_WIND_MIN, 'a scroll up sags it at most half as much');
});

test('the scroll wind decays to exactly zero once the hand stops', () => {
  const w: ScrollWind = { v: 0 };
  addScrollDelta(w, 240);
  let prev = Infinity;
  let frames = 0;
  for (; frames < 120; frames++) {
    const f = takeScrollWind(w);
    assert.ok(Math.abs(f) <= prev, 'never grows on its own');
    prev = Math.abs(f);
    if (f === 0) break;
  }
  assert.ok(frames < 60, `still within a second (took ${frames} frames)`);
  assert.equal(w.v, 0);
  assert.equal(takeScrollWind(w), 0);
});

test('the veil reads the scroll from passive listeners, once a frame, with no layout read', () => {
  for (const ev of ['wheel', 'touchstart', 'touchmove'])
    assert.match(VEIL, new RegExp(`addEventListener\\('${ev}', \\w+, \\{ passive: true \\}\\)`), `${ev} is passive`);
  assert.match(VEIL, /scrollF = takeScrollWind\(scrollWind\);\s*atTop = restingAtTop\(topRest, now\);\s*step\(1 \/ 60\);/, "read once per frame, before the step");
  const wind = VEIL.slice(VEIL.indexOf('const onWheel'), VEIL.indexOf("window.addEventListener('wheel'"));
  assert.ok(wind.length > 0);
  assert.doesNotMatch(VEIL.slice(VEIL.indexOf('const onWheel')), /getBoundingClientRect/, 'no layout read in the wind');
  assert.equal((VEIL.match(/window\.scrollY/g) ?? []).length, 2, 'scrollY is read only in the passive scroll event');
  assert.match(VEIL, /const onScroll = \(\) => \{\s*const now = performance\.now\(\);\s*noteScrollY\(topRest, window\.scrollY, now\);/);
});

test('🌸 petals: born only while resting at the top; off it none is born, and the sim sleeps once none is in the air', () => {
  const s = restAtTop();
  assert.equal(restingAtTop(s, 0), true, 'the opening starts at the top: petals fall');
  noteScrollY(s, 400, 1000);
  assert.equal(restingAtTop(s, 1000), false, 'scrolled away: no new petal');
  assert.equal(veilMaySleep(true, false, 3), false, 'petals still in the air keep falling (and drawing)');
  assert.equal(veilMaySleep(true, false, 0), true, 'none left in the air, off the top: the sim sleeps');
  assert.equal(veilMaySleep(false, false, 0), false, 'never before the veil has lifted');
  assert.equal(veilMaySleep(true, true, 0), false, 'never while at the top');
  noteScrollY(s, 0, 2000);
  assert.equal(restingAtTop(s, 2000), false, 'back at the top but not yet resting');
  assert.equal(restingAtTop(s, 2000 + TOP_REST_MS - 1), false);
  assert.equal(restingAtTop(s, 2000 + TOP_REST_MS), true, `resting ${TOP_REST_MS} ms: the shower resumes`);
  noteScrollY(s, 1, 2100);
  assert.equal(restingAtTop(s, 2000 + TOP_REST_MS), true, 'a jitter within the top keeps the rest clock');
  noteScrollY(s, 50, 2200);
  noteScrollY(s, 0, 2210);
  assert.equal(restingAtTop(s, 2300), false, 'leaving the top restarts the rest clock');
});

test('🌸 the veil retires a fallen petal off the top and re-births it ABOVE the frame at the top — never mid-screen', () => {
  assert.match(VEIL, /if \(atTop\) spawnFalling\(i\);\s*else pGone\[i\] = 1;/, 'off the top a petal that fell out is retired, not reborn');
  assert.match(VEIL, /if \(pGone\[i\] && atTop\) \{[^}]*spawnFalling\(i\);\s*pPos\[i\]!\.y = vh \* \(1\.05 \+ rnd\(\) \* 1\.9\);/, 'reborn above the top edge');
  assert.match(VEIL, /if \(veilMaySleep\(revealedRef\.current, atTop,/, 'the loop sleeps by the rule');
});
