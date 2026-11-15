/**
 * a-drag-and-the-phone-edit-make-one-row.test.ts — 🖥 event chapters slice 10, TABLET AND DESKTOP (owner-approved brief
 * SCHEDULE_SLICES_8_10_BRIEF_2026-11-05). The brief's own test: *"a drag and the phone edit produce the identical row."*
 *
 *   1 · a desktop drag and the phone's typed start send the SAME fields to the SAME door and lay the SAME row;
 *   2 · the drag snaps to 5 minutes and goes through the page's one save (`ChapterDoors.save` → `updateScheduleBlock`),
 *       in place with Undo — no new write path;
 *   3 · the drag is a desktop thing only (≥1280 with a fine pointer) — never a tablet or a phone;
 *   4 · the layouts: iPad portrait = one column with moments in two sub-columns; iPad landscape = the day beside the
 *       opened chapter; desktop = the day · the chapter · the people, tools inline, no floating pill.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { chapterMove, draggedStart } from '@/lib/chapter-move';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const SCHED = 'app/dashboard/[eventId]/schedule/_components/';
const c = { start_at: '2026-12-18T14:00:00.000Z', end_at: '2026-12-18T15:30:00.000Z', time_tba: false };

test('1 · a drag and the phone edit produce the identical row', () => {
  // The phone: Starts typed as 3:15 PM on the day. The desktop: the band dragged 75 px down (one px = one minute).
  const phone = chapterMove(c, '2026-12-18', '15:15', '2026-12-18');
  const to = draggedStart(c.start_at, 75);
  const drag = chapterMove(c, to.day, to.hhmm, '2026-12-18');
  assert.ok(phone && drag);
  assert.deepEqual(drag!.fields, phone!.fields, 'the drag sends other fields than the phone');
  assert.deepEqual(drag!.next, phone!.next, 'the drag lays another row than the phone');
  assert.deepEqual(phone!.fields, { start_at: '2026-12-18T15:15', with_moments: '1' });
  assert.equal(phone!.next.end_at, '2026-12-18T16:45:00.000Z', 'the end did not move with the start');
});

test('2 · snaps to 5 minutes; one door, in place, with Undo', () => {
  assert.deepEqual(draggedStart(c.start_at, 13), { day: '2026-12-18', hhmm: '14:15' });
  assert.deepEqual(draggedStart(c.start_at, -12), { day: '2026-12-18', hhmm: '13:50' });
  const sheets = code(`${SCHED}chapter-sheets.tsx`);
  assert.match(sheets, /const move = chapterMove\(c, day, hhmm, lastDay\);\s*if \(!move\) return NOT_SAVED;\s*return gate\(row, \{[^}]*\}, async \(\) => \{\s*const answer = await keep\(move\.fields, move\.next\);/, 'the phone edit has a rule of its own');
  const host = code(`${SCHED}chapters-host.tsx`);
  const drag = host.slice(host.indexOf('moveChapter: (id, minutes) => {'), host.indexOf('moveChapter: (id, minutes) => {') + 1400);
  assert.match(drag, /const move = chapterMove\(c, to\.day, to\.hhmm, input\.lastDay\);/, 'the drag moves by another rule');
  assert.match(drag, /void doors\.save\(id, move\.fields\)/, 'the drag saves through another door');
  assert.doesNotMatch(drag, /updateScheduleBlock|fetch\(|\.from\(/, 'the drag grew a write path of its own');
  assert.match(host, /data="chapter-moved"[\s\S]{0,200}label: 'Undo'/, 'a drag has no Undo');
});

test('3 · the drag is desktop only', () => {
  const list = code(`${SCHED}day-list.tsx`);
  assert.match(list, /export const BOARD_QUERY = '\(min-width: 1280px\) and \(pointer: fine\)';/);
  assert.match(list, /const drag = canEdit && board && onMove \? onMove : null;/, 'the drag is offered without the desktop check');
  assert.match(list, /if \(minutes !== null\) \{\s*e\.preventDefault\(\);\s*return;\s*\}/, 'a drag also opens the chapter');
});

test('4 · the three widths', () => {
  const list = code(`${SCHED}day-list.tsx`);
  assert.match(list, /md:grid md:grid-cols-2 md:gap-x-6" data-day-moments=""/, 'iPad portrait does not lay moments in two sub-columns');
  const host = code(`${SCHED}chapters-host.tsx`);
  assert.match(host, /lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_17rem\]/, 'no day-beside-chapter / three-column layout');
  assert.match(host, /className=\{current \? 'min-w-0 max-lg:hidden' : 'min-w-0'\} data-schedule-day-pane=""/, 'the day hides beside an opened chapter on a wide screen');
  assert.match(host, /<aside className="hidden min-w-0 xl:block" data-schedule-people="">/, 'the desktop has no people column');
  assert.match(host, /data-chapter-foot=""/, 'the desktop chapter has no inline Edit · Add a moment bar');
  const pill = code(`${SCHED}schedule-sheet.tsx`);
  assert.match(pill, /\$\{inlineOnDesktop \? ' xl:hidden' : ''\}/, 'the floating pill still floats on a desktop');
  assert.match(list, /data-day-add-row=""/, 'the desktop list has no "+ Add a chapter" row');
});
