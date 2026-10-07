/**
 * typing-never-rebuilds-the-field.test.ts — THE SEARCH WAITS, AND NEVER BLINKS
 * (Maker PR 4f · BUTTON_RULE 4). Owner 2026-10-07: *"why does it blink everytime
 * i type"* · *"start searching once we stop typing?"*.
 *
 *   · the box is UNCONTROLLED — React never writes its value back, so a render
 *     cannot replace or reset it (no `value=`, a `defaultValue` + a ref);
 *   · the list reads the query 250 ms after the last key (`SEARCH_WAIT_MS`);
 *   · the row fit never listens to text changes (no MutationObserver), so a key
 *     cannot re-fit the row;
 *   · the rise animation plays once per mode (`data-settled`).
 *
 * SABOTAGE (seen red): make the box controlled (`value={q}`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SEARCH_WAIT_MS } from '@/lib/guest-roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const HOOK = stripComments(readFileSync(join(HERE, 'use-row-state.ts'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));

test('the box is uncontrolled — one node, its value never written by a render', () => {
  const box = SCREEN.slice(SCREEN.indexOf('const field = ('), SCREEN.indexOf('/>', SCREEN.indexOf('const field = (')));
  assert.match(box, /<input\b/);
  assert.doesNotMatch(box, /\svalue=\{/, 'the box is controlled — every key re-renders it');
  assert.match(box, /defaultValue=/);
  assert.match(box, /ref=\{fieldRef\}/);
  assert.match(box, /onInput=\{\(e\) => onType\(e\.currentTarget\.value\)\}/);
  // The box is ONE element placed in both rows that have it — never a new component per render.
  assert.equal((SCREEN.match(/data-guests-search=""/g) ?? []).length, 1);
  assert.doesNotMatch(SCREEN, /key=\{q\}|key=\{`\$\{q/, 'a key tied to the query remounts the box');
});

test('the query lands 250 ms after the last key', () => {
  assert.equal(SEARCH_WAIT_MS, 250);
  assert.match(SCREEN, /clearTimeout\(timer\.current\);\s*timer\.current = setTimeout\(\(\) => setQ\(v\.trim\(\)\), SEARCH_WAIT_MS\)/);
});

test('typing never re-fits the row, and the entry animation plays once per mode', () => {
  assert.doesNotMatch(HOOK, /new MutationObserver/, 'the fit listens to text — every key re-fits');
  assert.match(CSS, /\.screen\[data-settled='true'\] \.rise \{\s*animation: none;/, 'the rise replays on a re-render');
  assert.match(SCREEN, /useEffect\(\(\) => \{\s*setSettled\(false\);[\s\S]{0,120}\}, \[gview\]\);/, 'settling is not per mode');
});
