/**
 * a-scene-pick-plays-on-the-canvas.test.ts — A SCENE'S MOTION PICK IS ON THE CANVAS AT THE TAP, PLAYS ONCE, AND ▶
 * ALWAYS PLAYS THE LATEST PICK (the 2026-10-15 Animate walk, F5 · F10; `app/[slug]/_components/scene-motion-lay.ts`).
 *
 *   (1) THE MESSAGE carries the page's own motion — `hubCanvasClass` · `hubCanvasVars` of the canvas the pick writes —
 *       and nothing else: no photo, no colour, no shape. Executed for every effect × drive × feel.
 *   (2) THE BRIDGE TRUSTS NOTHING: a class or property outside the motion's, or a value outside the plain set
 *       (`;`, `{`, `url(`), is dropped.
 *   (3) LAYING IT replaces the frame's old motion classes and values with the new ones and touches nothing else (its
 *       photo class, its `--hub-media`, its spacing stay). Sabotage: the old classes kept → red.
 *   (4) THE WIRING: every motion pick of the new Maker's Animate goes through the one sender (Build in, Movement,
 *       Plays, Rows → plays Build in; Build out → Build out; Action → Action); the bridge lays it on the frame on
 *       screen, finishes the page's own restarted arrival, and plays the phase with ▶'s own player; a frame that
 *       loads behind is told the latest pick on `ready`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hubCanvasClass, hubCanvasVars, sanitizeHubCanvas } from './hub-canvas';
import { SCENE_MOTION_CLASS, SCENE_MOTION_VAR, laySceneMotion, readSceneMotion, sceneMotionMessage } from '../app/[slug]/_components/scene-motion-lay';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function fakeFrame(classes: string[], vars: Record<string, string>) {
  const cls = new Set(classes);
  const st = new Map(Object.entries(vars));
  const classList = Object.assign([] as string[], { add: (c: string) => void cls.add(c), remove: (c: string) => void cls.delete(c) });
  const style = Object.assign([] as string[], { setProperty: (k: string, v: string) => void st.set(k, v), removeProperty: (k: string) => void st.delete(k) });
  const sync = () => {
    classList.length = 0;
    classList.push(...cls);
    style.length = 0;
    style.push(...st.keys());
  };
  sync();
  return { frame: { classList, style }, sync, cls, st };
}

const FX = [{ fade: true }, { fade: true, move: 'left' }, { blur: true, size: 'grow' }, { fade: true, blur: true, move: 'right', size: 'grow' }];

test('(1) the message is the page’s own motion for the canvas the pick writes — and only motion', () => {
  let n = 0;
  for (const inFx of FX) for (const timeline of ['time', 'scrub'] as const) for (const duration of [0.6, 1.1, 1.8]) for (const sequence of [undefined, 'one_after_another'] as const) {
    const c = sanitizeHubCanvas({ canvas: { inFx, timeline, duration, ...(sequence ? { sequence } : {}), kind: 'color', color: '#223344' } });
    const msg = sceneMotionMessage('w:schedule', hubCanvasClass(c), hubCanvasVars(c), 'in');
    const vars = hubCanvasVars(c);
    for (const [k, v] of Object.entries(vars)) {
      if (SCENE_MOTION_VAR.test(k)) assert.equal(msg.vars[k], v, `${k} did not travel`);
      else assert.equal(msg.vars[k], undefined, `${k} is not motion and travelled`);
    }
    assert.ok(msg.vars['--hub-in-kf'], 'no keyframe travelled');
    for (const cl of hubCanvasClass(c).split(' ')) assert.equal(msg.classes.includes(cl), SCENE_MOTION_CLASS.test(cl), cl);
    assert.ok(msg.classes.some((x) => x.startsWith('hub-tl-')) && msg.classes.some((x) => x.startsWith('hub-in-')));
    /* What the bridge reads back is exactly what was sent. */
    const back = readSceneMotion(JSON.parse(JSON.stringify(msg)))!;
    assert.deepEqual(Object.fromEntries(back.vars), msg.vars, 'the bridge dropped a real motion value');
    assert.deepEqual(back.classes, msg.classes);
    n++;
  }
  assert.ok(n >= 48, `anti-vacuity ${n}`);
});

