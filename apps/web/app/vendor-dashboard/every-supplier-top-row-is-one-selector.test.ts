/**
 * every-supplier-top-row-is-one-selector.test.ts — 🎛 EVERY SUPPLIER TOP ROW IS ONE SELECTOR + THE ONE DOOR + ⚙.
 *
 * Owner 2026-10-30, *"i notices all the top selectors having different designs on different pages. can we make a clean
 * selector that applies to all?"* → *"all yes"* (DECISION_LOG "ONE SELECTOR FOR EVERY PAGE — COUPLE · SUPPLIER · ADMIN";
 * `carry-2026-10-30/one-selector/NOTES.md` § 5). Sequencing, owner the same night: *"the fix for selector can be built
 * with their respective dashboards"* — this is the supplier slice, riding the v13 supplier dashboard.
 *
 * Held as PROPERTIES over every file under `app/vendor-dashboard/` that draws a top row (`data-first-row` /
 * `data-pinned-row`, plus the known top-row components named below):
 *   1 · its LEFT is the one selector: the shared compact `PickMenu` worn as `Page · View ▾`, or — a page with no
 *       choices — the shared WORD (`PinWord`). Never a local trigger or look on the PickMenu;
 *   2 · NO segmented control (ISegmented / PillTrack / PillButton / PillLink / role="tablist" / the segmented classes);
 *   3 · NO hand-drawn count tile: the fold-door mark `data-pin-door` is written by ONE file in the whole app,
 *       `app/_components/pinned-row/pin-door.tsx` (`PinDoor`) — every supplier count and figure, and the People row,
 *       draw that door (Q3: "number + word, underlined when it filters");
 *   4 · on what RENDERS: Today's row is `Today` · the three doors · ⚙ at the right end, no tile fill.
 * A row the owner keeps as an exception is ONE reasoned line in `every-supplier-top-row-is-one-selector.baseline.txt` —
 * never a weakened check; a baseline line whose file no longer breaks the rule fails too (it must be deleted).
 *
 * Sabotage (2026-10-31, each run and reverted, each RED): `buttonText={CUSTOMER_SEGMENT_LABEL[seg]}` back in
 * customers-pin (1) · `<PillTrack` back in manager-tabs (2) · a hand-drawn `data-pin-door=""` tile in today-counts (3+4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const SUPPLIER = join(WEB, 'app', 'vendor-dashboard');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(WEB, p).split('\\').join('/');
const src = (p: string) => stripComments(readFileSync(p, 'utf8'));

/** Top-row components that carry no `data-first-row` mark of their own (the row is drawn around them). */
const KNOWN_TOP_ROWS = [
  'app/vendor-dashboard/_components/supplier-page-menu.tsx', // the shell bar's left from 701
  'app/vendor-dashboard/services/_components/manager-tabs.tsx', // Shop › Services: the manager's section switch
  'app/vendor-dashboard/on-the-day/_components/hub-screen.tsx', // Hub: Set up · Crew · The event's pages
];

const BASELINE = new Map(
  readFileSync(join(HERE, 'every-supplier-top-row-is-one-selector.baseline.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [path, reason] = l.split(' — ');
      return [path!.trim(), (reason ?? '').trim()] as const;
    }),
);

