/**
 * workspace-tabs-step-one-at-a-time.test.ts — IN THE TWO-SIDED WORKSPACE, AN ARROW KEY MOVES ONE TAB, NEVER TWO.
 *
 * Controller, 2026-10-08 (found while the strip became the app's pill selector): with the "Chat" LINK tab first in
 * the strip, → from Quote landed on Files and skipped Payments. The key handler was handed the tab's place in the
 * WHOLE strip (links included) and looked that number up in the list of PANEL tabs only — every link tab before a
 * tab pushed the landing one further on.
 *
 * (1) RUN: the next / previous / first / last panel tab, by the tab's own id, wrapping round.
 * (2) The handler is given the tab's ID — never its place in the strip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const SHELL = 'app/_components/relationship-tab-shell.tsx';
const src = stripComments(readFileSync(join(__dirname, '..', SHELL), 'utf8'));

test('(1) RUN — an arrow moves ONE panel tab; a link tab in the strip never shifts the count', async () => {
  const { nextPanelTabId } = await import('../app/_components/relationship-tab-shell');
  // The couple's workspace: "Chat" is a link tab (a door, never picked) — the panels are the five after it.
  const panels = ['quote', 'payments', 'files', 'call', 'details'];
  assert.equal(nextPanelTabId(panels, 'quote', 'ArrowRight'), 'payments', '→ from Quote skips Payments');
  assert.equal(nextPanelTabId(panels, 'payments', 'ArrowRight'), 'files');
  assert.equal(nextPanelTabId(panels, 'payments', 'ArrowLeft'), 'quote');
  // It wraps at both ends.
  assert.equal(nextPanelTabId(panels, 'details', 'ArrowRight'), 'quote');
  assert.equal(nextPanelTabId(panels, 'quote', 'ArrowLeft'), 'details');
  assert.equal(nextPanelTabId(panels, 'files', 'Home'), 'quote');
  assert.equal(nextPanelTabId(panels, 'files', 'End'), 'details');
  // Walking → from the first visits every panel once, in order, and comes home.
  const walk: string[] = [];
  let at = 'quote';
  for (let i = 0; i < panels.length; i += 1) {
    at = nextPanelTabId(panels, at, 'ArrowRight')!;
    walk.push(at);
  }
  assert.deepEqual(walk, ['payments', 'files', 'call', 'details', 'quote']);
  // Any other key is not the strip's (the browser keeps Tab, Enter, Space, letters).
  for (const key of ['Tab', 'Enter', ' ', 'a', 'ArrowUp', 'ArrowDown', 'Escape']) assert.equal(nextPanelTabId(panels, 'quote', key), null, `${key} was taken`);
  // Nothing to move between; an id that is not a panel starts from the first.
  assert.equal(nextPanelTabId([], 'quote', 'ArrowRight'), null);
  assert.equal(nextPanelTabId(panels, 'chat', 'ArrowRight'), 'quote');
  assert.equal(nextPanelTabId(['only'], 'only', 'ArrowRight'), 'only');
});

test('(2) the key handler is given the tab’s ID — never its place in the whole strip', () => {
  assert.match(src, /onKeyDown=\{\(e\) => onKeyDown\(e, t\.id\)\}/, 'a tab hands the handler something other than its own id');
  assert.match(src, /const nextId = nextPanelTabId\(ids, id, e\.key\);/, 'the handler no longer asks the one rule');
  assert.doesNotMatch(src, /onKeyDown\(e, idx\)|\(idx [+-] 1/, 'the strip position is counted against the panels-only list again');
  // The list it counts in is the panels only — a link tab is a door, not a place.
  assert.match(src, /const ids = useMemo\(\(\) => visible\.filter\(\(t\) => !t\.href\)\.map\(\(t\) => t\.id\), \[visible\]\);/, 'anti-vacuity: the panel list changed shape');
  // Unhandled keys are left alone: preventDefault comes only after the rule answered.
  assert.match(src, /if \(nextId === null\) return;\s*e\.preventDefault\(\);/, 'a key that is not the strip’s is swallowed');
});
