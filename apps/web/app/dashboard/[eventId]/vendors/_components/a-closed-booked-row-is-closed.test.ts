/**
 * 📱 A CLOSED BOOKED ROW IS ACTUALLY CLOSED ON AN IPHONE (owner 2026-10-30: "All buttons do not work." · "Booked does not
 * collapse"). The row folds with a `0fr` grid track and marks the folded part `inert`. With `overflow: clip` (no scroll
 * container) a grid item's automatic minimum height is its whole content, so WebKit never shrank the track: the verbs
 * stayed on screen while `inert` swallowed every tap. `min-height: 0` on the folded part is the property that closes it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const body = readFileSync(path.join(__dirname, 'booked-body.tsx'), 'utf8');
const row = readFileSync(path.join(__dirname, 'booked-row.tsx'), 'utf8');

test('the folded part of a Booked row can shrink to 0 (min-height: 0) wherever it is inert when closed', () => {
  assert.match(row, /className="bk-exp" inert=\{!open\}/, 'the folded part is no longer inert-when-closed — re-read this guard');
  const rule = body.match(/\.bk-exp>div\{([^}]*)\}/);
  assert.ok(rule, 'the .bk-exp>div rule was not found');
  assert.match(rule[1] ?? '', /min-height:\s*0/, `.bk-exp>div is "${rule[1]}" — without min-height:0 an iPhone keeps a closed row open and untappable`);
});
