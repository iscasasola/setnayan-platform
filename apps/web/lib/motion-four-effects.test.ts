/**
 * 🎛 MOTION = FOUR EFFECTS THAT COMBINE (owner 2026-10-04, DECISION_LOG rows
 * "THEME → SCENE → ELEMENT" … "THE MOTION SHEET RUNS IN THE ORDER A GUEST SEES
 * IT"; `lib/motion-effects.ts`).
 *
 *   1 every value that SHIPPED renders byte-for-byte as before — a table over
 *     every stored In · During · Out · timeline · Delay · Duration, against
 *     renders frozen from `origin/main` before this change
 *     (`motion-shipped-renders.fixture.json`, sha1 of each output)
 *   2 the four effects combine into ONE composed animation
 *   3 only closed-set keys reach CSS
 *   4 reduced motion → still
 *   5 the Maker's Motion section: order, details only when on, no Out when it
 *     plays once, the arrow grid; opening writes nothing; a pick is drafted and
 *     is Pro at Apply
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import {
  hubElementInlineStyle,
  hubElementMotionDeclarations,
  hubElementSceneCss,
  sanitizeHubElementMotion,
  sanitizeHubElements,
  withElementMotion,
  type HubElementMotion,
} from './element-style';
import {
  HUB_DIRECTIONS,
  HUB_IN,
  HUB_MOTION_PRESETS,
  HUB_OUT,
  hubCanvasClass,
  hubCanvasVars,
  hubSceneFxFields,
  resolveHubMotion,
  sanitizeHubCanvas,
} from './hub-canvas';
import { MOTION_DIRS, MOTION_GRID, motionArrow, motionDirName, sanitizeMotionFx, withMotionFx, type MotionFx } from './motion-effects';
import { canvasLookChange } from './hub-draft';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const sha = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const FROZEN = JSON.parse(read('lib/motion-shipped-renders.fixture.json')) as Record<string, Record<string, string>>;
const decl = (d: Array<[string, string]>) => d.map(([p, v]) => `${p}:${v}`).join(';');

/* ── 1 · NOTHING THAT SHIPPED MOVES A PIXEL ─────────────────────────────── */

test('1 🔁 every shipped stored motion renders exactly as it did before the four effects', () => {
  let rows = 0;
  for (const [rawKey, want] of Object.entries(FROZEN)) {
    const raw = JSON.parse(rawKey) as Record<string, string>;
    if ('anim' in raw) {
      const css = hubElementSceneCss('schedule', sanitizeHubElements({ heading: { anim: raw.anim } })) ?? '';
      assert.equal(sha(css), want.scene, `#6019's "${raw.anim}" renders differently now`);
      rows += 1;
      continue;
    }
    // The page reads a stored value through the sanitizer — so does this.
    const m = sanitizeHubElementMotion(raw) ?? undefined;
    for (const [place, appr] of [['page', true], ['page', false], ['hero', true], ['scrub', true], ['auto', false]] as const) {
      const got = decl(hubElementMotionDeclarations(m, place, appr));
      assert.equal(sha(got), want[`${place}${appr ? '' : ':waiting'}`], `${rawKey} at ${place}${appr ? '' : ' (waiting)'} now renders: ${got}`);
    }
    assert.equal(sha(hubElementSceneCss('schedule', { heading: { motion: m } }) ?? ''), want.scene, `${rawKey}: its scene CSS changed`);
    assert.equal(sha(JSON.stringify(hubElementInlineStyle({ motion: m }) ?? null)), want.heroInline, `${rawKey}: its hero style changed`);
    // …and an UNREAD stored value (a path that skipped the sanitizer) still draws the same.
    if (m) assert.equal(sha(decl(hubElementMotionDeclarations(raw as unknown as HubElementMotion, 'page', true))), want.page, `${rawKey} unread`);
    rows += 1;
  }
  assert.ok(rows >= 60, `anti-vacuity: the frozen table has ${rows} rows`);
});

