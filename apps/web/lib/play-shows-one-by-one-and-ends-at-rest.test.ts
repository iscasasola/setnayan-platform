/**
 * play-shows-one-by-one-and-ends-at-rest.test.ts — ▶ PLAYS A SCENE'S ROWS ONE BY ONE AS THE GUEST PAGE DOES, AND
 * ENDS AT REST (the 2026-10-15 Animate walk, F7 · F8; `app/[slug]/_components/play-sequence.ts`).
 *
 *   (1) ONE BY ONE (`hub-seq-parts`): each part on its own delay (the stagger × its place, the eighth's for the
 *       rest); a list's own part stands still and its rows arrive a stagger apart, the first a stagger after the
 *       heading; the phase lasts until the last one has arrived. Measured before: every row full at 466–470 ms.
 *       Sabotage: the stagger dropped → red.
 *   (2) A SCENE THAT ARRIVES WHOLE still plays as one block, on its frame (as it shipped).
 *   (3) BACK TO REST, AT REST: taking ▶'s inline animation off hands the part its page animations back — which the
 *       browser STARTS AGAIN (measured: ▶ on Action ended with the part at opacity 0.02, fading in). Every arrival
 *       on the clock is finished at once; a scroll's is left to the scroll; a Drift is left running.
 *       Sabotage: nothing finished → red.
 *   (4) THE CSS replay (`sn-replay`, the scene ▶ the toolbar plays) staggers the rows the same way, in both gates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sequenceOf, settleAtRest } from '../app/[slug]/_components/play-sequence';

type N = {
  tag: string; kids: N[]; cls: string[]; cs: Record<string, string>; rows?: boolean;
  set: string[]; style: { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  classList: { contains(c: string): boolean };
  matches(sel: string): boolean; querySelector(sel: string): N | null; querySelectorAll(sel: string): N[]; children: N[];
  anims: Array<{ animationName: string; timeline: unknown; finished: boolean; finish(): void }>;
  getAnimations(): N['anims'];
};
const DOC_TL = { doc: true };
(globalThis as unknown as { document: unknown }).document = { timeline: DOC_TL };
function n(tag: string, kids: N[] = [], cls: string[] = [], cs: Record<string, string> = {}, rows = false): N {
  const set: string[] = [];
  const self: N = {
    tag, kids, cls, cs, rows, set, children: kids, anims: [],
    style: { setProperty: (_k, v) => void set.push(v), removeProperty: () => void set.push('(removed)') },
    classList: { contains: (c) => cls.includes(c) },
    matches: (sel) => (sel === '[data-hub-rows]' ? rows : false),
    querySelector: (sel) => (sel === '[data-hub-rows]' ? kids.find((k) => k.rows) ?? null : null),
    querySelectorAll: (sel) => (sel === ':scope > .hub-canvas-body > * > *' ? (kids[0]?.kids[0]?.kids ?? []) : []),
    getAnimations: () => self.anims,
  };
  return self;
}
const g = globalThis as unknown as { getComputedStyle: unknown };
g.getComputedStyle = (x: N) => ({ animationName: x.cs.animationName ?? 'none', animationDuration: x.cs.animationDuration ?? '0s', animationTimeline: x.cs.animationTimeline ?? 'auto', getPropertyValue: (k: string) => x.cs[k] ?? '' });
const delayOf = (a: string) => Number(/ (\d+)ms 1 normal both$/.exec(a)?.[1]);

test('(1) one by one: parts a stagger apart, a list’s rows one by one after the heading, the list itself still', () => {
  const rows = [n('li'), n('li'), n('li'), n('li')];
  const heading = n('h2');
  const list = n('ol', rows, [], {}, true);
  const words = n('p');
  const section = n('section', [heading, list, words]);
  const body = n('div', [section]);
  const frame = n('div', [body], ['hub-canvas', 'hub-seq-parts', 'hub-tl-time'], { '--hub-in-kf': 'hub-in-fade', '--hub-out-kf': 'none', '--hub-duration': '1.1s', '--hub-stagger': '0.12s' });
  const { steps } = sequenceOf(frame as never, true, 'in');
  assert.equal(steps.length, 1);
  const s = steps[0]!;
  const all = [{ node: s.node, animation: s.animation }, ...(s.more ?? [])] as Array<{ node: N; animation: string }>;
  assert.ok(!all.some((x) => x.node === list), 'the list’s own part moved — two opacities multiply');
  assert.deepEqual(all.map((x) => [x.node.tag, delayOf(x.animation)]), [['h2', 0], ['li', 120], ['li', 240], ['li', 360], ['li', 480], ['p', 240]], 'not staggered as the guest page staggers');
  for (const x of all) assert.match(x.animation, /^hub-in-fade 1100ms /);
  assert.equal(s.ms, 1100 + 480, 'the phase ends before the last row has arrived');
});

test('(2) a scene that arrives whole plays as one block on its frame', () => {
  const frame = n('div', [n('div', [n('section', [n('h2'), n('p')])])], ['hub-canvas', 'hub-seq-whole', 'hub-tl-time'], { '--hub-in-kf': 'hub-in-fade', '--hub-duration': '1.1s' });
  const s = sequenceOf(frame as never, true, 'in').steps[0]!;
  assert.equal(s.node, frame);
  assert.equal(s.more, undefined);
});

test('(3) at rest, at rest: the page’s restarted arrivals are finished; a scroll’s and a Drift are left alone', () => {
  const part = n('h1');
  const mk = (name: string, timeline: unknown) => ({ animationName: name, timeline, finished: false, finish() { this.finished = true; } });
  part.anims = [mk('el-in-mix', DOC_TL), mk('el-during-drift', DOC_TL), mk('el-out-fade', { view: true }), mk('el-in-fade-p', DOC_TL), mk('hub-in-rise', { view: true })];
  settleAtRest(part as never);
  assert.deepEqual(part.set, ['(removed)']);
  assert.deepEqual(part.anims.map((a) => [a.animationName, a.finished]), [['el-in-mix', true], ['el-during-drift', false], ['el-out-fade', false], ['el-in-fade-p', true], ['hub-in-rise', false]]);
  /* …and the player uses it at the end and after the Action. */
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'play-sequence.ts'), 'utf8');
  assert.match(src, /const rest = \(\) => \{\s*for \(const n of touched\) settleAtRest\(n\);/);
  assert.match(src, /if \(s\.phase === 'act'\) settleAtRest\(s\.node\);/);
});

test('(4) the CSS replay staggers the rows too — in both gates', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const rule = /\.hub-canvas\.sn-replay\.sn-replay\.hub-seq-parts > \.hub-canvas-body \[data-hub-rows\] > \* \{\s*animation: var\(--hub-in-kf, none\) var\(--hub-duration, 1\.1s\) [^;]* calc\(var\(--hub-stagger, 0\.12s\) \* var\(--sn-row, 8\)\) both;/g;
  assert.equal((css.match(rule) ?? []).length, 2, 'the rows are not replayed one by one in both gates');
  for (let i = 1; i <= 7; i++) assert.equal((css.match(new RegExp(`\\[data-hub-rows\\] > \\*:nth-child\\(${i}\\) \\{ --sn-row: ${i}; \\}`, 'g')) ?? []).length, 2, `row ${i}`);
  assert.equal((css.match(/\.hub-canvas\.sn-replay\.sn-replay\.hub-seq-parts > \.hub-canvas-body > \* > \[data-hub-rows\],/g) ?? []).length, 2, 'the list’s own part is replayed with its rows');
});
