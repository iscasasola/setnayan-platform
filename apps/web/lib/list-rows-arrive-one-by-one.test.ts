/**
 * list-rows-arrive-one-by-one.test.ts — A SCENE'S LIST ARRIVES ROW BY ROW.
 *
 * Owner, 2026-09-28, on the Schedule scene's run of show: *"how can the load
 * as we scroll up one by one?"* (DECISION_LOG "LIST ROWS ARRIVE ONE BY ONE AS
 * THE GUEST SCROLLS"). "One part after another" staggered only a scene's
 * DIRECT children, so the six rows of the run of show — one `<ol>`, one part —
 * arrived as one block.
 *
 * The build is one marker (`data-hub-rows` on the container whose children are
 * the rows), a block of rules in globals.css that make a row a part like any
 * other, and a row mark from the page's ONE observer. This file holds the
 * PROPERTIES, each seen to fail by sabotage before it was trusted:
 *
 *   1. 🔒 a row is never hidden without motion — every row rule sits inside
 *      the scroll-timeline gate, the no-reduced-motion gate and `screen`;
 *   2. ⏳ no script → no mark → a Plays-once row is never bound;
 *   3. ⭐ the stagger reaches the rows, and the observer numbers them in turn;
 *   4. ⛔ Still / All at once are untouched — every row rule asks for
 *      `hub-seq-parts`, which a free couple cannot set;
 *   5. 🧱 the list's own part stands still (two opacities would multiply);
 *   6. 📜 the run of show (and the other list scenes) carry the marker on the
 *      element whose children are the rows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { HUB_SEQUENCE_DEPTH, hubCanvasClass, resolveHubMotion } from './hub-canvas';
import { SCENE_TEMPLATE_IDS, sceneTemplateDefaults } from './scene-templates';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const COMPONENTS = join(WEB, 'app', '[slug]', '_components');
const CSS = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));

/** Every style rule in the sheet, with the at-rules it sits inside (outermost first). */
function rules(css: string): Array<{ selector: string; body: string; chain: string[] }> {
  const out: Array<{ selector: string; body: string; chain: string[] }> = [];
  const chain: string[] = [];
  const kinds: Array<'at' | 'rule'> = [];
  let start = 0;
  let ruleStart = -1;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = css.slice(start, i).trim();
      if (prelude.startsWith('@')) {
        chain.push(prelude.replace(/\s+/g, ' '));
        kinds.push('at');
      } else {
        kinds.push('rule');
        ruleStart = i + 1;
        out.push({ selector: prelude.replace(/\s+/g, ' '), body: '', chain: [...chain] });
      }
      start = i + 1;
    } else if (ch === '}') {
      const kind = kinds.pop();
      if (kind === 'at') chain.pop();
      else if (kind === 'rule' && out.length) out[out.length - 1]!.body = css.slice(ruleStart, i);
      start = i + 1;
    } else if (ch === ';' && kinds[kinds.length - 1] !== 'rule') {
      start = i + 1; // a statement at-rule (`@import …;`) is not a prelude
    }
  }
  return out;
}

const ALL = rules(CSS);
/* 🔁 RE-AIMED 2026-10-09 (commit 8c — Scrub is a held hand-over, `globals.css` "SCRUB — A HELD HAND-OVER"): rows in a
   Scrub scene are placed by the ENGINE'S mark (`data-hub-scrub-on`), not by a scroll timeline, so those rules sit
   behind `screen` + "no reduced motion" and that mark — judged by their own test below. The rules this file was
   written for are the rest. */
const ENGINE_ROW_RULES = ALL.filter((r) => r.selector.includes('[data-hub-rows]') && r.selector.includes('[data-hub-scrub-on]'));
const ROW_RULES = ALL.filter((r) => r.selector.includes('[data-hub-rows]') && !r.selector.includes('[data-hub-scrub-on]'));

test('⭐ precondition: the sheet has row rules to judge', () => {
  console.log(`[rows] rules=${ALL.length} rowRules=${ROW_RULES.length}`);
  assert.ok(ROW_RULES.length >= 5, `expected the row block in globals.css, found ${ROW_RULES.length} rules`);
});

