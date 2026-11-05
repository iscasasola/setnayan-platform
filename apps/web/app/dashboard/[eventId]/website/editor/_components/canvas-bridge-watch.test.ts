/**
 * 👂 A CANVAS THAT NEVER ANSWERS IS SAID (2026-10-18 night, live, the owner's Safari: *"cannot select again"* — every
 * tap on the Maker's canvas did nothing, the toolbar stayed on "INVITATION › HOME", and no fault was recorded).
 *
 * The cause this guard holds: a canvas frame whose bridge never says `ready` was shown anyway (`NO_BRIDGE_MS`) and
 * then NOTHING noticed — a dead page drawn exactly like a working one. This drives the real watch
 * (`createCanvasBridgeWatch`) with a fake clock, and reads the wiring that makes it reach the couple:
 *   1. a frame that says `ready` in time is left alone — nothing reloaded, said or recorded;
 *   2. a loaded frame still silent after the grace is loaded again ONCE, and recorded;
 *   3. still silent after that → the toolbar line goes on, and it is recorded again (with birth, reloads and what
 *      the frame's own document says it is);
 *   4. a `ready` that comes later takes the line off; Reload loads the frame again and takes it off;
 *   5. only the frame ON SCREEN is judged;
 *   6. the wiring: the Maker's canvas asks for the watch, both `ready` listeners and `load` feed it, the toolbar
 *      draws the words, and the fault module is loaded only when there is a fault (the Maker's first-load budget).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CANVAS_BRIDGE_GRACE_MS,
  CANVAS_SILENT_RELOAD,
  CANVAS_SILENT_WORDS,
  createCanvasBridgeWatch,
  readCanvasDoc,
  type CanvasBridgeWatchHost,
  type CanvasSilentReport,
} from './canvas-bridge-watch';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), 'utf8');

function rig(shown = 'A') {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; id: number; on: boolean }> = [];
  let n = 0;
  const ready = new Set<string>();
  const log = { reloads: [] as string[], says: [] as boolean[], reports: [] as CanvasSilentReport[] };
  const state = { shown };
  const host: CanvasBridgeWatchHost = {
    later: (fn, ms) => {
      const t = { at: now + ms, fn, id: ++n, on: true };
      timers.push(t);
      return t;
    },
    clear: (h) => {
      (h as { on: boolean }).on = false;
    },
    shown: () => state.shown,
    isReady: (id) => ready.has(id),
    reload: (id) => log.reloads.push(id),
    say: (s) => log.says.push(s),
    report: (r) => log.reports.push(r),
    readDoc: () => ({ drawnFor: 'guest', bound: false, at: '/cale-ice?phase=rsvp&editor=1' }),
    birth: (id) => (id === 'W' ? 'warm' : 'shown'),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.on && x.at <= now)) {
      t.on = false;
      t.fn();
    }
  };
  return { host, advance, ready, log, state, watch: createCanvasBridgeWatch(host) };
}

test('1 · a frame that says ready in time is left alone', () => {
  const r = rig();
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS - 1);
  r.ready.add('A');
  r.watch.ready('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS * 3);
  assert.deepEqual(r.log, { reloads: [], says: [], reports: [] });
});

test('2 · 3 · silent after the grace: loaded again once, then said — each time recorded', () => {
  const r = rig();
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  assert.deepEqual(r.log.reloads, ['A'], 'the silent frame is loaded again by itself, once');
  assert.deepEqual(r.log.says, [], 'nothing said yet — the reload may be all it needed');
  assert.equal(r.log.reports.length, 1);
  assert.equal(r.log.reports[0]!.step, 'auto-reload');
  assert.equal(r.log.reports[0]!.missing, 'ready');
  assert.equal(r.log.reports[0]!.doc.drawnFor, 'guest', "the frame's own document reading travels with the fault");
  /* the reload's `load`, and still no bridge */
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  assert.deepEqual(r.log.reloads, ['A'], 'never a second reload by itself');
  assert.deepEqual(r.log.says, [true], 'the toolbar line goes on');
  assert.equal(r.log.reports.length, 2);
  assert.equal(r.log.reports[1]!.step, 'told');
  assert.equal(r.log.reports[1]!.reloads, 1);
});

test('4 · a late ready takes the line off; Reload loads again and takes it off', () => {
  const r = rig();
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  assert.deepEqual(r.log.says, [true]);
  r.watch.reloadNow();
  assert.deepEqual(r.log.reloads, ['A', 'A'], 'Reload loads the frame on screen');
  assert.deepEqual(r.log.says, [true, false], 'and the line steps aside while it loads');
  r.watch.loaded('A');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  assert.deepEqual(r.log.says, [true, false, true], 'still silent after a Reload: said again');
  r.ready.add('A');
  r.watch.ready('A');
  assert.deepEqual(r.log.says, [true, false, true, false], 'the page answering takes the line off');
});

