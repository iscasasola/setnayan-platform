/**
 * ✋ ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL FOR EVERY LIST (owner 2026-11-01, DECISION_LOG row of that name):
 * *"when we pick someone up and drag in on the top, the normal tendency is to scroll the list so i can see the other
 * places above it. this is a standard navigation rule on drag and drop"*.
 *
 *   1 · THE RULE — near an edge the list scrolls by itself toward it, FASTER THE NEARER; in the middle it stays. Executed
 *       on `dragEdgeStep` and on each drag's own reach (the March's, the RSVP line's, the Maker scene's).
 *       Sabotage: a flat speed (`Math.min(max, DRAG_EDGE_MIN_STEP)`) → red.
 *   2 · ONE COPY — no source file but `lib/drag-edge-scroll.ts` measures a finger against an edge band or turns a
 *       distance into a speed. Sabotage: put the March's old `d.y < top + EDGE_PX …` / `4 + dist / 4` back → red.
 *   3 · EVERY DRAG ASKS IT — any file that follows a pointer (`pointermove`) in an animation-frame loop and scrolls is a
 *       drag that edge-scrolls, and must take its step from the one rule (`dragEdgeStep`, or the Maker's
 *       `sceneEdgeScroll`, which is itself only a reach on it). Sabotage: drop the import from the March → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DRAG_EDGE_MAX_STEP, DRAG_EDGE_MIN_STEP, DRAG_EDGE_PAST_PX, DRAG_EDGE_PX, dragEdgeStep, type DragEdgeBand, type DragEdgeReach } from './drag-edge-scroll';
import { SCENE_EDGE_MAX_STEP, SCENE_EDGE_PX, sceneEdgeScroll } from './maker-scene-drag';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const SHARED = 'lib/drag-edge-scroll.ts';

/* ── 1 · the rule ────────────────────────────────────────────────────────────────────────────────────────────── */

/** Walk the finger from the band's inner line out to the edge: every step at least as fast as the one before, and the
 *  edge strictly faster than the inner line. */
function risesTowardTheEdge(step: (y: number) => number, from: number, to: number, sign: -1 | 1, label: string) {
  const dir = Math.sign(to - from);
  let was = 0;
  const speeds: number[] = [];
  for (let y = from; dir > 0 ? y <= to : y >= to; y += dir) {
    const v = step(y);
    assert.equal(Math.sign(v), sign, `${label}: at y=${y} it scrolls the wrong way (${v})`);
    assert.ok(Math.abs(v) >= was, `${label}: at y=${y} it slowed down nearer the edge (${Math.abs(v)} < ${was})`);
    was = Math.abs(v);
    speeds.push(was);
  }
  assert.ok(speeds.length > 40, `anti-vacuity: ${label} walked only ${speeds.length} px`);
  assert.ok(speeds[speeds.length - 1]! > speeds[0]! + 6, `${label}: no faster at the edge (${speeds[0]} → ${speeds[speeds.length - 1]}) — "faster the nearer"`);
}

test('1 · near an edge the list scrolls by itself, faster the nearer — in the middle it stays', () => {
  const band: DragEdgeBand = { top: 100, bottom: 800 };
  const reaches: Array<[string, DragEdgeReach]> = [
    ['the March / the RSVP line (the default reach)', {}],
    ['a capped reach', { max: 14 }],
  ];
  for (const [label, reach] of reaches) {
    const step = (y: number) => dragEdgeStep(y, band, reach);
    assert.equal(step(450), 0, `${label}: the middle scrolls`);
    assert.equal(step(band.top + DRAG_EDGE_PX + 1), 0, `${label}: just inside the top band's line already scrolls`);
    risesTowardTheEdge(step, band.top + DRAG_EDGE_PX - 1, band.top, -1, `${label} · up`);
    risesTowardTheEdge(step, band.bottom - DRAG_EDGE_PX + 1, band.bottom, 1, `${label} · down`);
    for (let y = -500; y < 1500; y += 3) assert.ok(Math.abs(step(y)) <= (reach.max ?? DRAG_EDGE_MAX_STEP), `${label}: too fast at y=${y}`);
  }
  /* The slowest is a real step (a 1 px start reads as stuck); the fastest is reached by the edge. */
  assert.equal(Math.abs(dragEdgeStep(band.top + DRAG_EDGE_PX - 1, band)), DRAG_EDGE_MIN_STEP);
  assert.equal(Math.abs(dragEdgeStep(band.top, band)), DRAG_EDGE_MAX_STEP);
  /* A finger past the edge (over the header above a list's box) still scrolls it — up to the reach, then not. */
  assert.ok(dragEdgeStep(band.top - DRAG_EDGE_PAST_PX + 1, band) < 0);
  assert.equal(dragEdgeStep(band.top - DRAG_EDGE_PAST_PX - 1, band), 0);
  assert.ok(dragEdgeStep(band.bottom + DRAG_EDGE_PAST_PX - 1, band) > 0);
  assert.equal(dragEdgeStep(band.bottom + DRAG_EDGE_PAST_PX + 1, band), 0);
  assert.equal(dragEdgeStep(band.bottom - 5, band, { bottomOff: true }), 0, 'a bottom band switched off still scrolls');
});

