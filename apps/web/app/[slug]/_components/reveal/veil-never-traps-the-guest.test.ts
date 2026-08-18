/**
 * veil-never-traps-the-guest.test.ts — the save-the-date can fail to draw, but
 * it must never make the page untouchable.
 *
 * WHAT WENT WRONG. The veil mounts a screen-wide hit-zone so a guest can swipe
 * it off. It rendered with `pointerEvents: 'auto'` from first paint, and the ONLY
 * thing that ever shrank it to the top valance band was the requestAnimationFrame
 * loop. Two guards return from the mount effect BEFORE that loop is scheduled:
 *
 *   • `prefers-reduced-motion: reduce` — an ordinary accessibility setting
 *   • the WebGL constructor `catch` — whose own comment reads
 *     "No WebGL → reveal silently (never gate the guest)"
 *
 * On either path the guest got an invisible full-screen sheet with nothing left
 * running to remove it. The parent deliberately never unmounts the veil
 * ("reveal stays on top, not under", owner 2026-06-18), so it never went away:
 * every tap, swipe and scroll landed on nothing until the tab was closed.
 *
 * 🔑 THE SHAPE OF THE BUG IS "BLOCK FIRST, RELEASE LATER". Anything that starts
 * by blocking input and relies on later code to release it is one early `return`
 * away from trapping somebody — and the two early returns here are the exact
 * paths taken by the guests least able to work around it. The fix inverts the
 * default; these tests pin the inversion.
 *
 * ⚠ SOURCE-LEVEL ON PURPOSE. The veil needs WebGL, a canvas and a live rAF loop;
 * there is no render harness in this repo that can drive it. These assertions
 * therefore check the two facts that make the bug impossible — the hit-zone
 * renders inert, and it is only armed after the last early return — rather than
 * simulating a browser. Stated plainly so nobody reads more into them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(HERE, 'veil-reveal.tsx'), 'utf8');
/** Comments quote the old code verbatim to explain it — strip before matching. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the hit-zone renders INERT — a page that never runs the loop is still usable', () => {
  const grabJsx = /ref=\{grabRef\}[\s\S]{0,240}?\/>/.exec(SRC)?.[0] ?? '';
  assert.ok(grabJsx, 'Could not find the grab-zone element — this guard is blind, fix it.');
  assert.match(
    grabJsx,
    /pointerEvents:\s*'none'/,
    "The veil's hit-zone must RENDER with pointerEvents:'none'. Rendering it 'auto' " +
      'makes it a screen-wide invisible blocker from first paint, and the only code ' +
      'that shrinks it lives inside the rAF loop — which two early returns skip.',
  );
});

test('it is armed only AFTER the last early return, next to the loop', () => {
  const armIdx = SRC.indexOf("grabRef.current.style.pointerEvents = 'auto'");
  assert.ok(armIdx > 0, 'Nothing ever arms the hit-zone — the veil cannot be grabbed at all.');
  const loopIdx = SRC.indexOf('requestAnimationFrame(loop)');
  assert.ok(loopIdx > 0, 'Could not find the loop start — guard is blind.');

  // Both early returns must sit ABOVE the arming line, or the trap is back.
  const reducedMotionIdx = SRC.indexOf('prefers-reduced-motion: reduce');
  const noWebglIdx = SRC.indexOf('new THREE.WebGLRenderer');
  assert.ok(
    reducedMotionIdx > 0 && reducedMotionIdx < armIdx,
    'The reduced-motion guard must return BEFORE the hit-zone is armed.',
  );
  assert.ok(
    noWebglIdx > 0 && noWebglIdx < armIdx,
    'The WebGL failure path must return BEFORE the hit-zone is armed.',
  );
});

test('both early exits still hand control back, and neither arms the blocker', () => {
  // Each guard calls the completion callback so the film beneath starts. What
  // they must NOT do is enable the hit-zone on the way out.
  const effect = SRC.slice(SRC.indexOf('const mount = mountRef.current'));
  const upToRenderer = effect.slice(0, effect.indexOf('new THREE.WebGLRenderer'));
  assert.match(
    upToRenderer,
    /onRevealedRef\.current\(\)/,
    'The reduced-motion path must still reveal the film — the guest sees the event, ' +
      'just without the cloth simulation.',
  );
  assert.doesNotMatch(
    upToRenderer,
    /pointerEvents\s*=\s*'auto'/,
    'An early return must never arm the hit-zone: nothing after it will disarm it.',
  );
});