test('5 · only the frame on screen is judged; a kept one says where it came from', () => {
  const r = rig('A');
  r.watch.loaded('W');
  r.advance(CANVAS_BRIDGE_GRACE_MS * 2);
  assert.equal(r.log.reloads.length + r.log.says.length + r.log.reports.length, 0, 'a frame behind is not judged');
  r.state.shown = 'W';
  r.watch.shownNow('W');
  r.advance(CANVAS_BRIDGE_GRACE_MS);
  assert.deepEqual(r.log.reloads, ['W'], 'shown now — and loaded long ago with no ready: judged');
  assert.equal(r.log.reports[0]!.birth, 'warm');
});

test('readCanvasDoc names a host canvas, a guest page and no document — and never throws', () => {
  const doc = (marks: string[]) => ({
    documentElement: {},
    querySelector: (sel: string) => (marks.includes(sel) ? {} : null),
  });
  const win = { location: { pathname: '/cale-ice', search: '?phase=rsvp&editor=1' } };
  assert.deepEqual(readCanvasDoc({ contentDocument: doc(['[data-maker-section]']) as never, contentWindow: win as never }), {
    drawnFor: 'host',
    bound: false,
    at: '/cale-ice?phase=rsvp&editor=1',
  });
  assert.equal(readCanvasDoc({ contentDocument: doc(['[data-maker-section]', '[data-setnayan-editor-bound]']) as never }).bound, true);
  assert.equal(readCanvasDoc({ contentDocument: doc([]) as never }).drawnFor, 'guest');
  assert.equal(readCanvasDoc(null).drawnFor, 'unreadable');
  const throwing = {
    get contentDocument(): Document {
      throw new Error('blocked');
    },
  };
  assert.equal(readCanvasDoc(throwing).drawnFor, 'unreadable');
});

test('6 · the wiring reaches the couple, and the fault module stays out of the first load', () => {
  const frame = read('buffered-canvas-frame.tsx');
  const shell = read('editor-shell.tsx');
  const tools = read('../../../launch/_components/stage-tools.tsx');
  const watch = read('canvas-bridge-watch.ts');

  /* the Maker's own canvas — the one BufferedCanvasFrame whose `onSwapped` is the canvas's — asks for the watch */
  const mainCanvas = shell.slice(shell.indexOf('onSwapped={onCanvasSwapped}'), shell.indexOf('onSwapped={onCanvasSwapped}') + 400);
  assert.match(mainCanvas, /\bwatchBridge\b/, "the Maker's canvas frame is watched");

  /* both `ready` listeners and every `load` feed it */
  assert.equal((frame.match(/watch\.current\?\.ready\(/g) ?? []).length, 2, 'a ready heard by either listener reaches the watch');
  assert.match(frame, /onLoad=\{\(\) => \{\s*loaded\.current\.add\(canvasFrameId\(f\)\);\s*setWarmTick\(\(n\) => n \+ 1\);\s*watch\.current\?\.loaded\(canvasFrameId\(f\)\);/);
  assert.match(frame, /watch\.current\?\.shownNow\(/);
  assert.match(frame, /window\.addEventListener\(MAKER_CANVAS_RELOAD_EVENT/);

  /* the toolbar listens and draws the words with one button */
  assert.match(tools, /window\.addEventListener\(MAKER_CANVAS_SILENT_EVENT/);
  assert.match(tools, /data-stage-canvas-silent=""/);
  assert.match(tools, /\{CANVAS_SILENT_WORDS\}/);
  assert.match(tools, /label=\{CANVAS_SILENT_RELOAD\}/);
  assert.match(tools, /dispatchEvent\(new Event\(MAKER_CANVAS_RELOAD_EVENT\)\)/);
  assert.equal(CANVAS_SILENT_WORDS, "The page isn't answering taps.");
  assert.equal(CANVAS_SILENT_RELOAD, 'Reload');

  /* the fault goes through the app's one path, loaded only when there is one */
  assert.match(watch, /import\('@\/lib\/telemetry\/track-error'\)/);
  assert.doesNotMatch(watch, /^import[^\n]*track-error/m, 'never a static import — it would ride the Maker first load');
  assert.doesNotMatch(frame, /track-error/);
  assert.doesNotMatch(tools, /track-error/);
});
