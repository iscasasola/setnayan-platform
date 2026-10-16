/**
 * the-guest-list-does-no-work-twice.test.ts — ⚡ THE GUEST LIST SENDS EACH GUEST ONCE AND FITS ITS ROWS ONCE.
 *
 * Measured 2026-10-16 on a production build with the owner's 84 guests replayed (375 px, 4× CPU):
 *   · the page built a fresh `{ guest_id, first_name, last_name, side, role, extra_roles }` per guest
 *     for the quick-add sheet — 22 KB of the document saying every name a second time. Handing the
 *     sheet the SAME row objects the list gets lets the RSC payload send each row once;
 *   · `useRowState` fitted the rows on mount and then again when its ResizeObserver made the report
 *     every observer makes on start — 68 ms (three forced layouts over 85 rows) for nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));

test('the quick-add sheet gets the very rows the list gets, not a copy of each', () => {
  const page = read('page.tsx');
  // Since 2026-10-16 the rows are the LEAN ones (`toGuestListRow`, the-list-sends-only-what-it-draws.test.ts):
  // ONE lean object per guest, made once, which both the list and the sheet receive.
  assert.match(page, /const listRowById = new Map\(guests\.map\(\(g\) => \[g\.guest_id, toGuestListRow\(g\)\] as const\)\);/);
  assert.match(page, /const quickAddPool = guests\.map\(listRowOf\);/);
  assert.match(page, /const rosterAll = guests[\s\S]{0,400}?\.map\(listRowOf\);/, 'the list gets the same lean objects');
  assert.match(page, /existingGuests=\{quickAddPool\}/);
  // the sheet still reads extra_roles defensively, as the copy used to
  assert.match(read('_components/quick-add-sheet.tsx'), /extra_roles: g\.extra_roles \?\? \[\]/);
});

test("the row fit ignores the observer's starting report (it is the size just fitted)", () => {
  const hook = read('_components/use-row-state.ts');
  const fit = hook.indexOf('fitGroup(el);');
  const skip = hook.indexOf('if (first) {');
  assert.ok(fit > 0 && skip > fit, 'fit once on mount, then skip the first observer report');
  assert.match(hook.slice(skip, skip + 120), /first = false;\s*return;/);
});
