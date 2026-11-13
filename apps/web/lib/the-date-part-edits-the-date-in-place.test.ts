/**
 * the-date-part-edits-the-date-in-place.test.ts — 📅 THE MAKER EDIT SHELL: A DATE PART'S EDIT IS THE EVENT DATE
 * (owner-approved 2026-11-13, "maker shell approved"; prototype `prototypes/approved_2026-11-13/maker-toolbar-fable.html`
 * v3 frames 1 and 4, and DECISION_LOG 2026-11-13 "MAKER › COUNTDOWN EDIT = THE EVENT DATE, NOT 'OPEN INFO'").
 *
 *   (1) what the rows say — the day and "Final · N days to go", or "Not final yet" with the options weighed;
 *   (2) the Countdown and the cover's Date open `DateEdit`, never a door out of the Maker ("Open Info",
 *       "Change it in Suppliers"); its one button opens the SHIPPED date sheet (`FactSheet which="date"`), whose one
 *       writer is `updateEventDate` — no second date writer is born here;
 *   (3) the read is the sheet's own (`openFactSheet` / the lab's stand-in), asked when the part is picked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { DATE_EDIT_NOT_FINAL, dateEditLines } from './maker-date-edit';
import { MAKER_PARTS, makerPartEditsTheDate, makerPartSource, type MakerPartKey } from './maker-parts';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the rows say the day and how far, or that it is not final and the options', () => {
  const final = dateEditLines({ date: '2026-12-12', precision: 'day', options: undefined }, '2026-11-13');
  assert.equal(final.final, true);
  assert.match(final.value, /12 December 2026/);
  assert.match(final.value, /^Sat/);
  assert.equal(final.sub, 'Final · 29 days to go');
  assert.equal(dateEditLines({ date: '2026-11-14', precision: 'day' }, '2026-11-13').sub, 'Final · tomorrow');
  const open = dateEditLines({ date: '2026-12-01', precision: 'month', options: { mode: 'specific', candidates: ['2026-12-05', '2026-12-12', '2026-12-19'], windowStart: null, windowEnd: null } }, '2026-11-13');
  assert.equal(open.final, false);
  assert.equal(open.value, DATE_EDIT_NOT_FINAL);
  assert.deepEqual(open.chips, ['5 Dec', '12 Dec', '19 Dec']);
  const none = dateEditLines({ date: null, precision: null }, '2026-11-13');
  assert.equal(none.value, DATE_EDIT_NOT_FINAL);
});

test('(2) the Countdown and the cover’s Date edit the date in place — no door out', () => {
  const edits = (Object.keys(MAKER_PARTS) as MakerPartKey[]).filter(makerPartEditsTheDate);
  assert.ok(edits.includes('countdown'), 'the Countdown does not show the date');
  assert.ok(edits.includes('date'), 'the cover’s Date does not show the date');
  for (const k of edits) assert.ok(k === 'countdown' || makerPartSource(k).kind === 'supplier', `${k} is not a date part`);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /<DateEdit eventId=\{makerEventId\} \/>/, 'the toolbar does not draw the date in Edit');
  assert.match(tools, /makerPartEditsTheDate\(picked\)/);
  const edit = read(`${L}/stage-panel/date-edit.tsx`);
  assert.match(edit, /<FactSheet\s+eventId=\{eventId\}\s+which="date"/, 'the button does not open the shipped date sheet');
  assert.doesNotMatch(edit, /updateEventDate\(|hubDraftAction\(|FormData/, 'a second date writer was born in the Maker');
  assert.doesNotMatch(edit, /href=/, 'the date edit links out of the Maker');
});

test('(3) the date is the sheet’s own read, asked when the part is picked', () => {
  const edit = read(`${L}/stage-panel/date-edit.tsx`);
  assert.match(edit, /lab \? lab\.open\('date', null\) : openFactSheet\(eventId, \{ which: 'date' \}\)/);
  /* The read's day is under `date` (`FactSheetData`) — reading the envelope as the day said "Not final yet" for a set date. */
  assert.match(edit, /r\.ok && r\.which === 'date' \? \{ kind: 'ready', data: r\.date \}/, 'the date is read off the wrong level of the answer');
  assert.match(edit, /role="alert"/, 'a failed read looks like no date');
});
