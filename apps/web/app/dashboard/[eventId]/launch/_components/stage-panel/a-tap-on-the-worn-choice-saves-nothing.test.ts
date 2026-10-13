/**
 * A TAP ON THE CHOICE ALREADY WORN SAVES NOTHING — rendered, then each control's own tap handler pressed.
 *
 * 🚨 Seen on the batch-3 walk (2026-10-13, Maker lab, Chromium + WebKit): tapping the Background tile that is ALREADY
 * picked — Plain on Announcements, None on What to wear — wrote an empty `block_looks:{}` into the draft and put an
 * ↺ step on the bar that changed nothing. `BlockGroundRows` called its save on every tap. The same shape stood on
 * every toolbar tile that hands its tap straight to a save: the RSVP card's three tiles, the scene Background
 * strip, every one-choice dropdown (`Dd` — Movement, Plays, Rows, Leaves, Comes in from …) and Animate's two pill
 * selectors (While on screen · Size).
 *
 * There is no DOM in this suite. So this renders each control to markup and, while it renders, keeps the props
 * React was handed for the pressable things (a tile `<button>`, the `PickMenu` a `Dd` wraps, a `PillSelector`) —
 * then calls THAT element's own `onClick` / `onPick`, as a tap does, and counts the saves that reach the caller.
 * The worn choice must reach nothing; another choice must reach exactly one save (so a control that saved NOTHING
 * at all could not pass either).
 *
 * The cover lines' and scenes' own save (`element-sheet.tsx` `commit`) is asserted at the end on its source: it is
 * one condition in a 1,000-line sheet with server actions behind it, too heavy to render here.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

/* 🪤 `server-only` is Next's, not an installed package; `next/navigation`'s router needs a mounted app router; the
   Maker's context is stood in with one event and no kept looks. Same shim shape as a-tap-on-the-row-flips-the-switch. */
const maker = { eventId: '00000000-0000-4000-8000-000000000001', lookPages: { blocks: {} as Record<string, unknown> } };
{
  const Mod = createRequire(import.meta.url)('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    const real = load.call(this, request, ...rest) as Record<string, unknown>;
    if (request === 'next/navigation') return { ...real, useRouter: () => ({ refresh() {}, push() {}, replace() {} }) };
    if (/(^|\/)maker-context$/.test(request)) return { ...real, useMaker: () => maker };
    return real;
  };
}

/* Every element React is asked to make, kept with its props while one render runs. */
type Made = { type: unknown; props: Record<string, unknown> };
let made: Made[] = [];
const ReactShim = {
  ...React,
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => {
    made.push({ type, props: props ?? {} });
    return (React.createElement as (...a: unknown[]) => unknown)(type, props, ...children);
  },
};
// 🪤 tsconfig `jsx: preserve` → tsx compiles JSX to `React.createElement`, so React must be global BEFORE import.
(globalThis as unknown as { React: unknown }).React = ReactShim;

async function render(node: unknown): Promise<Made[]> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  made = [];
  renderToStaticMarkup(node as React.ReactElement);
  return made;
}
const h = (type: unknown, props: Record<string, unknown>) => (ReactShim.createElement as (t: unknown, p: unknown) => unknown)(type, props);
const tile = (els: Made[], attr: string, key: string) => {
  const el = els.find((e) => e.type === 'button' && e.props[attr] === key);
  assert.ok(el, `no tile ${attr}="${key}" was drawn — the control changed shape; find its tiles again`);
  return el.props.onClick as () => void;
};

test('RSVP card Background — the worn tile saves nothing; another saves once', async () => {
  const { RsvpCardGroundRows } = await import('../rsvp-line-look');
  for (const [now, worn] of [[null, 'plain'], ['frost', 'frost'], ['none', 'none']] as const) {
    const saves: unknown[] = [];
    const els = await render(h(RsvpCardGroundRows, { now, onPick: (g: unknown) => saves.push(g) }));
    tile(els, 'data-rsvp-card-tile', worn)();
    assert.deepEqual(saves, [], `a tap on ${worn} — already worn — saved ${JSON.stringify(saves)}`);
    tile(els, 'data-rsvp-card-tile', worn === 'frost' ? 'none' : 'frost')();
    assert.equal(saves.length, 1, 'a tap on ANOTHER tile must save once');
  }
});

test('A block’s Background (Announcements, What to wear) — the worn tile writes no draft and no ↺ step', async () => {
  /* The save is seen where it begins: `saveWhole` shows the look on the canvas first (`document.querySelector` on the
     shown frame). Nothing else in a server render asks the document. */
  const asked: string[] = [];
  (globalThis as unknown as { document: unknown }).document = { querySelector: (s: string) => (asked.push(s), null) };
  (globalThis as unknown as { window: unknown }).window = { location: { origin: 'http://lab' }, dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} };
  try {
    const { BlockGroundRows } = await import('./block-background');
    const { blockGroundToday } = await import('@/lib/block-looks');
    for (const block of ['announcements', 'look'] as const) {
      maker.lookPages.blocks = {};
      const els = await render(h(BlockGroundRows, { block }));
      const today = blockGroundToday(block, null);
      asked.length = 0;
      tile(els, 'data-block-ground-tile', today)();
      assert.deepEqual(asked, [], `${block}: a tap on ${today} (already worn, nothing kept) began a save`);
      /* A server render has no transitions: the save's own `start` throws once it is reached — after the canvas. */
      try {
        tile(els, 'data-block-ground-tile', 'frost')();
      } catch {
        /* reached the save */
      }
      assert.ok(asked.length > 0, `${block}: a tap on Frosted must begin a save`);
      /* …and a kept Frosted is the worn one then. */
      maker.lookPages.blocks = { [block]: { g: 'frost' } };
      const kept = await render(h(BlockGroundRows, { block }));
      asked.length = 0;
      tile(kept, 'data-block-ground-tile', 'frost')();
      assert.deepEqual(asked, [], `${block}: a tap on the kept Frosted began a save`);
    }
  } finally {
    maker.lookPages.blocks = {};
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { window?: unknown }).window;
  }
});