const SEGMENTED = /<ISegmented\b|<ISeg\b|<PillTrack\b|<PillButton\b|<PillLink\b|role="tablist"|I_SEGMENTED_CLASS|PILL_TRACK_CLASS|pillSegClass\(|iSegClass\(/;
/** Each `<PickMenu …/>` element's own props (to its self-closing `/>` — an option's `=>` never ends it). */
const pickMenus = (code: string) =>
  [...code.matchAll(/<PickMenu\b/g)].map((m) => code.slice(m.index!, code.indexOf('/>', m.index!) + 2));
const PAGE_VIEW = /buttonText=\{(?:`[A-Z][\w ]* · \$\{[^`]+`|face)\}/;
const isOneSelector = (code: string) =>
  /<PinWord\b/.test(code) || pickMenus(code).some((p) => PAGE_VIEW.test(p) && /\bcompact\b/.test(p));
const hasLocalLook = (code: string) => pickMenus(code).some((p) => /\b(?:trigger|className)=/.test(p));

const ALL = walk(SUPPLIER).map((p) => ({ path: rel(p), code: src(p) }));
const TOP_ROWS = ALL.filter((f) => /data-first-row=""|data-pinned-row=""/.test(f.code) || KNOWN_TOP_ROWS.includes(f.path));

/** What is wrong with a top-row file, in words — empty = it holds. */
function faults(code: string): string[] {
  const out: string[] = [];
  if (!isOneSelector(code)) out.push('its left is not the one selector (`Page · View ▾` compact PickMenu, or PinWord)');
  if (hasLocalLook(code)) out.push('its PickMenu wears a local trigger/className');
  if (SEGMENTED.test(code)) out.push('it draws a segmented control');
  if (/data-pin-door=/.test(code)) out.push('it hand-draws a count door/tile (`data-pin-door`) instead of PinDoor');
  return out;
}

test('0 · the walk finds the supplier top rows it is meant to hold', () => {
  const paths = TOP_ROWS.map((f) => f.path);
  for (const must of [
    'app/vendor-dashboard/_components/today-counts.tsx',
    'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
    'app/vendor-dashboard/customers/_components/customers-pin.tsx',
    'app/vendor-dashboard/shop/_components/shop-segments.tsx',
    ...KNOWN_TOP_ROWS,
  ]) assert.ok(paths.includes(must), `${must} is not walked — the guard would be blind to it`);
});

test('1–3 · every supplier top row: the one selector on the left, no segmented row, no hand-drawn tile', () => {
  const bad: string[] = [];
  for (const f of TOP_ROWS) {
    const why = faults(f.code);
    if (why.length && !BASELINE.has(f.path)) bad.push(`${f.path}: ${why.join('; ')}`);
  }
  assert.deepEqual(bad, [], `supplier top rows off the one selector:\n${bad.join('\n')}`);
});

test('baseline · every exception is reasoned, and still an exception (a fixed row leaves the list)', () => {
  for (const [path, reason] of BASELINE) {
    assert.ok(reason.length > 20, `${path}: an exception with no reason`);
    const f = TOP_ROWS.find((x) => x.path === path);
    assert.ok(f, `${path} is in the baseline but is not a supplier top row — delete the line`);
    assert.ok(faults(f!.code).length > 0, `${path} now holds the rule — delete its baseline line`);
  }
});

test('3 · ONE door in the whole app writes the fold-door mark — PinDoor; the People row draws it too', () => {
  const app = walk(join(WEB, 'app')).map((p) => ({ path: rel(p), code: src(p) }));
  const writers = app.filter((f) => /data-pin-door=/.test(f.code)).map((f) => f.path);
  assert.deepEqual(writers, ['app/_components/pinned-row/pin-door.tsx'], `more than one file draws a count door: ${writers.join(', ')}`);
  const row = app.find((f) => f.path === 'app/_components/pinned-row/pinned-row.tsx')!.code;
  assert.match(row, /<PinDoor\b/, 'PinnedRow (People) no longer draws the shared door');
  for (const f of ['customers/_components/customers-figures.tsx', '_components/pin-figures.tsx', 'customers/_components/customers-pin.tsx', '_components/today-counts.tsx']) {
    assert.match(src(join(SUPPLIER, f)), /<PinDoor\b/, `${f} does not draw its counts with PinDoor`);
  }
});

test('1 · Customers and Shop say `Page · View ▾` — the page word on the phone too', () => {
  assert.match(src(join(SUPPLIER, 'customers/_components/customers-pin.tsx')), /buttonText=\{`Customers · \$\{CUSTOMER_SEGMENT_LABEL\[seg\]\}`\}/);
  assert.match(src(join(SUPPLIER, 'shop/_components/shop-segments.tsx')), /buttonText=\{`Shop · \$\{SHOP_SEGMENT_LABEL\[on\]\}`\}/);
});

test('4 · Today RENDERS `Today` · three doors · ⚙ at the right end — no tile fill', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TodayCounts } = await import('./_components/today-counts');
  const html = renderToStaticMarkup(
    React.createElement(TodayCounts, {
      waiting: '3',
      waitingNow: true,
      thisWeek: '2',
      toComeIn: null,
      panels: { waiting: 'w', week: 'k', money: 'm' },
      gear: React.createElement('span', { 'data-menu-settings': 'today' }),
    }),
  );
  const row = html.slice(html.indexOf('data-today-numbers'), html.indexOf('today-list-waiting" data-today-list'));
  const word = row.indexOf('data-today-word');
  const doors = [...row.matchAll(/data-today-number="(\w+)"[^>]*data-pin-door=""/g)].map((m) => m[1]);
  assert.ok(word > 0 && word < row.indexOf('data-today-number='), 'the row does not start with the word "Today"');
  assert.match(row.slice(word), /^[^>]*>Today</, 'the word is not "Today"');
  assert.deepEqual(doors, ['waiting', 'week', 'money'], 'the three doors are not the shared door, in order');
  assert.ok(row.lastIndexOf('data-pin-door') < row.indexOf('data-menu-settings="today"'), 'the ⚙ is not at the right end');
  assert.doesNotMatch(row, /bg-sn-accent|text-\[20px\]/, 'a count is drawn as the old round tile');
  assert.match(row, /couldn’t load/, 'an unread count does not say so');
});
