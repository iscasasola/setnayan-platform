/**
 * the-schedule-has-one-pop-up.test.ts — 🗂 EVERY ADD AND EDIT ON THE SCHEDULE OPENS THE ONE POP-UP.
 *
 * Owner 2026-10-31, live iPhone: *"the pop up. design template."* — "+ Add to schedule" opened a boxed card pinned
 * under the top nav, a tap on a time a different sheet, a tapped moment a hand-made panel. Frame 19b draws ONE: the
 * moment inspector in the house bottom sheet, answers in the thumb zone. Held, each as a PROPERTY:
 *   1. The template IS the house sheet (`Sheet` + its backdrop) with its answers pinned at its foot.
 *   2. Add a moment, Add a step and a tapped moment (phone; every width under Booked) each open THAT template — no
 *      hand-made dialog and no fixed box is left in those files.
 *   3. Same data, same writes: each form still calls the action it called.
 *
 * Sabotage (2026-10-31, each reverted, each red): the add-step card's `role="dialog"` box put back · AddMomentSheet on
 * the bare `<Sheet` · the rail's phone panel back to `fixed inset-x-0 bottom-0`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const C = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'schedule', '_components');
const read = (f: string) => stripComments(readFileSync(join(C, f), 'utf8'));

test('1 · the template is the house sheet, answers at its foot', () => {
  const t = read('schedule-sheet.tsx');
  assert.match(t, /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
  assert.match(t, /<Sheet open=\{open\} onClose=\{onClose\} labelledById=\{id\} wide rise>/, 'the template is not the house sheet');
  assert.match(t, /sticky bottom-0[^"]*" data-sheet-foot=""/, 'the answers are not pinned to the sheet’s foot');
});

test('2 · every add and every edit opens THAT template', () => {
  const sheets = read('day-sheets.tsx');
  const add = sheets.slice(sheets.indexOf('export function AddMomentSheet('), sheets.indexOf('export function ShiftSheet('));
  assert.match(add, /<ScheduleSheet\b/, 'Add a moment is not the one pop-up');
  assert.doesNotMatch(add, /<Sheet\b/, 'Add a moment draws its own sheet');
  const prep = read('prep-item-controls.tsx');
  const addStep = prep.slice(prep.indexOf('export function AddPreparationItem('), prep.indexOf('export function DeletePreparationItemButton('));
  assert.match(addStep, /<ScheduleSheet\b/, 'Add a step is not the one pop-up');
  assert.doesNotMatch(addStep, /role="dialog"|fixed inset-0|OverlayBackdrop/, 'Add a step draws its own boxed card');
  const rail = read('day-rail.tsx');
  assert.match(rail, /selected && !inspectorSlot && \(!isDesktop \|\| booked\) \? \(\s*<ScheduleSheet\b/, 'a tapped moment does not open the one pop-up');
  assert.match(rail, /<MomentInspector\b[\s\S]{0,900}?\binSheet\b/, 'the inspector does not know it is in the one pop-up');
  assert.doesNotMatch(rail, /fixed inset-x-0 bottom-0 z-\[60\]/, 'the hand-made phone panel is back');
});

test('3 · same data, same writes', () => {
  const add = read('day-sheets.tsx');
  assert.match(add, /await createScheduleBlock\(\s*toFormData\(\{[\s\S]*?label: label\.trim\(\),[\s\S]*?block_type: type,[\s\S]*?location: where,[\s\S]*?prep: staged/, 'Add a moment lost a field');
  const prep = read('prep-item-controls.tsx');
  assert.match(prep, /await addPreparationItem\(fd\)/, 'Add a step lost its write');
  for (const n of ['name="label"', 'name="amount_php"', 'name="due_date"', 'name="notes"', "fd.set('kind', kind)"]) assert.ok(prep.includes(n), `Add a step lost ${n}`);
});
