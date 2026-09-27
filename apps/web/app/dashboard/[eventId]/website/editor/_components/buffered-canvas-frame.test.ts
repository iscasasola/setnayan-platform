/**
 * buffered-canvas-frame.test.ts — 🪞 A MAKER WRITE NEVER BLANKS THE CANVAS.
 *
 * Owner, 2026-09-27: *"everytime we edit something, the loading takes time and
 * loads the whole screen"*. The canvas is double-buffered: a new render loads
 * behind the page and swaps in when ready. This holds the planner (what is
 * mounted, never more than two frames) and the wiring (the shell draws the
 * canvas through the buffer, and a loading frame's `ready` is not mistaken for
 * the shown one's — which would scroll the old page and flash it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canvasFrameId, planCanvasFrames, promoteCanvasFrame, type CanvasFrames } from './buffered-canvas-frame';

const f = (key: string, group = 'rsvp:', src = '/m?editor=1') => ({ key, group, src });
const start: CanvasFrames = { shown: f('rsvp:1:'), loading: null };

test('a new render on the same stage loads BEHIND the page — the page stays shown', () => {
  const s = planCanvasFrames(start, f('rsvp:2:'));
  assert.equal(s.shown.key, 'rsvp:1:', 'the page the couple is looking at stays');
  assert.equal(s.loading?.key, 'rsvp:2:');
});

test('the loading frame is shown only when it is promoted', () => {
  const s = promoteCanvasFrame(planCanvasFrames(start, f('rsvp:2:')), canvasFrameId(f('rsvp:2:')));
  assert.deepEqual(s, { shown: f('rsvp:2:'), loading: null });
  // A promotion for a frame that is no longer the loading one changes nothing.
  const t = planCanvasFrames(start, f('rsvp:2:'));
  assert.equal(promoteCanvasFrame(t, canvasFrameId(f('rsvp:9:'))), t);
});

test('quick saves never stack frames: a newer render REPLACES the one loading', () => {
  let s = planCanvasFrames(start, f('rsvp:2:'));
  s = planCanvasFrames(s, f('rsvp:3:'));
  s = planCanvasFrames(s, f('rsvp:4:'));
  assert.equal(s.shown.key, 'rsvp:1:');
  assert.equal(s.loading?.key, 'rsvp:4:');
  assert.equal([s.shown, s.loading].filter(Boolean).length, 2);
});

test('a new stage or "view as" swaps at once — the couple asked for a different page', () => {
  const s = planCanvasFrames(planCanvasFrames(start, f('rsvp:2:')), f('save_the_date:2:', 'save_the_date:'));
  assert.deepEqual(s, { shown: f('save_the_date:2:', 'save_the_date:'), loading: null });
});

test('the same render again settles: nothing loads', () => {
  assert.deepEqual(planCanvasFrames(start, f('rsvp:1:')), start);
  const s = planCanvasFrames(start, f('rsvp:2:'));
  assert.equal(planCanvasFrames(s, f('rsvp:2:')), s, 'the render already loading keeps loading');
  // The same key with a new address (the Event Bar switch) reloads, buffered.
  const bars = planCanvasFrames(start, f('rsvp:1:', 'rsvp:', '/m?editor=1&bars=1'));
  assert.equal(bars.loading?.src, '/m?editor=1&bars=1');
  // …and the two frames never share an identity (React would mount ONE of them).
  assert.notEqual(canvasFrameId(bars.shown), canvasFrameId(bars.loading!));
  assert.deepEqual(promoteCanvasFrame(bars, canvasFrameId(bars.loading!)).shown, bars.loading);
});

test('the wiring: the shell draws the canvas through the buffer, and skips a loading frame’s ready', () => {
  const dir = join(process.cwd(), 'app/dashboard/[eventId]/website/editor/_components');
  const shell = readFileSync(join(dir, 'editor-shell.tsx'), 'utf8');
  const buffer = readFileSync(join(dir, 'buffered-canvas-frame.tsx'), 'utf8');
  assert.match(shell, /<BufferedCanvasFrame\b/);
  const ready = shell.slice(shell.indexOf('const onReady = '), shell.indexOf("window.addEventListener('message', onReady)"));
  assert.match(ready, /event\.source === loadingCanvas\.current\) return;/, 'a loading frame’s ready must not scroll the shown page');
  assert.match(buffer, /loadingRef\.current = frames\.loading/, 'the buffer names its loading window');
  // The loading frame is invisible and untappable; the shown one is untouched.
  assert.match(buffer, /loading \? 'pointer-events-none opacity-0' : ''/);
  // The swap carries the scroll before the new page is shown.
  const promote = buffer.slice(buffer.indexOf('const promote = '), buffer.indexOf('setFrames((prev) => promoteCanvasFrame(prev, key))'));
  assert.match(promote, /carryScroll\(/);
});