test('Scene Background strip — the worn tile saves nothing; another saves once', async () => {
  const { StageBackground } = await import('./stage-background');
  const saves: string[] = [];
  const els = await render(
    h(StageBackground, {
      source: 'colour',
      sources: [{ key: 'colour', pro: false }],
      onSource() {},
      tiles: [
        { key: 'cream', name: 'Cream' },
        { key: 'glass', name: 'Glass' },
      ],
      tile: 'cream',
      onTile: (k: string) => saves.push(k),
      onUpload: false,
      upload: null,
      colour: null,
      customColour: () => null,
      opacity: null,
      shade: null,
      shape: null,
      onShape() {},
      motion: null,
      onMotion() {},
      pending: false,
    }),
  );
  tile(els, 'data-stage-bg-tile', 'cream')();
  assert.deepEqual(saves, [], 'a tap on the worn tile saved');
  tile(els, 'data-stage-bg-tile', 'glass')();
  assert.deepEqual(saves, ['glass']);
});

test('A one-choice dropdown (Dd) — picking what it shows saves nothing; a ✓ list still ticks the ticked one off', async () => {
  const { Dd } = await import('./kit');
  const { PickMenu } = await import('../../../website/editor/_components/pick-menu');
  const options = [
    { key: 'calm', label: 'Calm' },
    { key: 'lively', label: 'Lively' },
  ];
  const menuOf = (els: Made[]) => {
    const m = els.find((e) => e.type === PickMenu);
    assert.ok(m, 'Dd no longer draws a PickMenu');
    return m.props.onPick as (k: string) => void;
  };
  const one: string[] = [];
  menuOf(await render(h(Dd, { small: 'Movement', label: 'Movement', data: 'm', value: 'calm', options, onPick: (k: string) => one.push(k) })))('calm');
  assert.equal(one.length, 0, 'picking the shown choice saved');
  menuOf(await render(h(Dd, { small: 'Movement', label: 'Movement', data: 'm', value: 'calm', options, onPick: (k: string) => one.push(k) })))('lively');
  assert.deepEqual(one, ['lively']);
  const ticks: string[] = [];
  menuOf(await render(h(Dd, { small: 'Show', label: 'Show', data: 's', value: 'calm', picked: ['calm'], options, onPick: (k: string) => ticks.push(k) })))('calm');
  assert.deepEqual(ticks, ['calm'], 'a ✓ list must still hear a tap on a ticked row (it unticks it)');
});

test('Animate — While on screen and Size: the worn pill saves nothing; the other saves once', async () => {
  const { StageAnimate } = await import('./stage-animate');
  const { PillSelector } = await import('@/app/_components/pill-selector');
  const pill = (els: Made[], data: string) => {
    const p = els.find((e) => e.type === PillSelector && e.props.data === data);
    assert.ok(p, `no PillSelector data="${data}" was drawn`);
    return p.props.onPick as (k: string) => void;
  };
  const base = { move: { in: null, out: null }, inFx: null, outFx: null, onIn() {}, onOut() {} };
  /* Action's row is drawn when the toolbar's phase is Action — the store's own setter, taken from its own hook. */
  const { useAnimatePhase } = await import('./store');
  let setPhase: ((p: 'in' | 'act' | 'out') => void) | null = null;
  await render(h(function Grab() {
    setPhase = useAnimatePhase()[1];
    return null;
  }, {}));
  assert.ok(setPhase, 'useAnimatePhase handed no setter');
  (setPhase as (p: 'in' | 'act' | 'out') => void)('act');
  const does: string[] = [];
  const actEls = await render(
    h(StageAnimate, { ...base, does: { value: 'still', options: [{ key: 'still', label: 'Still' }, { key: 'drift', label: 'Drift' }], onPick: (k: string) => does.push(k) } }),
  );
  pill(actEls, 'does')('still');
  assert.deepEqual(does, [], 'While on screen: the worn Still saved');
  pill(actEls, 'does')('drift');
  assert.deepEqual(does, ['drift']);
  (setPhase as (p: 'in' | 'act' | 'out') => void)('in');
  const fx: unknown[] = [];
  const inEls = await render(h(StageAnimate, { ...base, only: 'in', inFx: { size: 'grow' }, onIn: (f: unknown) => fx.push(f), does: null }));
  pill(inEls, 'in-size')('grow');
  assert.deepEqual(fx, [], 'Size: the worn Grow saved');
  pill(inEls, 'in-size')('shrink');
  assert.equal(fx.length, 1, 'Size: Shrink must save once');
});

test('The cover lines’ and scenes’ one save (element-sheet commit) returns before saving a canvas that did not change', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'), 'utf8'));
  const commit = src.slice(src.indexOf('const commit = ('), src.indexOf('start(async', src.indexOf('const commit = (')));
  assert.ok(commit.length > 100, 'commit() not found in element-sheet.tsx');
  const same = commit.search(/if \(JSON\.stringify\(next\) === JSON\.stringify\(before\)\) return;/);
  assert.ok(same > 0, 'commit() no longer returns on an unchanged canvas');
  assert.ok(same < commit.indexOf('onPreview?.('), 'the unchanged-canvas return must come BEFORE the canvas is redrawn and the save starts');
});
