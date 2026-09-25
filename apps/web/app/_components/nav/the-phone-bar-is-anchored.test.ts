/**
 * the-phone-bar-is-anchored.test.ts — 2026-09-25.
 *
 * Owner, testing the iOS app: *"the bottom nav is not fixed."* Reproduced in
 * the simulator at 390–440pt, four things were wrong with the phone's bottom
 * chrome. Three of them are layout, which no source-reading guard can SEE —
 * so these tests render the real components and read the markup they emit.
 *
 *   1 · A BLANK SLOT in the bar. A tab the store shell refuses (Papic) kept
 *       its grid column after its link was hidden. → the bar never draws a
 *       cell it has no tab for, and drops refused tabs itself.
 *   2 · TWO PILLS stacked over the page: the moment strip floated as its own
 *       pill above the bar's pill, content showing between and under them.
 *       → the strip and the bar render in ONE docked container.
 *   3 · NOT ANCHORED: the bar floated 12px above the safe area, 14px in from
 *       each edge, so the page showed beneath it. → the dock is flush to the
 *       bottom edge, edge to edge, and pads the home-indicator inset itself.
 *   (4 · "Event Hub …" truncated — held below too: labels wrap, never clip.)
 *
 * The page's own bottom clearance is held in
 * `app/dashboard/[eventId]/the-page-clears-the-dock.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home, Camera, Compass, Users, Globe } from 'lucide-react';

import { BottomDock, BottomNav, barItemsForShell } from './bottom-nav';
import { SubNav } from './sub-nav';
import type { BottomNavItem } from './types';
import { stripComments } from '@/lib/strip-comments';

/* tsconfig's `"jsx": "preserve"` makes `tsx` compile the components to the
   CLASSIC runtime — a bare `React.createElement` with no import of its own. It
   is only looked up when a component RENDERS, so setting it here, after the
   static imports, is early enough (precedent: `one-stage-at-a-time.test.ts`). */
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const BASE = '/dashboard/S89E-TESTEVENT';

/** The plan-phase roster, as the couple's bar receives it on the WEB. */
const PLAN: BottomNavItem[] = [
  { key: 'home', label: 'Overview', icon: Home, href: BASE, activeMatch: BASE, activeMatchExact: true },
  { key: 'papic', label: 'Papic', icon: Camera, href: `${BASE}/studio/papic`, activeMatch: `${BASE}/studio/papic` },
  { key: 'explore', label: 'Your Team', icon: Compass, href: `${BASE}/vendors`, activeMatch: `${BASE}/vendors` },
  { key: 'guests', label: 'Guests', icon: Users, href: `${BASE}/guests`, activeMatch: `${BASE}/guests` },
  { key: 'launch', label: 'Event Hub Controller', icon: Globe, href: `${BASE}/launch`, activeMatch: `${BASE}/launch` },
];

const bar = (items: BottomNavItem[]) => renderToStaticMarkup(createElement(BottomNav, { items }));

/** The grid's declared column count and the cells actually drawn in it. */
function gridOf(html: string): { columns: number; cells: number; labels: string[] } {
  const cols = /grid-template-columns:repeat\((\d+), minmax\(0, 1fr\)\)/.exec(html);
  assert.ok(cols, 'the bar no longer declares its column count — this guard cannot read the grid');
  const cells = html.match(/<li>/g) ?? [];
  const labels = [...html.matchAll(/<a [^>]*href="[^"]*"[^>]*>[\s\S]*?<span class="line-clamp-2[^"]*"[^>]*>([^<]*)<\/span>/g)].map(
    (m) => m[1]!,
  );
  return { columns: Number(cols[1]), cells: cells.length, labels };
}

/* ══ 1 · NO EMPTY SLOT ═══════════════════════════════════════════════════ */

test('🕳 the bar declares exactly one column per tab it draws, and every tab has a label', () => {
  for (const items of [PLAN, PLAN.slice(0, 4), PLAN.slice(0, 3)]) {
    const g = gridOf(bar(items));
    assert.equal(g.cells, items.length, `drew ${g.cells} cells for ${items.length} tabs`);
    assert.equal(
      g.columns,
      g.cells,
      `${g.columns} grid columns for ${g.cells} tabs — a column with no tab is the blank slot`,
    );
    assert.deepEqual(g.labels, items.map((i) => i.label), 'a drawn tab lost its label');
  }
});

test('🕳 in the store shell a refused tab is DROPPED before the grid is sized (both ways)', () => {
  const web = barItemsForShell(PLAN, false);
  const app = barItemsForShell(PLAN, true);
  assert.equal(web.length, 5, 'the web bar must keep Papic — otherwise this proves nothing');
  assert.deepEqual(
    app.map((i) => i.key),
    ['home', 'explore', 'guests', 'launch'],
    'the store-shell bar should be the web bar minus the refused Papic tab',
  );
  // …and what is left lays out as a FOUR-column bar: the tabs re-spread.
  const g = gridOf(bar(app));
  assert.equal(g.columns, 4);
  assert.equal(g.cells, 4);
});

/* ══ 2 · ONE DOCK: THE STRIP AND THE BAR TOGETHER ═══════════════════════ */

const STRIP_ITEMS = [
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'hosts', label: 'Hosts', icon: Users },
  { key: 'launch', label: 'Event Hub Controller', icon: Globe },
];

