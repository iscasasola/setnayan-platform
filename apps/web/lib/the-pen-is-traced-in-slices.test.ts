/**
 * the-pen-is-traced-in-slices.test.ts — ⚡ A PLAYING LOGO NEVER FREEZES THE PAGE IT IS ON.
 *
 * Measured 2026-10-16 (production build, the owner's events board replayed, Chromium 375 px,
 * 4× CPU): after the hydration fix, `/dashboard` still had one 667–670 ms long task. A CPU
 * profile put 692 ms of it in `LayeredLogoPlayer`'s draw branch, and a bench on the live page
 * named the call: Maria & Jose's traced logo is ONE outline of 2,147 path characters, and
 * `getPointAtLength` re-walks it from the start on every call — 636 samples, 648 ms, in one
 * task, while a tap on the board did nothing.
 *
 * Holds (source — the browser call cannot run under node):
 *   1. the sampling loop yields to the page (`await nextFrame()`) once a slice passes ~8 ms;
 *   2. the samples are the same samples (`Math.min(1500, Math.max(120, Math.round(total / 2)))`);
 *   3. the layer is hidden until its pen is ready and shown again after — never "shown, gone,
 *      drawn again";
 *   4. a redraw or unmount while tracing stops the trace (no animations onto a dead tree).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const src = stripComments(readFileSync(join(__dirname, '..', 'app/_components/layered-logo-player.tsx'), 'utf8'));
const branch = (() => {
  const at = src.indexOf("} else if (motion.in === 'draw') {");
  assert.ok(at > 0, 'the trace-the-outline branch moved — move this guard with it');
  return src.slice(at, src.indexOf("} else if (motion.in === 'rise'", at));
})();

test('the outline walk yields to the page between slices', () => {
  const loop = branch.slice(branch.indexOf('for (let k = 0; k <= n; k++)'));
  const walk = loop.indexOf('shape.getPointAtLength(');
  const yieldAt = loop.indexOf('await nextFrame()');
  assert.ok(walk > 0, 'the sampling loop is gone');
  assert.ok(yieldAt > 0 && yieldAt < walk, 'the sampling loop must yield (await nextFrame()) before it samples');
  assert.match(loop.slice(0, walk), /performance\.now\(\) - slice > 8/);
  assert.match(branch, /requestAnimationFrame\(\(\) => resolve\(\)\)/);
});

test('the samples are the samples they always were', () => {
  assert.match(branch, /const n = Math\.min\(1500, Math\.max\(120, Math\.round\(total \/ 2\)\)\);/);
  assert.match(branch, /strokeDashoffset: len \+ 1 \}, \{ strokeDashoffset: 0 \}/);
});

test('the layer is hidden while its pen is traced, shown when it is ready', () => {
  const hide = branch.indexOf("body.style.visibility = 'hidden'");
  const show = branch.lastIndexOf("body.style.visibility = ''");
  assert.ok(hide > 0 && show > hide, 'hide before the trace, show after the animations exist');
  assert.ok(show > branch.lastIndexOf('play('), 'shown only once every animation is set');
});

test('a redraw or unmount mid-trace stops the trace', () => {
  const guards = branch.match(/if \(!host\.isConnected \|\| host\.firstChild !== root\) return;/g) ?? [];
  assert.ok(guards.length >= 2, 'checked after each yield and before the animations');
});
