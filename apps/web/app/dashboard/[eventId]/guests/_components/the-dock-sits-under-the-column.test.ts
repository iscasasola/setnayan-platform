/**
 * GUARD — from 701 the Guests dock's left and right edges ARE the reading column's, at every width, and stay so when
 * the column moves without the window resizing.
 *
 * Owner 2026-10-20, a screenshot of the live desktop Guests page: *"is the desktop view done fixing?"* — the list was
 * centred in its column while the dock (Expand all · Select · Search or add · Role) ran from the stage's left edge,
 * wider than the list and not under it. Approved design: DECISION_LOG 2026-10-19 "APPROVED — COUPLE DASHBOARD DESKTOP +
 * TABLET" (the dock stays pinned at the bottom; the page keeps its reading column, 48 rem — the Map's wide stage 64 rem).
 *
 * The property is a LAYOUT fact and no unit test lays out, so it is held in its three parts, each by behaviour or by
 * the one rule that carries it:
 *   1. `followColumn` writes the edges of the box it is GIVEN (never its parent's, the stage), at every width, and
 *      re-reads them when the column or its stage changes size — the owner's picture was a measurement taken once.
 *   2. From 701 the dock's CSS turns exactly those two numbers into its left and right, and adds nothing that would
 *      move an edge (a width, a margin, an inset).
 *   3. The screen hands `followColumn` the column itself — the element that wears `.screen`, which carries the cap.
 * Walked in the lab (`/dev/guests-lab?part=screen&shell=1`, List + Map, 1000 · 1180 · 1280 · 1440 · 1920, Chromium +
 * WebKit, with a simulated card column opening and closing): dock − column = 0 / 0 at every width, after the fix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { followColumn } from './dock-follows-column';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

// ── A tiny layout: the window, the rail (72-px strip 701–1279, 240 from 1280), the stage's gutter, a capped centred
//    column, and an optional card column beside the list (the inspector) that takes width from the stage.
type Rect = { left: number; right: number; width: number };
function layout(vw: number, cap: number, card = 0): { stage: Rect; column: Rect } {
  const rail = vw >= 1280 ? 240 : 72;
  const gutter = vw >= 1024 ? 32 : 24;
  const sLeft = rail + gutter;
  const sRight = vw - gutter - card;
  const width = Math.min(cap, sRight - sLeft);
  const left = sLeft + (sRight - sLeft - width) / 2;
  return { stage: { left: sLeft, right: sRight, width: sRight - sLeft }, column: { left, right: left + width, width } };
}

// ── Fakes for exactly what `followColumn` touches: the box it measures, its parent's box, the viewport width, the
//    ResizeObserver it starts and the window's resize event.
function harness(vw: number, cap: number) {
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, window: g.window, ResizeObserver: g.ResizeObserver };
  const state = { vw, card: 0 };
  const observed = new Set<unknown>();
  const callbacks: Array<() => void> = [];
  const listeners: Array<() => void> = [];
  const vars = new Map<string, string>();
  const parent = { getBoundingClientRect: () => layout(state.vw, cap, state.card).stage };
  const column = {
    parentElement: parent,
    getBoundingClientRect: () => layout(state.vw, cap, state.card).column,
    style: { setProperty: (k: string, v: string) => vars.set(k, v) },
  };
  const docEl = {
    get clientWidth() {
      return state.vw;
    },
  };
  g.document = { documentElement: docEl };
  g.window = {
    addEventListener: (t: string, fn: () => void) => t === 'resize' && listeners.push(fn),
    removeEventListener: () => {},
  };
  g.ResizeObserver = class {
    private cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
      callbacks.push(() => this.cb());
    }
    observe(el: unknown) {
      observed.add(el);
    }
    disconnect() {}
  };
  const restore = () => Object.assign(g, saved);
  const px = (k: string) => Number((vars.get(k) ?? 'NaN').replace('px', ''));
  // The dock's edges as the ≥701 CSS draws them: left = --gs-left, right edge = viewport − --gs-right.
  const dock = () => ({ left: px('--gs-left'), right: state.vw - px('--gs-right') });
  const col = () => layout(state.vw, cap, state.card).column;
  return { state, observed, callbacks, listeners, column, parent, docEl, restore, dock, col };
}

const WIDTHS = [701, 820, 1000, 1024, 1180, 1279, 1280, 1366, 1440, 1920, 2560];
const CAPS: Array<[string, number]> = [
  ['the List (reading column, 48 rem)', 768],
  ['the Map (wide stage, 64 rem)', 1024],
];

for (const [label, cap] of CAPS) {
  test(`${label}: the dock's edges are the column's at every width from 701`, () => {
    for (const vw of WIDTHS) {
      const h = harness(vw, cap);
      try {
        const stop = followColumn(h.column as unknown as HTMLElement);
        assert.deepEqual(h.dock(), { left: h.col().left, right: h.col().right }, `at ${vw}px the dock is not under the column`);
        stop();
      } finally {
        h.restore();
      }
    }
  });

  test(`${label}: the dock follows the column when a card column opens and closes beside the list (no window resize)`, () => {
    for (const vw of [1280, 1440, 1920]) {
      const h = harness(vw, cap);
      try {
        followColumn(h.column as unknown as HTMLElement);
        assert.ok(h.observed.has(h.parent), 'the stage (the column’s parent) is not watched — the column moves when it narrows');
        assert.ok(h.observed.has(h.column), 'the column itself is not watched');
        for (const card of [440, 0]) {
          h.state.card = card;
          h.callbacks.forEach((cb) => cb()); // what a ResizeObserver reports when the stage changes size
          assert.deepEqual(h.dock(), { left: h.col().left, right: h.col().right }, `at ${vw}px with a ${card}-px card the dock stayed behind`);
        }
      } finally {
        h.restore();
      }
    }
  });

  test(`${label}: the dock follows the column across a window resize (rail 72 → 240 at 1280)`, () => {
    const h = harness(1180, cap);
    try {
      followColumn(h.column as unknown as HTMLElement);
      for (const vw of [1279, 1280, 1920, 701]) {
        h.state.vw = vw;
        h.listeners.forEach((fn) => fn());
        assert.deepEqual(h.dock(), { left: h.col().left, right: h.col().right }, `after resizing to ${vw}px the dock is not under the column`);
      }
    } finally {
      h.restore();
    }
  });
}

test('from 701 the dock CSS draws exactly the column edges and nothing that moves them', () => {
  const css = read('guests-screen.module.css');
  const blocks = [...css.matchAll(/@media \(min-width: 701px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
  const lower = blocks
    .map((b) => /(?:^|\n)\s*\.lower \{([^}]*)\}/.exec(b)?.[1])
    .filter((x): x is string => typeof x === 'string');
  assert.equal(lower.length, 1, `expected ONE ≥701 rule for the dock (.lower), found ${lower.length}`);
  const rule = lower[0]!;
  assert.match(rule, /\bleft:\s*var\(--gs-left\b/, 'from 701 the dock’s left is not the column’s left');
  assert.match(rule, /\bright:\s*var\(--gs-right\b/, 'from 701 the dock’s right is not the column’s right');
  assert.doesNotMatch(rule, /(?:^|[\s;])(?:width|max-width|min-width|margin[a-z-]*|inset[a-z-]*):/, 'the ≥701 dock rule sets a width/margin/inset that moves an edge off the column');
  // No OTHER rule anywhere re-sizes the dock (a later `.lower { max-width … }` would win over the edges).
  for (const m of css.matchAll(/(^|\n)([^{}\n]*\.lower\b[^{}\n]*)\{([^}]*)\}/g)) {
    if (/\.lower\s*>|\.lower\s+\S/.test(m[2]!)) continue; // a child of the dock, not the dock
    assert.doesNotMatch(m[3]!, /(?:^|[\s;])(?:width|max-width|min-width|margin[a-z-]*):/, `"${m[2]!.trim()}" sizes the dock`);
  }
});

test('the screen hands followColumn the column itself — the element that wears .screen (the cap)', () => {
  const src = read('guests-screen.tsx');
  assert.match(src, /followColumn\(\s*root\s*\)/, 'the screen no longer pins its dock to the column');
  assert.match(src, /const root = rootRef\.current;\s*return root \? followColumn\(root\)/, 'followColumn is not handed the screen root');
  assert.match(src, /ref=\{rootRef\}\s*className=\{styles\.screen\}/, 'rootRef is not the `.screen` column');
  assert.doesNotMatch(src, /parentElement[^;\n]*getBoundingClientRect|getBoundingClientRect[^;\n]*parentElement/, 'the dock is measured off a parent again');
  // The dock is drawn inside the column (its CSS vars are inherited from it).
  const root = src.indexOf('ref={rootRef}');
  const dock = src.indexOf('data-guests-thumb=""');
  assert.ok(root > 0 && dock > root, 'the dock is not inside the column that carries its edges');
});