function docked(): string {
  return renderToStaticMarkup(
    createElement(
      BottomDock,
      null,
      createElement(SubNav, { items: STRIP_ITEMS, activeKey: 'launch', onSelect: () => {} }),
      createElement(BottomNav, { items: PLAN }),
    ),
  );
}

/** The opening tag of the first element carrying `marker`. */
function tagWith(html: string, marker: string): string {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, `no element carries ${marker}`);
  const open = html.lastIndexOf('<', i);
  return html.slice(open, html.indexOf('>', i) + 1);
}

test('⚓ the moment strip and the bar render inside ONE docked container, strip on top', () => {
  const html = docked();
  const docks = html.match(/data-bottom-dock="true"/g) ?? [];
  assert.equal(docks.length, 1, `${docks.length} docks — a bar that wrapped itself again inside a dock, or none`);

  const dockAt = html.indexOf('data-bottom-dock');
  const stripAt = html.indexOf('role="tablist"');
  const barAt = html.indexOf('aria-label="Primary navigation"');
  assert.ok(stripAt > dockAt && barAt > dockAt, 'the strip or the bar is outside the dock');
  assert.ok(stripAt < barAt, 'the strip must sit ABOVE the bar — first in the dock');

  // Neither row positions itself: the DOCK is the one fixed box. A `fixed`
  // row is a second floating pill, which is the defect.
  for (const marker of ['role="tablist"', 'aria-label="Primary navigation"']) {
    const tag = tagWith(html, marker);
    assert.doesNotMatch(tag, /\bfixed\b/, `${marker} positions itself: ${tag}`);
    assert.doesNotMatch(tag, /\brounded-full\b/, `${marker} is still drawn as its own pill: ${tag}`);
  }
});

test('⚓ a bar mounted WITHOUT a dock docks itself (vendor and admin bars are anchored too)', () => {
  const html = bar(PLAN);
  assert.equal((html.match(/data-bottom-dock="true"/g) ?? []).length, 1);
  assert.ok(html.indexOf('data-bottom-dock') < html.indexOf('aria-label="Primary navigation"'));
});

/* ══ 3 · ANCHORED: FLUSH TO THE EDGE, SAFE AREA INSIDE ══════════════════ */

test('⚓ the dock is flush to the bottom edge, edge to edge, and pads the home indicator itself', () => {
  const tag = tagWith(docked(), 'data-bottom-dock');
  for (const cls of ['fixed', 'inset-x-0', 'bottom-0', 'lg:hidden']) {
    assert.match(tag, new RegExp(`class="[^"]*(?<![\\w-])${cls.replace(':', '\\:')}(?![\\w-])`), `dock lost ${cls}: ${tag}`);
  }
  assert.match(tag, /padding-bottom:env\(safe-area-inset-bottom\)/, `dock no longer pads the safe area: ${tag}`);
  // The floating geometry must not come back: no inset from the sides, no
  // lift off the bottom edge, no pill.
  assert.doesNotMatch(tag, /left-\[14px\]|right-\[14px\]|inset-x-\[14px\]/, `dock is inset from the edges: ${tag}`);
  assert.doesNotMatch(tag, /bottom-\[calc/, `dock floats above the bottom edge: ${tag}`);
  assert.doesNotMatch(tag, /rounded-full/, `dock is a pill: ${tag}`);
});

/* ══ 4 · LABELS FIT ══════════════════════════════════════════════════════ */

test('✂ a bar or strip label wraps onto a second line, never an ellipsis', () => {
  const html = docked();
  const labelTags = [...html.matchAll(/<span class="([^"]*)"[^>]*>Event Hub Controller<\/span>/g)];
  assert.equal(labelTags.length, 2, `expected the label in the strip AND the bar, saw ${labelTags.length}`);
  for (const [, cls] of labelTags) {
    assert.match(cls!, /\bline-clamp-2\b/, `a label is not allowed a second line: ${cls}`);
    assert.doesNotMatch(cls!, /\btruncate\b|\bwhitespace-nowrap\b/, `a label still truncates: ${cls}`);
  }
});

/* ══ 5 · THE EVENT LAYOUT MOUNTS THEM IN ONE DOCK ════════════════════════ */

test('⚓ the event layout mounts the strip and the bar inside one <BottomDock>, both told the shell', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'layout.tsx'), 'utf8'),
  );
  const open = src.indexOf('<BottomDock>');
  const close = src.indexOf('</BottomDock>');
  assert.ok(open >= 0 && close > open, 'the event layout no longer mounts a <BottomDock>');
  assert.equal(src.split('<BottomDock>').length - 1, 1, 'more than one dock in the event layout');
  const inside = src.slice(open, close);
  for (const el of ['<CustomerSectionSubnav', '<CustomerBottomNav']) {
    assert.ok(inside.includes(el), `${el} is mounted outside the dock — it floats on its own again`);
    const outside = src.slice(0, open) + src.slice(close);
    assert.ok(!outside.includes(el), `${el} is mounted a second time outside the dock`);
  }
  assert.ok(
    inside.indexOf('<CustomerSectionSubnav') < inside.indexOf('<CustomerBottomNav'),
    'the strip must come first in the dock — it sits above the bar',
  );
  assert.equal(
    (inside.match(/storeShell=\{storeShell\}/g) ?? []).length,
    2,
    'both the strip and the bar must be told the store shell, or one of them offers refused doors',
  );
});