test('1 🔁 the shipped single choices map onto the four — and keep their shipped keyframes', () => {
  assert.deepEqual(sanitizeHubElementMotion({ in: 'rise' }), { in: { fade: true, move: 'below' } });
  assert.deepEqual(sanitizeHubElementMotion({ in: 'fade', timeline: 'scroll', out: 'lift' }), {
    in: { fade: true },
    timeline: 'scroll',
    out: { fade: true, move: 'above' },
  });
  assert.deepEqual(sanitizeHubElementMotion({ in: 'fade', timeline: 'scroll', out: 'settle' })?.out, { fade: true, size: 'settle' });
  assert.equal(sanitizeHubElementMotion({ in: 'fade', timeline: 'scroll', out: 'stay' })?.out, undefined, 'Stay put is no Out');
  assert.equal(sanitizeHubElementMotion({ in: 'fade', duration: 'quick' })?.speed, 'fast');
  assert.equal(sanitizeHubElementMotion({ in: 'fade', duration: 'slow' })?.speed, 'gentle');
  // Written in the new shape, the same choice draws the same shipped keyframe.
  const a = decl(hubElementMotionDeclarations({ in: { fade: true, move: 'below' } }));
  assert.match(a, / none el-in-rise,/);
  assert.doesNotMatch(a, /--el-in-/, 'a shipped combination carries no composed far end');
});

test('1 🔁 every shipped SCENE In / Out + direction, under every preset, keeps its shipped keyframe and class', () => {
  let rows = 0;
  for (const preset of [undefined, ...HUB_MOTION_PRESETS])
    for (const i of [undefined, ...HUB_IN])
      for (const inFrom of [undefined, ...HUB_DIRECTIONS])
        for (const o of [undefined, ...HUB_OUT])
          for (const outTo of [undefined, ...HUB_DIRECTIONS]) {
            const c = sanitizeHubCanvas({ preset, in: i, inFrom, out: o, outTo });
            assert.equal(c.inFx, undefined);
            assert.equal(c.outFx, undefined);
            const m = resolveHubMotion(c);
            const vars = hubCanvasVars(c);
            // The shipped formula, written out (`hubInKeyframe` before 2026-10-04).
            const inKf = m.in === 'none' ? 'none' : m.in === 'fade' ? 'hub-in-fade' : `hub-in-${m.in === 'move_fade' ? 'movefade' : 'move'}-${m.inFrom}`;
            const outKf =
              m.out === 'none' ? 'none' : m.out === 'fade' ? 'hub-out-fade' : m.out === 'settle' ? 'hub-out-settle' : `hub-out-${m.out === 'move_fade' ? 'movefade' : 'move'}-${m.outTo}`;
            assert.equal(vars['--hub-in-kf'], inKf);
            assert.equal(vars['--hub-out-kf'], outKf);
            assert.ok(!Object.keys(vars).some((k) => /^--hub-(in|out)-[otf]$/.test(k)), 'a shipped scene carries a composed far end');
            assert.match(hubCanvasClass(c), new RegExp(`\\bhub-in-${m.in}\\b.*\\bhub-out-${m.out}\\b`));
            rows += 1;
          }
  assert.ok(rows > 2000, `anti-vacuity: ${rows}`);
});

/* ── 2 · THE FOUR COMBINE INTO ONE ANIMATION ────────────────────────────── */

const ALL_FOUR: MotionFx = { fade: true, move: 'top_left', size: 'grow', blur: true };

