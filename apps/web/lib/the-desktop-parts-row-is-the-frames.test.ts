/**
 * 🗂 THE DESKTOP PARTS COLUMN'S PICKED ROW IS THE FRAME'S (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` § Stages,
 * LEFT: "The picked row carries ＋ Add above · grip (mouse drag to reorder) · 🗑 · ＋ Add below — the same four the page
 * shows on the part. The Reveal is locked first: a lock, no grip, no ＋ above, no 🗑"; the doc's "Mouse": a soft gold
 * ring on every pressable row). Held four ways:
 *
 *   1 · NO WRITE OF ITS OWN — the row's four are the picked part's own edits (`usePartEdits`, handed in whole as
 *       `tools={edits}`); the column never reaches the draft itself. Sabotage: the column calling `askPartOps` → red.
 *   2 · THE FRAME'S GATES — ＋ above / below are the frame's `edgesOf` (and a reply line's `lineAdd`), the grip lands
 *       through the drop's own one write (`dropOn`) only where the part may move (`canMove`), and nothing while a
 *       press is still on its way. Sabotage: ＋ above without `edgesOf.addAbove` → red.
 *   3 · LOCKED FIRST — the Reveal (and the Cover Scene, which the opening belongs to) has no grip, no ＋ and no 🗑:
 *       `makerRevealEdges` gives it none, and the row draws a tool only when its edit exists. Sabotage: the grip drawn
 *       without `tools.moveNear` → red.
 *   4 · ONE HOVER RING — 2 px of #A9834B (the desktop system sheet's piece 6, approved 2026-10-15), one constant, on
 *       every pressable row of the column. Sabotage: the rows' own grey hover back → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { makerRevealEdges } from './maker-parts';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const deskParts = () => {
  const desk = read(`${L}/stage-panel/desk.tsx`);
  const at = desk.indexOf('export function DeskParts(');
  assert.ok(at > 0, 'DeskParts is gone');
  const end = desk.indexOf('\nexport ', at + 1);
  return desk.slice(at, end < 0 ? undefined : end);
};

test('1 · the picked row writes nothing of its own — its tools are the part’s own edits', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const edits = usePartEdits\(\{/);
  assert.match(tools, /<DeskParts[\s\S]{0,900}\btools=\{edits\}/, 'the parts column is not handed the part’s own edits');
  const desk = read(`${L}/stage-panel/desk.tsx`);
  assert.doesNotMatch(desk, /askPartOps|makerSave|draftAction|requestMakerRefresh/, 'the desk code reaches the draft itself');
  const body = deskParts();
  for (const call of ['tools.addAbove', 'tools.addBelow', 'tools.remove', 'tools.moveNear?.(']) assert.ok(body.includes(call), `the row does not use the part’s own ${call}`);
});

test('2 · ＋ and the grip are the frame’s, behind the frame’s own gates', () => {
  const sheet = read(`${L}/add-part-sheet.tsx`);
  assert.match(sheet, /addAbove: working \? null : fixedPages \? \(lineAdd\?\.above \? \(\) => lineAdd\.onAdd\('above'\) : null\) : edgesOf\.addAbove \? \(\) => askAdd\('above'\) : null,/);
  assert.match(sheet, /addBelow: working \? null : fixedPages \? \(lineAdd\?\.below \? \(\) => lineAdd\.onAdd\('below'\) : null\) : edgesOf\.addBelow \? \(\) => askAdd\('below'\) : null,/);
  assert.match(sheet, /moveNear:\s*working \|\| !canMove\s*\? null/);
  assert.match(sheet, /const done = o && t \? dropOn\(o, t, where, here, false\) : null;/, 'the grip lands by a write other than the drop’s');
  assert.match(sheet, /return o && canMove \? moveTargets\(o\)\.map\(\(t\) => t\.key\) : \[\];/, 'the grip lands among other parts than the page’s drag');
});

test('3 · the Reveal and the Cover Scene are locked first: no grip, no ＋, no 🗑', () => {
  assert.deepEqual(makerRevealEdges(true), { grip: false, addAbove: false, addBelow: false, remove: false });
  const sheet = read(`${L}/add-part-sheet.tsx`);
  assert.match(sheet, /const edgesOf = makerRevealEdges\(isReveal \|\| picked === 'coverscene'\);/);
  assert.match(sheet, /const canMove = edgesOf\.grip && mayMove\(mv\) && !fixedPages;/);
  const body = deskParts();
  assert.match(body, /\{on && tools\.addAbove \?/);
  assert.match(body, /\{on && tools\.moveNear \?/);
  assert.match(body, /\{on && tools\.remove \?/);
  assert.match(body, /\{on && tools\.addBelow \?/);
  assert.match(body, /k === 'reveal' \? <Lock /);
});

test('4 · one hover ring — 2 px of the house gold — on every pressable row', () => {
  const desk = read(`${L}/maker-desk.tsx`);
  assert.match(desk, /export const DESK_GOLD = '#A9834B';/);
  assert.match(desk, /export const DESK_HOVER_RING = 'hover:shadow-\[0_0_0_2px_#A9834B\]';/);
  const panel = read(`${L}/stage-panel/desk.tsx`);
  for (const k of ['ROW', 'ADD_ROW', 'ROW_ICON']) assert.match(panel, new RegExp(`const ${k} =\\s*\`[^\`]*\\$\\{DESK_HOVER_RING\\}`), `${k} does not wear the one hover ring`);
  assert.doesNotMatch(panel, /hover:bg-\[/, 'a row draws a hover of its own');
});