test('1 🔒 every row rule is inside BOTH motion gates and `screen` — reduced motion, an old engine and print see every row', () => {
  for (const r of ROW_RULES) {
    const chain = r.chain.join(' | ');
    assert.ok(
      r.chain.some((a) => /^@supports \(animation-timeline: ?view\(\)\)/.test(a)),
      `a row rule outside the scroll-timeline gate: ${r.selector} [${chain}]`,
    );
    assert.ok(
      r.chain.some((a) => /^@media \(prefers-reduced-motion: ?no-preference\)/.test(a)),
      `a row rule outside the reduced-motion gate: ${r.selector} [${chain}]`,
    );
    assert.ok(
      r.chain.some((a) => /^@media screen$/.test(a)),
      `a row rule that also applies to print: ${r.selector} [${chain}]`,
    );
  }
});

test('2 ⏳ a Plays-once row binds its In only once the page has marked THAT row `.pahina-in`', () => {
  const timed = ROW_RULES.filter((r) => /\.hub-tl-time/.test(r.selector) && /--hub-part-in:\s*var\(--hub-in-kf/.test(r.body));
  assert.ok(timed.length >= 1, 'no timed row rule binds the scene In');
  for (const r of timed) {
    assert.match(r.selector, /\[data-hub-rows\] > \.pahina-in$/, `a timed row binds without its own mark: ${r.selector}`);
  }
  // …and nothing hands a row a keyframe without its mark — scrolled or pinned
  // alike — except an ARMED auto run, which only a script can arm.
  const unmarked = ROW_RULES.filter(
    (r) => /--hub-part-in:\s*var\(--hub-in-kf/.test(r.body) && !/\.pahina-in$/.test(r.selector) && !/^\.hub-arun\[data-armed\]/.test(r.selector),
  );
  assert.deepEqual(unmarked.map((r) => r.selector), [], 'a row is bound to the In without a mark (no script would still hide it)');
});

test('2 🔒 a row at rest is bound to NOTHING — the default is visible', () => {
  const base = ROW_RULES.find((r) => /\[data-hub-rows\] > \*$/.test(r.selector) && /animation-name:/.test(r.body));
  assert.ok(base, 'the rows\' applying rule is gone');
  assert.match(base!.body, /--hub-part-in:\s*none/);
  assert.match(base!.body, /--hub-part-out:\s*none/);
  assert.match(base!.body, /animation-name:\s*var\(--hub-part-in, none\), var\(--hub-part-out, none\)/);
  // A delayed row's fill must not paint the from-state before it is bound —
  // `both` applies only once the mark binds a keyframe.
  assert.match(base!.body, /animation-fill-mode:\s*both, backwards/);
});

test('3 ⭐ the scene\'s stagger reaches the rows — each numbered row waits its turn', () => {
  const timed = ROW_RULES.find((r) => /\.hub-tl-time/.test(r.selector) && /\.pahina-in$/.test(r.selector));
  assert.ok(timed, 'no timed row rule');
  assert.match(timed!.body, /--hub-part-delay:\s*calc\(var\(--hub-stagger, 0s\) \* var\(--hub-row-at, 1\)\)/);
  assert.match(timed!.body, /--hub-part-dur:\s*var\(--hub-duration/);
  assert.match(timed!.body, /--hub-part-ease:\s*var\(--hub-ease/);
  // Follows the scroll: its OWN view, so a row arrives as it enters.
  const scrub = ROW_RULES.find((r) => /\.hub-tl-scrub/.test(r.selector) && /--hub-part-in-tl/.test(r.body));
  assert.ok(scrub, 'no scrubbed row rule');
  assert.match(scrub!.selector, /\.pahina-in$/, 'a scrolled row binds before the observer marked it');
  assert.match(scrub!.body, /--hub-part-in:\s*var\(--hub-in-kf, none\)/);
  assert.match(scrub!.body, /--hub-part-in-tl:\s*view\(\)/);
  assert.match(scrub!.body, /--hub-part-out:\s*var\(--hub-out-kf, none\)/);
});

test('4 ⛔ every row rule asks for "one part after another" — Still and All at once never move a row', () => {
  for (const r of ROW_RULES) {
    // Every selector in the list, not only the first.
    for (const s of r.selector.split(',')) {
      assert.ok(
        /\.hub-seq-parts|\.hub-in-none\.hub-out-none/.test(s),
        `a row selector outside the sequence: ${s.trim()}`,
      );
    }
    // The resets that take motion AWAY are allowed to match more; nothing that
    // binds a keyframe may.
    if (/\.hub-in-none\.hub-out-none/.test(r.selector)) assert.match(r.body, /animation:\s*none/);
  }
  // …and the classes: Still, Calm and an explicit "All at once" are the whole block.
  assert.match(hubCanvasClass({ preset: 'still' }), /\bhub-seq-whole\b/);
  assert.match(hubCanvasClass({ preset: 'calm' }), /\bhub-seq-whole\b/);
  assert.match(hubCanvasClass({ preset: 'cinematic', sequence: 'together' }), /\bhub-seq-whole\b/);
  assert.match(hubCanvasClass({ preset: 'calm', sequence: 'one_after_another' }), /\bhub-seq-parts\b/);
});

test('4 💳 a free couple\'s scene has no sequence to follow — Pro stays Pro', () => {
  // Nothing arranged, a colour background (free), or a template picked without
  // Pro (`sceneTemplateDefaults(id, false)` stores the template alone): all
  // resolve to "All at once", so no row rule can match.
  assert.equal(resolveHubMotion({}).sequence, 'together');
  assert.match(hubCanvasClass({ kind: 'color', color: '#F5E6D3' } as never), /\bhub-seq-whole\b/);
  for (const id of SCENE_TEMPLATE_IDS) {
    const stored = sceneTemplateDefaults(id, false);
    assert.equal(resolveHubMotion(stored).sequence, 'together', `a free ${id} scene would stagger its rows`);
  }
});

test('5 🧱 the list\'s own part stands still while its rows arrive — never two opacities', () => {
  const selfReset = ROW_RULES.find((r) => /> \* > \[data-hub-rows\]/.test(r.selector) && /\.pahina-in/.test(r.selector));
  assert.ok(selfReset, 'no reset for a list that IS a part (and is marked .pahina-in)');
  assert.match(selfReset!.body, /--hub-part-in:\s*none/);
  const wrapReset = ROW_RULES.find((r) => /:has\(\[data-hub-rows\]\)/.test(r.selector));
  assert.ok(wrapReset, 'no reset for a part that wraps the list');
  assert.match(wrapReset!.body, /--hub-part-in:\s*none/);
});

test('5 ⛔ a scrolling scene\'s rules never reach into a run — a pinned row\'s view() never moves', () => {
  const scroll = ROW_RULES.filter((r) => /view\(\)|--hub-row-at/.test(r.body));
  assert.ok(scroll.length >= 2);
  for (const r of scroll) {
    for (const s of r.selector.split(',')) {
      assert.match(s.trim(), /^:not\(\.hub-scrub\):not\(\.hub-auto\) > /, `a scroll-scene rule that reaches into a run: ${s.trim()}`);
    }
  }
});

/* ── ROWS IN A RUN (owner 2026-09-28: "yes, make pinned rows arrive one by one too") ── */

const RUN_GATE = /^@supports \(animation-range: entry 0% exit 100%\) and \(timeline-scope: none\)$/;
const pieces = (r: { selector: string }) => r.selector.split(',').map((x) => x.trim());
const PINNED = ROW_RULES.filter((r) => pieces(r).some((x) => /^\.hub-scrub > /.test(x)));
const AUTO = ROW_RULES.filter((r) => pieces(r).some((x) => /^\.hub-arun\[data-armed\]/.test(x)));

test('7 📌 a pinned row arrives on the SPACER\'s timeline, with the scene\'s own In — once marked', () => {
  const bind = PINNED.find((r) => /--hub-part-in:\s*var\(--hub-in-kf, none\)/.test(r.body));
  assert.ok(bind, 'no pinned row rule binds the scene In');
  assert.match(bind!.selector, /\.hub-seq-parts > \.hub-canvas-body \[data-hub-rows\] > \.pahina-in$/);
  assert.match(bind!.body, /--hub-part-in-tl:\s*var\(--hub-tl\)/);
  assert.match(bind!.body, /--hub-part-ease:\s*var\(--hub-ease/);
  for (const r of [...PINNED, ...AUTO]) {
    assert.ok(r.chain.some((a) => RUN_GATE.test(a)), `a run row rule outside the runs' gate: ${r.selector}`);
    assert.ok(r.chain.some((a) => /^@media screen$/.test(a)), `a run row rule that also applies to print: ${r.selector}`);
  }
});

/** The pinned slice of row i of n, in steps from `--hub-at`, evaluated from the shipped formula. */
function pinnedSlice(i: number, n: number): [number, number] {
  const bind = PINNED.find((r) => /--hub-part-in-range/.test(r.body))!;
  const m = /--hub-part-in-range:\s*cover (calc\([\s\S]*?\))\s+cover (calc\([\s\S]*?\));/.exec(bind.body);
  assert.ok(m, 'the pinned range is not two cover offsets');
  const num = (expr: string) =>
    Function(`return ${expr
      .replace(/calc\(/g, '(')
      .replace(/var\(--hub-at\)/g, '0')
      .replace(/var\(--hub-step\)/g, '1')
      .replace(/var\(--hub-row-i, 1\)/g, String(i))
      .replace(/var\(--hub-row-n, 1\)/g, String(n))}`)() as number;
  return [num(m![1]!), num(m![2]!)];
}

test('7 📌 row i of n takes the i-th slice of the hold — in order, back to back, all before the hand-over', () => {
  for (const n of [1, 3, 6, 12]) {
    let prevEnd: number | null = null;
    for (let i = 1; i <= n; i += 1) {
      const [a, b] = pinnedSlice(i, n);
      assert.ok(b > a, `row ${i}/${n} has an empty slice`);
      if (prevEnd !== null) assert.ok(Math.abs(a - prevEnd) < 1e-9, `row ${i}/${n} does not start where row ${i - 1} ended`);
      prevEnd = b;
    }
    const [first] = pinnedSlice(1, n);
    const [, last] = pinnedSlice(n, n);
    // The scene's parts start at −0.05 of a step; its hand-over (OUT) starts at +0.5.
    assert.ok(first >= -0.05 - 1e-9, `the first of ${n} rows starts before the scene's parts do`);
    assert.ok(last < 0.5, `the last of ${n} rows is still arriving when the scene hands over`);
  }
  console.log(`[rows] pinned slices n=3: ${[1, 2, 3].map((i) => pinnedSlice(i, 3).map((x) => x.toFixed(3)).join('→')).join(' | ')}`);
});

test('7 ⏱ an auto run\'s rows arrive one stagger apart on the run\'s own clock, and pause with it', () => {
  const bind = AUTO.find((r) => /--hub-part-in:\s*var\(--hub-in-kf, none\)/.test(r.body));
  assert.ok(bind, 'no auto row rule binds the scene In');
  assert.match(bind!.body, /--hub-part-delay:\s*calc\(var\(--hub-in-at, 0s\) \+ var\(--hub-stagger, 0s\) \* min\(var\(--hub-row-i, 1\), 8\)\)/);
  assert.match(bind!.body, /--hub-part-play:\s*paused/);
  const play = AUTO.filter((r) => /--hub-part-play:\s*running/.test(r.body));
  assert.ok(play.some((r) => /\[data-playing\]/.test(r.selector)), 'rows never resume with the run');
  assert.ok(play.some((r) => /aria-pressed="true"/.test(r.selector)), 'a STOPPED run would hold its rows hidden for good');
  // …and the applying rule is what reads the play state.
  const base = ROW_RULES.find((r) => /^\.hub-seq-parts > \.hub-canvas-body \[data-hub-rows\] > \*$/.test(r.selector));
  assert.ok(base, 'the shared applying rule is gone');
  assert.match(base!.body, /animation-play-state:\s*var\(--hub-part-play, running\)/);
});

test('7 🧱 in a run too, the list\'s own part stands still — its rows arrive instead', () => {
  for (const ctx of [PINNED, AUTO]) {
    const self = ctx.find((r) => pieces(r).some((x) => /> \* > \[data-hub-rows\]$/.test(x)));
    assert.ok(self, 'no list-part reset in a run');
    assert.match(self!.body, /--hub-part-in:\s*none/);
    assert.ok(ctx.some((r) => /:has\(\[data-hub-rows\]\)/.test(r.selector) && /--hub-part-in:\s*none/.test(r.body)), 'no wrapper reset in a run');
  }
  // Specificity: the reset must out-rank the pinned parts rule `.hub-scrub > .hub-seq-parts > … > *:nth-child(n)` (4 classes).
  const self = PINNED.find((r) => pieces(r).some((x) => /> \* > \[data-hub-rows\]$/.test(x)))!;
  const classes = (pieces(self).find((x) => /^\.hub-scrub/.test(x))!.match(/\.[\w-]+|\[[^\]]+\]|:(?!not|has)[\w-]+/g) ?? []).length;
  assert.ok(classes > 4, `the pinned list-part reset (${classes}) does not out-rank the parts' rule (4)`);
});

/* ── THE OBSERVER — the shipped script, run in a fake DOM ────────────────── */

function shippedObserver(): string {
  const file = readFileSync(join(COMPONENTS, 'pahina-motion.tsx'), 'utf8');
  const body = file.slice(file.indexOf('export function PahinaMotionObserver'));
  const m = body.match(/__html: `([\s\S]*?)`,\n/);
  assert.ok(m, 'could not lift the observer script');
  return m![1]!;
}

type Row = {
  classes: Set<string>;
  props: Map<string, string>;
  classList: { add(c: string): void; contains(c: string): boolean };
  style: { setProperty(k: string, v: string): void };
  parentElement: { hasAttribute(a: string): boolean; children: unknown[] };
  tagName: string;
};

function makeRow(inList = true, parent: Row['parentElement'] = { hasAttribute: (a) => inList && a === 'data-hub-rows', children: [] }): Row {
  const classes = new Set<string>();
  const props = new Map<string, string>();
  const row: Row = {
    classes,
    props,
    tagName: 'LI',
    classList: { add: (c) => void classes.add(c), contains: (c) => classes.has(c) },
    style: { setProperty: (k, v) => void props.set(k, v) },
    parentElement: parent,
  };
  parent.children.push(row);
  return row;
}

/** `sizes` lists, each with its own parent — rows in document order. */
function makeLists(sizes: number[]): Row[] {
  return sizes.flatMap((n) => {
    const parent: Row['parentElement'] = { hasAttribute: (a) => a === 'data-hub-rows', children: [] };
    return Array.from({ length: n }, () => makeRow(true, parent));
  });
}

function runObserver(rowCount: number | number[], flag = true) {
  const frame = makeRow(false);
  frame.tagName = 'DIV';
  const rows = makeLists(Array.isArray(rowCount) ? rowCount : [rowCount]);
  const observed: Row[] = [];
  let cb: ((es: Array<{ isIntersecting: boolean; target: Row }>) => void) | null = null;
  const timers: Array<() => void> = [];
  const document = {
    readyState: 'complete',
    documentElement: { classList: { contains: (c: string) => flag && c === 'pahina-js', remove() {}, add() {} } },
    querySelectorAll: (sel: string) =>
      sel.includes('data-hub-rows') ? rows : sel.includes('data-pahina-chapters') ? [makeRow(false)] : [frame],
    addEventListener() {},
  };
  class FakeIO {
    private hub: boolean;
    constructor(fn: typeof cb, opts?: { rootMargin?: string }) {
      // The scenes' observer fires BEFORE a scene enters (a positive bottom
      // margin); the chapters' fires inside the screen — only the first counts.
      this.hub = /^0px 0px \d/.test(opts?.rootMargin ?? '');
      if (this.hub) cb = fn;
    }
    observe(t: Row) { if (this.hub && !observed.includes(t)) observed.push(t); }
    unobserve() {}
  }
  new Function('document', 'window', 'IntersectionObserver', 'console', 'setTimeout', shippedObserver())(
    document, {}, FakeIO, { warn() {} }, (f: () => void) => void timers.push(f),
  );
  return {
    frame, rows, observed,
    reach: (idx: number[]) => cb?.(idx.map((i) => ({ isIntersecting: true, target: rows[i]! }))),
    rerun: () => timers.forEach((f) => f()),
  };
}

test('3 👀 the ONE observer watches every row, and marks only the rows that reach the screen', () => {
  const r = runObserver(6);
  assert.ok(r.observed.includes(r.frame), 'the scene itself is still observed');
  assert.equal(r.observed.filter((o) => o.tagName === 'LI').length, 6, 'not every row is observed');
  r.reach([0, 1]);
  assert.deepEqual(r.rows.map((x) => x.classes.has('pahina-in')), [true, true, false, false, false, false]);
});

test('3 ⭐ rows reaching the screen together are numbered in turn — 1, 2, 3 — and the next batch starts again', () => {
  const r = runObserver(6);
  r.reach([0, 1, 2]);
  assert.deepEqual(r.rows.slice(0, 3).map((x) => x.props.get('--hub-row-at')), ['1', '2', '3']);
  r.reach([3]);
  assert.equal(r.rows[3]!.props.get('--hub-row-at'), '1', 'a row scrolled to on its own waits one stagger, not four');
});

test('3 🔢 the numbering stops at HUB_SEQUENCE_DEPTH — a long list never makes its tail wait for ever', () => {
  const r = runObserver(12);
  r.reach(Array.from({ length: 12 }, (_, i) => i));
  const at = r.rows.map((x) => Number(x.props.get('--hub-row-at')));
  assert.equal(Math.max(...at), HUB_SEQUENCE_DEPTH);
  assert.deepEqual(at.slice(0, HUB_SEQUENCE_DEPTH), Array.from({ length: HUB_SEQUENCE_DEPTH }, (_, i) => i + 1));
});

test('3 🔁 a row already marked is never observed again — re-numbering would replay it', () => {
  const r = runObserver(3);
  r.reach([0]);
  const before = r.observed.length;
  r.observed.length = 0;
  r.rerun(); // the 1.5s pass runs hub() again
  assert.ok(!r.observed.includes(r.rows[0]!), 'a marked row was observed again');
  assert.ok(r.observed.includes(r.rows[1]!), 'an unmarked row was dropped by the re-run');
  assert.ok(before > 0);
});

test('7 🔢 every row is told its place in ITS list — i of n, counted again for the next list', () => {
  const r = runObserver([3, 2]);
  assert.deepEqual(
    r.rows.map((x) => `${x.props.get('--hub-row-i')}/${x.props.get('--hub-row-n')}`),
    ['1/3', '2/3', '3/3', '1/2', '2/2'],
  );
  // Written as it is OBSERVED, before any row is reached — a pinned slice and
  // an auto stagger need it whether or not the row has been seen yet.
  assert.ok(r.rows.every((x) => !x.classes.has('pahina-in')));
});

test('2 🔒 no flag (reduced motion / no IntersectionObserver) → no row is ever marked', () => {
  const r = runObserver(4, false);
  assert.equal(r.observed.length, 0);
  assert.ok(r.rows.every((x) => !x.classes.has('pahina-in')));
});

/* ── THE WIDGETS — the marker on the element whose children are the rows ── */

async function render(file: string, name: string, props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = (await import(join(COMPONENTS, file))) as Record<string, React.FunctionComponent<Record<string, unknown>>>;
  return renderToStaticMarkup(React.createElement(mod[name]!, props));
}

/** The children of the one element carrying `data-hub-rows`, by tag. */
function rowsOf(html: string): { markers: number; tag: string | null; children: string[] } {
  const markers = html.split('data-hub-rows=').length - 1;
  const at = html.indexOf('data-hub-rows=');
  if (at < 0) return { markers, tag: null, children: [] };
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-z]+)/.exec(html.slice(open))![1]!;
  const from = html.indexOf('>', at) + 1;
  const children: string[] = [];
  let depth = 0;
  for (const m of html.slice(from).matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/g)) {
    if (m[1] === '/') {
      if (depth === 0) break;
      depth -= 1;
      continue;
    }
    if (depth === 0) children.push(m[2]!);
    if (m[3] !== '/' && !['br', 'img', 'hr', 'input'].includes(m[2]!)) depth += 1;
  }
  return { markers, tag, children };
}

const block = (i: number) => ({
  block_id: `B${i}`, public_id: `P${i}`, event_id: 'E1', label: `Moment ${i}`, block_type: 'ceremony',
  start_at: `2026-12-12T${String(10 + i).padStart(2, '0')}:00:00Z`, end_at: null, location: null, notes: null,
  is_public: true, sort_order: i, parent_block_id: null, created_at: '2026-01-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null,
});

test('6 📜 the run of show marks its list — every moment is a row', async () => {
  const html = await render('schedule-widget', 'ScheduleWidget', {
    blocks: [1, 2, 3, 4, 5, 6].map(block), eventTz: 'Asia/Manila',
  });
  const r = rowsOf(html);
  console.log(`[rows] schedule markers=${r.markers} tag=${r.tag} rows=${r.children.length}`);
  assert.equal(r.markers, 1);
  assert.equal(r.tag, 'ol');
  assert.deepEqual(r.children, ['li', 'li', 'li', 'li', 'li', 'li']);
});

test('6 📸 photo moments ride the SAME marker — each moment is a row', async () => {
  const html = await render('photo-moments-widget', 'PhotoMomentsWidget', {
    words: {} as never,
    config: { moments: [{ title: 'First kiss' }, { title: 'Cake' }, { title: 'Send-off' }] },
  });
  const r = rowsOf(html);
  console.log(`[rows] photo-moments markers=${r.markers} tag=${r.tag} rows=${r.children.length}`);
  assert.equal(r.markers, 1);
  assert.deepEqual(r.children, ['li', 'li', 'li']);
});

test('6 👗 the dress code\'s roles ride the SAME marker (source: its roles list)', () => {
  const src = readFileSync(join(COMPONENTS, 'dress-code-widget.tsx'), 'utf8');
  assert.match(src, /<ul[^>]*data-dress-code="roles"[^>]*data-hub-rows=""/);
});

test('7 🔒 a Scrub scene’s rows: every rule needs the engine’s mark, `screen` and "no reduced motion" — and only "one part after another" moves a row', () => {
  assert.equal(ENGINE_ROW_RULES.length, 2, 'anti-vacuity: the Scrub row rules were found');
  for (const r of ENGINE_ROW_RULES) {
    assert.ok(r.chain.some((a) => /^@media screen and \(prefers-reduced-motion: ?no-preference\)/.test(a)), `a Scrub row rule reaches print or a guest who asked for less motion: ${r.selector}`);
    for (const sel of r.selector.split(',')) {
      assert.ok(sel.trim().startsWith('.hub-scenes[data-hub-scrub-on] '), `a Scrub row rule applies without the engine: ${sel.trim()}`);
      /* It either STOPS the row (a scene that arrives whole) or asks for "one part after another". */
      assert.ok(/animation:\s*none/.test(r.body) || /\.hub-seq-parts/.test(sel), `a Scrub row moves outside "one part after another": ${sel.trim()}`);
    }
  }
});
