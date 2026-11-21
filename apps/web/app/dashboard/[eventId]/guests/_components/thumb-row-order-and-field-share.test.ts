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

test('List: ⇕ · Search guests · ≡ (Show & sort) · ＋ Add ▾ — the ONE thumb row; ☑ Select on the top row', () => {
  // Owner 2026-10-22 ("Yes to all", question 1): the fifth round (☑) folded into ≡ so "Search guests" reads whole at
  // 320. Owner 2026-10-25: "remove the +" — and 3 Nov, "so fix their locations" (the filter only filters): the ≡ is the
  // Show & sort sheet, the ways in are ＋ Add ▾ (a menu, never the bare add round), and ☑ Select sits on the top row.
  // The ORDER is the shared component's (`components/every-thumb-row-is-the-one-row.test.ts` renders it); here, the
  // screen hands each seat its control.
  const at = SCREEN.indexOf('<ThumbRow\n        name="guests"');
  assert.notEqual(at, -1, 'the List row moved — re-aim this guard');
  // 18–19 Nov 2026 (owner: "so we also do no need an add button because. our text box is search / add feature"): the
  // ＋ Add ▾ seat is gone — the field is the add (`field.onAdd`, lib/a-search-that-adds-shows-add.test.ts).
  const row = SCREEN.slice(at, SCREEN.indexOf('/>', SCREEN.indexOf('right={lookMenu ? [lookMenu, { node: filterSheet }] : [{ node: filterSheet }]}', at)) + 2);
  // 👥 20 Nov (Guests redesign §2): one row — 🔍 (drag right to add) · Show and sort. ⇕ Fold all is the sheet's last line.
  assert.doesNotMatch(row, /left=\{\[|thumb-expand/, '⇕ is back on the thumb row — it is the last line of Show and sort');
  // 🎚 20 Nov (§ 8): the look round sits before Show and sort — never after it.
  const order = ['field={field}', 'right={lookMenu ? [lookMenu, { node: filterSheet }] : [{ node: filterSheet }]}'].map((m) => row.indexOf(m));
  assert.doesNotMatch(row, /\baction=/, 'the List row seats a ＋ Add beside the field that adds');
  assert.ok(order.every((i) => i > -1), `a control is missing from the thumb row: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the thumb row is out of order');
  assert.match(SCREEN, /onAdd: writesOff \|\| gview !== 'list' \? undefined : addTypedOrSheet,/, 'a viewer who may not write is offered the add');
  // ＋ R4 slice 1 (owner 2026-10-29, prototype v12): the Map's main verb — Add guest, the shipped add sheet — only for
  // someone who may write.
  assert.match(
    SCREEN,
    /name="guests-map"\s+field=\{field\}\s+right=\{lookMenu \? \[lookMenu, arrangeMenu\] : \[arrangeMenu\]\}\s+action=\{writesOff \? null : \{ icon: Plus, label: 'Add guest', onClick: \(\) => openAddGuest\(''\)/,
    'the Map row lost its ＋ Add guest',
  );
  assert.match(
    SCREEN,
    /\{gview === 'list' && !selectMode && !writesOff && !asking \? \(\s*<ActionButton tone="neutral" icon=\{SquareCheck\} label="Select" onClick=\{\(\) => setSelectMode\(true\)\}/,
    '☑ Select is not on the List’s top row',
  );
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
