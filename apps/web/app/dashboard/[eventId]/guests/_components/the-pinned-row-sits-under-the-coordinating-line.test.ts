/**
 * 🗂 THE GUESTS ROW SITS UNDER THE COORDINATOR'S LINE, NEVER OVER IT (bug, 27 Nov 2026, Apple build 10: in an event
 * the account coordinates, Guests wore dark bars down both sides of its top row and a blank gap under it).
 *
 * Root cause: the event layout draws the coordinator's slim dark line (`coordinating-line.tsx`, `data-coordinating-line`)
 * in the flow under the app's bar. The Guests row is FIXED at the bar's bottom (`--gs-top`) on the column's edges, so it
 * covered the full-width line: the line's dark ends peeked out either side, its "Back to your shop" was under the row,
 * and the row's holder left an empty band under the line. Held here: `--gs-top` on Guests counts the part of the line
 * that still shows (all of it at rest, none once scrolled away), and the paper band above the row stops at the line.
 *
 * Run: `npx tsx 'app/dashboard/[eventId]/guests/_components/the-pinned-row-sits-under-the-coordinating-line.test.ts'`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { lineShowingPx } from './use-shell-bar-offset';
import { CoordinatingLine } from '../../_components/coordinating-line';

(globalThis as unknown as { React: unknown }).React = React;
const read = (f: string) => stripComments(readFileSync(path.join(__dirname, f), 'utf8'));

test('the line counts all of itself at rest, part of itself half-scrolled, nothing once under the bar', () => {
  // Bar 60 px; the line 52 px tall right under it.
  assert.equal(lineShowingPx({ top: 60, bottom: 112 }, 60), 52, 'at rest the row must clear the whole line');
  assert.equal(lineShowingPx({ top: 40, bottom: 92 }, 60), 32, 'half-scrolled: the row rises with the line');
  assert.equal(lineShowingPx({ top: -10, bottom: 42 }, 60), 0, 'under the bar: the row pins at the bar');
  assert.equal(lineShowingPx({ top: 0, bottom: 52 }, 0), 52, 'bar slid away: the line still showing is still cleared');
});

test('Guests asks for the line the layout really draws', () => {
  const html = renderToStaticMarkup(React.createElement(CoordinatingLine, { eventName: 'Maria & Jose' }));
  assert.match(html, /data-coordinating-line=""/, 'the line no longer carries the mark Guests looks for');
  const screen = read('guests-screen.tsx');
  assert.match(
    screen,
    /useShellBarOffset\(rootRef,\s*'--gs-top',\s*\{\s*under:\s*'\[data-coordinating-line\]'\s*\}\)/,
    'the Guests row is pinned at the bar alone again — it covers the coordinator’s line',
  );
});

test('the offset adds the showing line to the bar, and writes it alone for the paper band', () => {
  const hook = read('use-shell-bar-offset.ts');
  assert.match(hook, /const extra = lineShowingPx\(line\.getBoundingClientRect\(\)/);
  assert.match(hook, /`\$\{barH \+ extra\}px`/);
  assert.match(hook, /setProperty\('--gs-under', `\$\{extra\}px`\)/);
  assert.match(hook, /addEventListener\('scroll', soon, \{ passive: true \}\)/, 'the row would not rise as the line scrolls away');
  const css = read('guests-screen.module.css');
  const band = /\.stick\.pinned\[data-pinned\]::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(band, 'the paper band above the row is gone — re-anchor this guard');
  assert.match(band, /bottom:\s*calc\(100% \+ var\(--gs-under, 0px\)\)/, 'the paper band paints over the coordinator’s line');
});