test('1b · the Maker scene drag is the same rule — its own reach (cap 14, any height above, nothing past the foot, the bin)', () => {
  const top = 0;
  const bottom = 700;
  assert.equal(SCENE_EDGE_PX, DRAG_EDGE_PX, 'the scene has its own edge band');
  risesTowardTheEdge((y) => sceneEdgeScroll(y, top, bottom, false), top + SCENE_EDGE_PX - 1, top - 200, -1, 'scene · up');
  risesTowardTheEdge((y) => sceneEdgeScroll(y, top, bottom, false), bottom - SCENE_EDGE_PX + 1, bottom - 1, 1, 'scene · down');
  for (let y = -300; y < 1000; y += 7) assert.ok(Math.abs(sceneEdgeScroll(y, top, bottom, false)) <= SCENE_EDGE_MAX_STEP);
  assert.equal(sceneEdgeScroll(bottom + 1, top, bottom, false), 0, 'past the page’s foot it scrolls');
  assert.equal(sceneEdgeScroll(bottom - 10, top, bottom, true), 0, 'on the bin it scrolls');
  /* Same curve, not a look-alike: inside the cap the scene's step IS the shared step. */
  for (let y = 0; y < 700; y += 5) {
    const shared = dragEdgeStep(y, { top, bottom }, { max: SCENE_EDGE_MAX_STEP, pastTop: Infinity, pastBottom: 0 });
    assert.equal(sceneEdgeScroll(y, top, bottom, false), shared, `the scene's step differs from the shared one at y=${y}`);
  }
});

/* ── 2 + 3 · one copy, and every drag asks it ────────────────────────────────────────────────────────────────── */

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const FILES = ['app', 'lib', 'components'].flatMap((d) => sources(join(WEB, d))).map((p) => ({ rel: relative(WEB, p), src: readFileSync(p, 'utf8') }));

/** Edge math: a finger's `y` measured against an EDGE band, an edge line built from one, or a distance turned into a speed. */
const EDGE_MATH = [
  /\by\s*[<>]=?\s*[^;,)?]*\b\w*EDGE_PX\b/,
  /\b(innerHeight|bottom|top)\s*[-+]\s*\w*EDGE_PX\b/,
  /\bdist\s*\/\s*\d/,
  /Math\.min\(\s*\d+\s*,\s*\d+\s*\+\s*\w+\s*\/\s*\d+\s*\)/,
];

test('2 · exactly one edge-scroll implementation — no second copy of the math', () => {
  assert.ok(FILES.length > 500, `anti-vacuity: only ${FILES.length} source files read`);
  const shared = FILES.find((f) => f.rel === SHARED);
  assert.ok(shared, `${SHARED} is gone`);
  /* The patterns can see the copies this replaced (they must, or this test would pass on them). */
  assert.ok(EDGE_MATH[0]!.test('d.dir = d.y < top + EDGE_PX && d.y > top - 40 ? -1 : 0;'));
  assert.ok(EDGE_MATH[2]!.test('d.scroller.scrollTop += d.dir * Math.min(18, 4 + dist / 4);'));
  assert.ok(EDGE_MATH[0]!.test('if (y < top + SCENE_EDGE_PX) return -1;'));
  const copies: string[] = [];
  for (const f of FILES) {
    if (f.rel === SHARED) continue;
    const code = stripComments(f.src);
    for (const re of EDGE_MATH) {
      const m = code.match(re);
      if (m) copies.push(`${f.rel}: ${m[0]}`);
    }
  }
  assert.deepEqual(copies, [], `a second copy of the edge-scroll math — ask lib/drag-edge-scroll.ts (dragEdgeStep) instead:\n${copies.join('\n')}`);
});

test('3 · every drag that scrolls takes its step from the one rule — the March, the RSVP line, the Maker scene', () => {
  const drags = FILES.filter(
    (f) => /pointermove/.test(f.src) && /requestAnimationFrame/.test(f.src) && /scrollBy\(|scrollTop\s*[-+]=|dragScrollBy\(/.test(f.src),
  );
  const named = drags.map((f) => f.rel);
  for (const must of [
    'app/dashboard/[eventId]/launch/_components/details-march.tsx',
    'app/dashboard/[eventId]/launch/_components/rsvp-canvas-drag.ts',
    'app/dashboard/[eventId]/launch/_components/scene-canvas-drag.ts',
  ]) assert.ok(named.includes(must), `anti-vacuity: ${must} is not seen as a drag that scrolls (${named.join(', ')})`);
  for (const f of drags) {
    const asks = /\bdragEdgeStep\(/.test(f.src) || /\bsceneEdgeScroll\(/.test(f.src);
    assert.ok(asks, `${f.rel} follows a finger and scrolls, but not by the one rule (dragEdgeStep / sceneEdgeScroll)`);
  }
  /* The Maker's scene step is itself only a reach on the shared rule. */
  const scene = FILES.find((f) => f.rel === 'lib/maker-scene-drag.ts')!.src;
  assert.match(scene, /export function sceneEdgeScroll\([^)]*\): number \{\s*return dragEdgeStep\(/);
  /* Guests › March is the March: the same component, never a second drag. */
  const guests = FILES.find((f) => f.rel === 'app/dashboard/[eventId]/guests/_components/guests-march.tsx')!.src;
  assert.match(guests, /<MarchMaker\b/);
  assert.doesNotMatch(guests, /pointermove|requestAnimationFrame/);
});
