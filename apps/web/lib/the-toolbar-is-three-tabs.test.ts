/**
 * 🧰 THE ONE TOOLBAR (owner 20 Nov 2026, DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED" and
 * "MAKER · WAY BACK + BUILT-IN GUEST PAGES"; drawing `maker_one_toolbar_expand_2026-11-20_fable.html` v17).
 *
 *   1. Every scene's toolbar is three tabs — Edit · Style · Animate — and only Animate wears ◆ (Background is a row
 *      of Style, never a tab of its own).
 *   2. ⤢ Expand is offered only where the part has an editor to expand INTO; Dress code never has it.
 *   3. A tap always SELECTS: the toolbar no longer rises an editor on the tap itself.
 *   4. The way back exists in the toolbar: ✕, Back (`useBackCloses`), and the resting bar's words.
 *   5. The risen editor's head is ✓ Done, and the shell's Back closes it first.
 * Sabotage: put `makerPartRisesEditor` back in the tap handler, or add `'bg'` to the tabs → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  MAKER_PART_EXPANDS,
  MAKER_PART_TABS,
  MAKER_PART_TAB_LABEL,
  MAKER_PRO_TAB,
  makerPartExpands,
  makerPartRisesEditor,
  makerTabOf,
} from './maker-parts';
import { STAGE_REST_WORDS } from './maker-stage-room';

const DIR = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components');
const src = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));

test('1 · three tabs, Animate is the ◆ one, Background lives under Style', () => {
  assert.deepEqual([...MAKER_PART_TABS], ['edit', 'style', 'animate']);
  assert.deepEqual(Object.values(MAKER_PART_TAB_LABEL), ['Edit', 'Style', 'Animate']);
  assert.equal(MAKER_PRO_TAB, 'animate');
  assert.equal(makerTabOf('bg'), 'style');
  assert.equal(makerTabOf('edit'), 'edit');
});

test('2 · ⤢ only where an editor exists to expand into; never Dress code', () => {
  for (const k of MAKER_PART_EXPANDS) assert.ok(makerPartRisesEditor(k), `${k} has no editor to expand into`);
  assert.equal(makerPartExpands('dress'), false);
  assert.equal(makerPartExpands(null), false);
});

test('3 · a tap selects — the toolbar never rises an editor from the tap', () => {
  const tools = src('stage-tools.tsx');
  const tap = tools.indexOf('pickPart = useCallback');
  assert.ok(tap > 0, 'pickPart not found');
  assert.ok(!tools.slice(tap, tap + 2500).includes('makerPartRisesEditor('), 'the tap rises an editor again');
  assert.match(tools, /data-stage-expand/);
});

test('4 · the way back: ✕, Back, and the resting bar', () => {
  const tools = src('stage-tools.tsx');
  assert.match(tools, /useBackCloses\(/);
  assert.match(tools, /data-stage-close/);
  assert.match(tools, /data-stage-rest/);
  assert.equal(STAGE_REST_WORDS, 'Tap any scene to edit it');
});

test('5 · the risen editor: ✓ Done, and the shell closes it on Back first', () => {
  assert.match(src('stages-studio-parts.tsx'), /label="Done"/);
  assert.match(src('maker-shell.tsx'), /useBackCloses\(studioOn/);
});
