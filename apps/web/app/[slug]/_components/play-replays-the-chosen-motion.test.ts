/**
 * ▶ PLAY REPLAYS THE MOTION THE COUPLE CHOSE (owner 2026-10-06: Schedule ›
 * Animate · Editorial · follows the scroll · Fade · from the right · Grow · Blur
 * — and ▶ Preview showed none of it). `scene-replay.ts` says why.
 *
 *   1. A scene's play restarts its OWN arrivals (`hub-in-*`, `el-in-*`), never
 *      its departures, and wears `sn-replay` for one arrival.
 *   2. A part's Build in really changes what it renders on Play: its arrival is
 *      swapped to the `-p` twin, the browser's only CSS restart.
 *   3. The replay rule binds `--hub-in-kf` on TIME, inside BOTH motion gates
 *      (where a guest's browser draws no scene motion, Play shows none either).
 *   4. The canvas's `play` uses it — the generic stand-in fade is gone.
 *
 * Sabotage: make `replaySceneIn` or `replayElementIn` a no-op → 1/2 go red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENE_REPLAY_CLASS, replaySceneIn, type ReplayNode } from './scene-replay';
import { replayElementIn } from './editor-bridge';

const WEB = join(__dirname, '..', '..', '..');

function fakeNode(over: Partial<ReplayNode> & { classes?: Set<string> } = {}): ReplayNode & { classes: Set<string> } {
  const classes = over.classes ?? new Set<string>();
  return {
    classes,
    classList: { add: (c: string) => void classes.add(c), remove: (c: string) => void classes.delete(c) },
    matches: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    ...over,
  } as ReplayNode & { classes: Set<string> };
}

test("a scene's play restarts its own arrivals — never its departures", () => {
  const log: string[] = [];
  const anim = (name: string) => ({
    animationName: name,
    cancel: () => log.push(`cancel ${name}`),
    play: () => log.push(`play ${name}`),
  });
  const frame = fakeNode({
    matches: (sel) => sel === '.hub-canvas',
    getAnimations: () => [anim('hub-in-mix'), anim('hub-out-mix'), anim('el-in-fade'), anim('el-during-drift')],
  });
  const partA = fakeNode();
  const partB = fakeNode();
  const later: number[] = [];
  const replayed: ReplayNode[] = [];
  const moved = replaySceneIn(
    { ...frame, querySelectorAll: () => [partA, partB] } as ReplayNode,
    { replayPart: (p) => (replayed.push(p), p === partA), later: (_fn, ms) => void later.push(ms) },
  );
  assert.ok(frame.classes.has(SCENE_REPLAY_CLASS), 'the frame wears the replay class for one arrival');
  assert.deepEqual(log, ['cancel hub-in-mix', 'play hub-in-mix', 'cancel el-in-fade', 'play el-in-fade'], 'only arrivals restart');
  assert.deepEqual(replayed, [partA, partB], 'every part is asked to replay its own In');
  assert.equal(moved, 3, 'two arrivals restarted + one part with motion of its own');
  assert.equal(later.length, 1, 'the class comes off after the arrival');
});

test("a part's Build in changes its rendered motion state on Play (the -p twin)", () => {
  const g = globalThis as unknown as { getComputedStyle?: unknown; window?: unknown };
  const saved = { gcs: g.getComputedStyle, win: g.window };
  g.getComputedStyle = () => ({ animationName: 'el-in-mix, el-during-drift', getPropertyValue: () => '' });
  g.window = { setTimeout: () => 0 };
  try {
    const style: Record<string, string> & { setProperty?: unknown; removeProperty?: unknown } = { outline: '', animationName: '' };
    style.setProperty = () => {};
    style.removeProperty = () => {};
    const part = { style, scrollIntoView: () => {} } as unknown as HTMLElement;
    assert.equal(replayElementIn(part, false), true, 'a part with a Build in replays');
    assert.equal(style.animationName, 'el-in-mix-p, el-during-drift', 'its arrival is swapped to the Play twin — a real restart');
  } finally {
    g.getComputedStyle = saved.gcs;
    g.window = saved.win;
  }
});

test('the replay rule binds the chosen keyframe on time, inside both motion gates', () => {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const at = css.indexOf('.hub-canvas.sn-replay.sn-replay.hub-seq-whole > .hub-canvas-body');
  assert.ok(at > 0, 'the replay rule exists');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /animation-name:\s*var\(--hub-in-kf/);
  assert.match(rule, /animation-timeline:\s*auto/);
  /* The block it sits in, by brace matching: the `@supports (animation-timeline: view())` gate holds it. */
  let inside = false;
  for (let g = css.indexOf('@supports (animation-timeline: view())'); g >= 0; g = css.indexOf('@supports (animation-timeline: view())', g + 1)) {
    let i = css.indexOf('{', g);
    let depth = 0;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    if (at > g && at < i && css.slice(g, at).includes('prefers-reduced-motion: no-preference')) inside = true;
  }
  assert.ok(inside, 'the replay rule is inside the support gate and the reduced-motion gate');
});

test("the canvas's play replays the chosen motion — the stand-in fade is gone", () => {
  const bridge = readFileSync(join(__dirname, 'editor-bridge.tsx'), 'utf8');
  const play = bridge.slice(bridge.indexOf("data.t === 'play')"), bridge.indexOf("data.t === 'play')") + 600);
  assert.match(play, /playScene\(el\)/, 'play runs the scene replay');
  assert.ok(!/el\.animate\(/.test(play), 'no generic stand-in animation');
  assert.match(bridge, /replaySceneIn\(/);
});