test('(2) the bridge drops anything that is not a scene’s motion', () => {
  const r = readSceneMotion({ classes: ['hub-in-fade', 'evil', 'hub-has-media', 'hub-tl-time x'], vars: { '--hub-in-kf': 'hub-in-fade', '--hub-media': 'url(x)', '--hub-in-t': 'x;}body{', '--hub-ease': 'url(javascript:1)', color: 'red', '--hub-duration': '1.1s' }, play: 'sideways' })!;
  assert.deepEqual(r.classes, ['hub-in-fade']);
  assert.deepEqual(Object.fromEntries(r.vars), { '--hub-in-kf': 'hub-in-fade', '--hub-duration': '1.1s' });
  assert.equal(r.play, null);
  assert.equal(readSceneMotion(null), null);
  assert.equal(readSceneMotion({ classes: 'hub-in-fade', vars: {} }), null);
});

test('(3) laying it swaps the motion and leaves everything else as drawn', () => {
  const { frame, sync, cls, st } = fakeFrame(
    ['hub-canvas', 'hub-has-media', 'hub-bg-photo', 'hub-seq-whole', 'hub-in-fade', 'hub-out-none', 'hub-during-still', 'hub-tl-time', 'pahina-in'],
    { '--hub-media': 'url("a")', '--hub-zoom': '1', '--hub-in-kf': 'hub-in-fade', '--hub-duration': '1.1s', '--hub-stagger': '0.12s', '--hub-in-o': '0' },
  );
  laySceneMotion(frame as never, { classes: ['hub-seq-parts', 'hub-in-move', 'hub-out-fade', 'hub-during-lift', 'hub-tl-scrub'], vars: [['--hub-in-kf', 'hub-in-mix'], ['--hub-in-end', 'entry min(92%, 34vh)'], ['--hub-duration', '1.8s']] });
  sync();
  assert.deepEqual([...cls].sort(), ['hub-bg-photo', 'hub-canvas', 'hub-during-lift', 'hub-has-media', 'hub-in-move', 'hub-out-fade', 'hub-seq-parts', 'hub-tl-scrub', 'pahina-in'].sort(), 'an old motion class stayed, or something else went');
  assert.deepEqual(Object.fromEntries(st), { '--hub-media': 'url("a")', '--hub-zoom': '1', '--hub-in-kf': 'hub-in-mix', '--hub-in-end': 'entry min(92%, 34vh)', '--hub-duration': '1.8s' }, 'an old motion value stayed (a stale stagger plays a stale gap), or the photo went');
});

test('(4) the wiring: every Animate pick sends, the bridge lays and plays, a new frame is told the latest', () => {
  const tab = read('app/dashboard/[eventId]/website/editor/_components/scene-animate-tab.tsx');
  const ss = tab.slice(tab.indexOf('if (ss) {'), tab.indexOf('return (', tab.indexOf('if (ss) {') + 20) + 4000);
  const block = ss.slice(ss.indexOf('<StageAnimate'), ss.indexOf('/>', ss.indexOf('leaves=')));
  assert.ok(block.length > 500, 'anti-vacuity: the new Maker’s Animate was found');
  assert.doesNotMatch(block.replace(/setTransition\([^)]*\)/g, ''), /saveCanvas\(/, 'a motion pick that the canvas never sees');
  for (const [what, phase] of [['laySceneInFeel', 'in'], ['laySceneOutFeel', 'out'], ["sceneFx\\(c, 'out', fx\\)", 'out'], ['c\\.during = d as HubDuring;', 'act']] as const) {
    assert.match(block, new RegExp(`save\\(\\(c\\) => \\{? ?${what}[^]*?, '${phase}'\\)`), `${what} does not play ${phase}`);
  }
  assert.match(tab, /sceneMotionMessage\(`w:\$\{widgetType\}`, hubCanvasClass\(next\), hubCanvasVars\(next\), play\)/);
  assert.match(tab, /d\.t !== 'ready'[^]*?\.postMessage\(\{ \.\.\.sent\.current, play: null \}/, 'a frame drawn before the pick is not told it');
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /if \(data\.t === 'sceneMotion'\) \{\s*const motion = readSceneMotion\(data\);[^]*?laySceneMotion\(frame as never, motion\);\s*finishArrivals\(frame, true\);[^]*?seqStop = playSequence\(frame, true, [^]*?motion\.play\);/);
});
