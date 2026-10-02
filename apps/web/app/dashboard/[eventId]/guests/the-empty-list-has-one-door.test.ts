/**
 * First-timer test 2026-10-02 (corpus FIRST_TIMER_TEST_2026-10-02.md):
 *   fix 11 — the empty Guest list carries ONE button, "Add a guest", the same
 *            sheet the header + opens;
 *   fix 21 — the add doors say what they do in plain words:
 *            From your people · Add with details · Import a file · Paste many names.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'app/dashboard/[eventId]/guests');
const read = (rel: string) => readFileSync(join(dir, rel), 'utf8');
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the empty list: one line, one button, and it opens the header + sheet', () => {
  const page = strip(read('page.tsx'));
  const from = page.indexOf('function EmptyState(');
  assert.ok(from > 0, 'EmptyState is gone');
  const body = page.slice(page.indexOf('data-guests-empty=""', from), page.indexOf('\n}\n', from));
  assert.ok(body.length > 0, 'the empty list lost its marker');
  const buttons = body.match(/<(OpenAddGuestTextButton|OpenQuickAddButton|OpenAddFromPeopleButton|Link|a|button)\b/g) ?? [];
  assert.deepEqual(buttons, ['<OpenAddGuestTextButton'], `the empty list must have exactly one door, found: ${buttons.join(', ')}`);
  assert.match(body, /'Add a guest'/);
  // …and that button opens the SAME sheet as the header +.
  const sheet = read('_components/add-guest-sheet.tsx');
  const fn = sheet.slice(sheet.indexOf('export function OpenAddGuestTextButton'));
  assert.match(fn.slice(0, fn.indexOf('\n}\n')), /new CustomEvent\(OPEN_EVENT\)/, 'the empty-list button must open the add sheet');
});

test('the add doors speak plainly', () => {
  const capture = strip(read('_components/capture-bar.tsx'));
  const doors = capture.slice(capture.indexOf('export function AddDoors'));
  for (const words of ['From your people', 'Add with details', 'Import a file', 'Paste many names']) {
    assert.ok(doors.includes(`'${words}'`), `the add doors lost "${words}"`);
  }
  for (const old of ['Full add form', 'Import CSV', 'Quick add list', 'Import guests from a file']) {
    assert.ok(!doors.includes(old), `an add door still says "${old}"`);
  }
});
