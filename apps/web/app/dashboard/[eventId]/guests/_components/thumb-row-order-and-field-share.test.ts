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

test('List: ⇕ · Search guests · ≡ (Sort, ☑ Select and the ways to add inside it) — the ONE thumb row, no ＋', () => {
  // Owner 2026-10-22 ("Yes to all", question 1): the fifth round (☑) folds into ≡ so "Search guests" reads whole at
  // 320. Owner 2026-10-25: "Yes, remove the + on the guest list. Typing in the search adds" — the row has no main verb.
  // The ORDER is the shared component's (`components/every-thumb-row-is-the-one-row.test.ts` renders it); here, the
  // screen hands each seat its control.
  const at = SCREEN.indexOf('<ThumbRow\n        name="guests"');
  assert.notEqual(at, -1, 'the List row moved — re-aim this guard');
  const row = SCREEN.slice(at, SCREEN.indexOf('/>', SCREEN.indexOf('right={[sortMenu]}', at)) + 2);
  const order = ['left={[', "testId: 'thumb-expand'", 'field={field}', 'right={[sortMenu]}'].map((m) => row.indexOf(m));
  assert.ok(order.every((i) => i > -1), `a control is missing from the thumb row: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the thumb row is out of order');
  assert.ok(!row.includes('action='), 'the List row has a main verb (the ＋) again');
  assert.match(SCREEN, /<ThumbRow name="guests-map" field=\{field\} right=\{\[arrangeMenu\]\} \/>/, 'the Map row has a main verb (the ＋) again');
  assert.match(SCREEN, /writesOff \? \[\] : \[\{ key: 'select', label: 'Select…', group: 'List'/, '☑ Select is not in the ≡ menu');
  assert.match(SCREEN, /if \(k === 'select'\) return setSelectMode\(true\);/);
});

test('Select mode: ✉ Invite N is the row’s field (≥ 60 %), then Set… · Remove N · Done', () => {
  const row = block('data-thumb="select"');
  const order = ['data-testid="bulk-invite"', 'data-bulk-set=""', 'data-testid="bulk-remove"', 'data-testid="bulk-done"'].map((m) => row.indexOf(m));
  assert.ok(order.every((i) => i > -1), `a bulk control is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the bulk row is out of order');
  assert.match(row, /className=\{styles\.grow\}/, 'Invite N does not take the field’s share');
  assert.match(SCREEN, /label="Set for the selected"\s+value=\{null\}\s+buttonText="Set…"/, 'Set… is not ONE dropdown');
});

test('Invite N keeps at least 60 % — the Select buttons adapt, never Invite', () => {
  // The List field's 60 % retired 2026-10-22 (four icon rounds leave it the widest seat; there are no words to fit).
  const grow = CSS.slice(CSS.indexOf('.thumb .grow {'), CSS.indexOf('}', CSS.indexOf('.thumb .grow {')));
  assert.match(grow, /min-width: 60%;/, 'Invite N can shrink under 60 %');
  assert.match(HOOK, /field\.getBoundingClientRect\(\)\.width < row\.clientWidth \* 0\.6/);
  assert.match(CSS, /\.thumb :global\(\.ab\):not\(\.grow\)/);
});