test('2 🎛 Fade + Move from top-left + Grow + Blur is ONE composed In animation', () => {
  const d = Object.fromEntries(hubElementMotionDeclarations({ in: ALL_FOUR }));
  const slots = (d.animation ?? '').split(/,\s*(?![^()]*\))/);
  const ins = slots.filter((s) => / el-in-/.test(s));
  assert.equal(ins.length, 1, `the In is not one animation: ${d.animation}`);
  assert.match(ins[0]!, / none el-in-mix$/);
  assert.equal(d['--el-in-o'], '0');
  assert.equal(d['--el-in-t'], 'translate3d(-18px, -18px, 0) scale(0.85)');
  assert.equal(d['--el-in-f'], 'blur(8px)');
  // The one keyframe reads all three — and has its Play twin.
  const CSS = stripComments(read('app/globals.css'));
  for (const kf of ['el-in-mix', 'el-in-mix-p']) {
    assert.match(CSS, new RegExp(`@keyframes ${kf}\\s*\\{\\s*from\\s*\\{\\s*opacity: var\\(--el-in-o, 1\\); transform: var\\(--el-in-t, none\\); filter: var\\(--el-in-f, none\\);`));
  }
  assert.match(CSS, /@keyframes el-out-mix\s*\{\s*to\s*\{\s*opacity: var\(--el-out-o, 1\); transform: var\(--el-out-t, none\); filter: var\(--el-out-f, none\);/);
  // The hero carries the far end inline beside its animation (the gated rule reads it).
  const hero = hubElementInlineStyle({ motion: { in: ALL_FOUR } })!;
  assert.equal(hero['--el-in-t'], 'translate3d(-18px, -18px, 0) scale(0.85)');
  assert.match(hero['--el-anim'] ?? '', /el-in-mix/);
});

test('2 🎛 an Out combines too — and a scene speaks the same four', () => {
  const d = Object.fromEntries(
    hubElementMotionDeclarations({ in: { fade: true }, timeline: 'scroll', out: { move: 'bottom_right', size: 'shrink' }, outSpeed: 'gentle' }),
  );
  assert.match(d.animation ?? '', /el-out-mix$/);
  assert.equal(d['--el-out-t'], 'translate3d(22px, 22px, 0) scale(0.85)');
  assert.equal(d['--el-out-o'], '1', 'no Fade chosen — it does not fade');
  assert.match(d['animation-range'] ?? '', /cover 50% exit 100%$/, 'Gentle stretches the Out over more scroll');
  // A scene: a combination the shipped fields cannot say is stored as `inFx` and drawn by `hub-in-mix`.
  const c = sanitizeHubCanvas({ preset: 'calm', ...hubSceneFxFields('in', ALL_FOUR) });
  assert.deepEqual(c.inFx, ALL_FOUR);
  const v = hubCanvasVars(c);
  assert.equal(v['--hub-in-kf'], 'hub-in-mix');
  assert.equal(v['--hub-in-t'], 'translate3d(-28px, -26px, 0) scale(0.85)');
  assert.equal(v['--hub-in-f'], 'blur(8px)');
  assert.match(stripComments(read('app/globals.css')), /@keyframes hub-in-mix\s*\{\s*from\s*\{\s*opacity: var\(--hub-in-o, 1\)/);
  // …and one the shipped fields CAN say is stored as them (so it draws its shipped keyframe).
  assert.deepEqual(hubSceneFxFields('in', { fade: true, move: 'left' }), { in: 'move_fade', inFrom: 'left' });
  assert.deepEqual(hubSceneFxFields('out', { fade: true, size: 'settle' }), { out: 'settle' });
  assert.deepEqual(hubSceneFxFields('in', null), { in: 'none' });
  assert.deepEqual(sanitizeHubCanvas({ inFx: { move: 'right' } }), { in: 'move', inFrom: 'right' }, 'an expressible inFx folds back');
});

/* ── 3 · ONLY CLOSED-SET KEYS REACH CSS ─────────────────────────────────── */

test('3 🔒 a hostile effect is dropped; every far-end value is one of a closed few', () => {
  assert.equal(sanitizeMotionFx({ fade: 'yes', move: 'up;}body{', size: 'huge', blur: 1 }), null);
  assert.equal(sanitizeMotionFx({ size: 'settle' }), null, 'Settle back is an Out only');
  assert.equal(sanitizeHubElementMotion({ in: { move: 'url(x)' }, speed: 'warp' }), null);
  assert.equal(sanitizeHubCanvas({ inFx: { move: 'x' }, outFx: 'fade' }).inFx, undefined);
  const SAFE = /^(0|1|none|blur\(8px\)|translate3d\(-?\d+px, -?\d+px, 0\) scale\((0\.85|1\.15|0\.965|1)\))$/;
  const HOSTILE = ['1;}', 'calc(1)', 'var(--x)', true, 9, null, {}, 'expression(x)'];
  let seen = 0;
  for (const fade of [true, ...HOSTILE])
    for (const move of [...MOTION_DIRS, ...HOSTILE])
      for (const size of ['grow', 'shrink', 'settle', ...HOSTILE])
        for (const blur of [true, ...HOSTILE]) {
          const m = sanitizeHubElementMotion({ in: { fade, move, size, blur }, timeline: 'scroll', out: { fade, move, size, blur } });
          for (const [p, v] of hubElementMotionDeclarations(m ?? undefined)) {
            if (!/^--el-(in|out)-/.test(p)) continue;
            assert.match(v, SAFE, `${p}: ${v}`);
            seen += 1;
          }
        }
  assert.ok(seen > 1000, `anti-vacuity: ${seen}`);
});

/* ── 4 · REDUCED MOTION → STILL ─────────────────────────────────────────── */

test('4 🧘 the composed motion is written only behind prefers-reduced-motion: no-preference', () => {
  const css = hubElementSceneCss('schedule', { heading: { motion: { in: ALL_FOUR, timeline: 'scroll', out: { blur: true } } } })!;
  const gate = css.indexOf('@media (prefers-reduced-motion: no-preference){');
  assert.ok(gate > 0, 'no reduced-motion gate');
  const outside = css.slice(0, css.indexOf('@supports (animation-timeline: view())'));
  assert.doesNotMatch(outside, /animation|--el-(in|out)-|overflow-x/, `motion outside the gate: ${outside}`);
  assert.match(css.slice(gate), /--el-in-t:translate3d\(-18px, -18px, 0\) scale\(0\.85\)/);
  // The hero's one rule is inside the same gate in globals.css.
  const G = stripComments(read('app/globals.css'));
  const rule = G.indexOf('[data-el-motion]:not(#el-own)');
  const reduce = G.lastIndexOf('prefers-reduced-motion: no-preference', rule);
  assert.ok(reduce > 0 && rule - reduce < 20000, 'the hero motion rule left the reduced-motion gate');
});

/* ── 5 · THE MAKER'S MOTION SECTION ─────────────────────────────────────── */

async function animateTab(motion: HubElementMotion, moveTo: (part: string, v: unknown) => void = () => {}) {
  const { PartAnimateTab } = await import(`../${E}/part-inspector`);
  return renderToStaticMarkup(React.createElement(PartAnimateTab, { motion, moveTo, resetMotion: null }));
}

test('5 ↧ the Motion section runs in the order a guest sees it, and a fresh part opens short', async () => {
  const fresh = await animateTab({});
  assert.doesNotMatch(fresh, /data-inspector-row="(speed|delay|out-speed)"/, 'Speed / Delay show with no In on');
  assert.doesNotMatch(fresh, /data-motion-step="out"/, 'Goes out shows on a part that plays once');
  for (const r of ['in-fade', 'in-move', 'in-size', 'in-blur', 'during', 'timeline']) assert.match(fresh, new RegExp(`data-inspector-row="${r}"`));
  const on = await animateTab({ in: { fade: true }, timeline: 'scroll', out: { fade: true } });
  const at = (s: string) => on.indexOf(`data-motion-step="${s}"`);
  assert.ok(at('in') >= 0 && at('in') < at('during') && at('during') < at('out') && at('out') < at('when'), 'In → During → Out → When it plays');
  assert.match(on, /data-inspector-row="speed"/, 'Speed is not under an In that is on');
  assert.match(on, /data-inspector-row="out-speed"/, 'Goes out has no Speed of its own');
  assert.doesNotMatch(on, /data-inspector-row="delay"/, 'following the scroll there is no Delay');
  const timed = await animateTab({ in: { blur: true } });
  assert.match(timed, /data-inspector-row="speed"[\s\S]*data-inspector-row="delay"/);
});

test('5 🏹 Move ▾ opens a 3×3 grid of ARROWS OF TRAVEL, centre None', async () => {
  assert.equal(MOTION_GRID.length, 9);
  assert.equal(MOTION_GRID[4], null, 'the centre is None');
  const want: Record<string, [string, string]> = {
    bottom_left: ['↗', '↙'],
    left: ['→', '←'],
    top_left: ['↘', '↖'],
    above: ['↓', '↑'],
    top_right: ['↙', '↗'],
    right: ['←', '→'],
    bottom_right: ['↖', '↘'],
    below: ['↑', '↓'],
  };
  for (const d of MOTION_DIRS) assert.deepEqual([motionArrow(d, 'in'), motionArrow(d, 'out')], want[d], d);
  assert.equal(motionDirName('bottom_left', 'in'), 'Comes in from lower-left');
  // The SHARED PickMenu, as a grid — never a fork.
  const ROWS = stripComments(read(`${E}/motion-fx-rows.tsx`));
  assert.match(ROWS, /<PickMenu[^>]*?\n?[^<]*grid\b/, 'Move ▾ is not the shared dropdown in grid mode');
  assert.equal((ROWS.match(/<PickMenu\b/g) ?? []).length, 5, 'Fade · Move · Size · Blur · Speed are each one dropdown');
  const PM = stripComments(read(`${E}/pick-menu.tsx`));
  assert.match(PM, /data-pick-grid=\{grid \|\| undefined\}/);
  const G = stripComments(read('app/globals.css'));
  assert.match(G, /\[data-pick-grid\]\s*\{[^}]*grid-template-columns: repeat\(3, 44px\)/, 'the grid is not laid out 3 × 44px');
  assert.match(G, /\[data-pick-grid\] > li > button > span:not\(\[aria-hidden\]\)\s*\{[^}]*clip/, 'the cell shows its words, not just its arrow');
});

test('5 ✋ opening writes nothing; one pick changes one effect and keeps the others', async () => {
  const calls: unknown[] = [];
  await animateTab({ in: { fade: true } }, (p, v) => calls.push([p, v]));
  assert.equal(calls.length, 0, 'rendering the Motion section wrote');
  const { MotionFxRows } = await import(`../${E}/motion-fx-rows`);
  const picked: Array<MotionFx | null> = [];
  const tree = MotionFxRows({ end: 'in', fx: { fade: true }, onChange: (fx: MotionFx | null) => picked.push(fx) }) as React.ReactElement<{
    children: React.ReactElement[];
  }>;
  assert.equal(picked.length, 0);
  const menus = React.Children.toArray(tree.props.children).map(
    (row) => (row as React.ReactElement<{ children: React.ReactElement<{ onPick: (k: string) => void; dataAttr: string }> }>).props.children,
  );
  menus.find((m) => m.props.dataAttr === 'data-motion-in-move')!.props.onPick('top_left');
  menus.find((m) => m.props.dataAttr === 'data-motion-in-size')!.props.onPick('grow');
  assert.deepEqual(picked, [{ fade: true, move: 'top_left' }, { fade: true, size: 'grow' }]);
  assert.deepEqual(withMotionFx(withMotionFx({ fade: true }, 'move', 'top_left'), 'fade', false), { move: 'top_left' });
});

test('5 💎 a motion pick lands in the draft canvas and is Pro at Apply; taking it off is free', () => {
  const els = withElementMotion(null, 'names', 'in', ALL_FOUR);
  assert.deepEqual(els?.names?.motion, { in: ALL_FOUR });
  assert.equal(canvasLookChange({}, { elements: els! }), 'add');
  assert.equal(canvasLookChange({ elements: els! }, {}), 'remove');
  const scene = sanitizeHubCanvas({ ...hubSceneFxFields('out', { blur: true, move: 'top_right' }) });
  assert.equal(canvasLookChange({}, scene), 'add', 'a scene’s composed Out is not Pro at Apply');
});
