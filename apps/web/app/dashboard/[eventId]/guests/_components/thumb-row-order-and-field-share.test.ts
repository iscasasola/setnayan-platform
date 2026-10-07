/**
 * thumb-row-order-and-field-share.test.ts — THE THUMB ROW, IN THE OWNER'S
 * ORDER, AND THE FIELD KEEPS ≥ 60 % (Maker PR 4f · G3, G19, G32 · BUTTON_RULE
 * 3b). Owner 2026-10-07: *"make the expand/collapse, then select then search
 * then sort"* · *"okay. So sort button, select button, expand collapse button"* ·
 * *"this should always be at least 60% of the width and the 3 buttons adjust"* ·
 * *"maximize width like what we do on search"* (the bulk row's Invite N).
 *
 * SABOTAGE (seen red): put the Sort before the field.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));
const HOOK = stripComments(readFileSync(join(HERE, 'use-row-state.ts'), 'utf8'));

function block(marker: string): string {
  const at = SCREEN.indexOf(marker);
  assert.notEqual(at, -1, `${marker} moved — re-aim this guard`);
  return SCREEN.slice(at, SCREEN.indexOf('\n      </div>\n    );', at));
}

test('List: ⇕ Expand/Collapse · ☑ Select · Search or add · ⫶ Sort — in that order', () => {
  const row = block('data-thumb="list"');
  const order = ['data-testid="thumb-expand"', 'data-testid="thumb-select"', '{field}', 'sortPick'].map((m) => row.indexOf(m));
  assert.ok(order.every((i) => i > -1), `a control is missing from the thumb row: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the thumb row is out of the owner’s order');
  // No match → the right control becomes ＋ Add, terracotta (rule 4).
  assert.match(row, /\{noMatch \? addBtn : sortPick\}/);
  assert.match(SCREEN, /const addBtn = \(\s*<ActionButton\s+tone="brand"/, 'Add is not terracotta');
});

test('Select mode: ✉ Invite N is the row’s field (≥ 60 %), then Set… · Remove N · Done', () => {
  const row = block('data-thumb="select"');
  const order = ['data-testid="bulk-invite"', 'data-bulk-set=""', 'data-testid="bulk-remove"', 'data-testid="bulk-done"'].map((m) => row.indexOf(m));
  assert.ok(order.every((i) => i > -1), `a bulk control is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the bulk row is out of order');
  assert.match(row, /className=\{styles\.grow\}/, 'Invite N does not take the field’s share');
  assert.match(SCREEN, /label="Set for the selected"\s+value=\{null\}\s+buttonText="Set…"/, 'Set… is not ONE dropdown');
});

test('the field (and Invite N) keep at least 60 % — the buttons adapt, never the field', () => {
  const field = CSS.slice(CSS.indexOf('.field {'), CSS.indexOf('}', CSS.indexOf('.field {')));
  assert.match(field, /flex: 1 0 60%;/);
  assert.match(field, /min-width: 60%;/);
  const grow = CSS.slice(CSS.indexOf('.thumb .grow {'), CSS.indexOf('}', CSS.indexOf('.thumb .grow {')));
  assert.match(grow, /min-width: 60%;/, 'Invite N can shrink under 60 %');
  // The fit pass treats a field under 60 % as "tight" and steps the buttons down.
  assert.match(HOOK, /field\.getBoundingClientRect\(\)\.width < row\.clientWidth \* 0\.6/);
  // The field never loses its word state: `.grow` and the field are outside the state rules.
  assert.match(CSS, /\.thumb :global\(\.ab\):not\(\.grow\)/);
});
