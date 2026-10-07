/**
 * every-fact-has-one-editor.test.ts — Event Details opens ONE editor, Event
 * settings (it saves live); every other fact is a › to its home or a control
 * that saves at once. Never a second editor, never an "Open … ›" link.
 *
 * ⚖ Owner 2026-10-04 (DECISION_LOG "YES TO ALL"), re-measured 2026-10-08 for
 * DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS" (`EVENT_DETAILS_ARRANGE_2026-10-07_fable.md`
 * § (e) PR-A: *"`every-fact-has-one-editor.test.ts` re-measured: editors =
 * `settings` only"*; § (f): the 17 rows that wrote the Event Hub draft left).
 *
 * What is held here, each as a PROPERTY of the source (comments stripped):
 *   1. every row in `RECORD_ROW_EDITOR` the page draws opens its field
 *      (`recordFieldHref(eventId, '<row>')`) — a count;
 *   2. the one editor is `EventSettingsEditor`, defined once, reached by the
 *      record, and never mounted in the Maker;
 *   3. the record draws NO field of its own (no `<input>`, `<textarea>`,
 *      `<select>` or `<form>` in its files) — its live controls are PickMenus
 *      and switches over the actions that already own each fact;
 *   4. OPENING A ROW WRITES NOTHING — a GET to its field, nothing on that path writes;
 *   5. NOTHING SAVES INTO THE EVENT HUB DRAFT — no Undo · Apply on the page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  RECORD_EDITOR_COMPONENT,
  RECORD_ROW_EDITOR,
  parseRecordRow,
  recordFieldHref,
  recordRowOfPath,
} from '@/lib/event-details-record';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const D = 'app/dashboard/[eventId]/details';
const PAGE = read(`${D}/page.tsx`);
const EDITOR = read(`${D}/_components/record-editor.tsx`);

const SETTINGS_EDITOR = `${D}/_components/event-settings-editor.tsx`;

test('every row that opens its field is drawn as one — a count', () => {
  const rows = Object.keys(RECORD_ROW_EDITOR);
  assert.deepEqual(rows.sort(), ['area', 'estimate', 'kind'], 'the field rows changed — re-read the design § (f)');
  // Kind and the guest count open it from the page (while no booking holds them).
  for (const row of ['kind', 'estimate']) {
    assert.match(PAGE, new RegExp(`<FieldRow row="${row}"[^>]*href=\\{recordFieldHref\\(eventId, '${row}'\\)\\}`), `${row} does not open its field`);
  }
  // …and Area is the address /details/change lands on (the page itself shows Area as one dropdown).
  assert.match(read(`${D}/change/page.tsx`), /redirect\(`\/dashboard\/\$\{eventId\}\/details\/field\/area`\)/);
  const rowsSrc = read(`${D}/_components/details-rows.tsx`);
  assert.match(rowsSrc, /<RecordRowLink row=\{row\} href=\{href\} recordHref=\{recordHref\}>/);
});

test('the one editor is Event settings — defined once, reached by the record, never in the Maker', () => {
  assert.deepEqual(Object.keys(RECORD_EDITOR_COMPONENT), ['settings'], 'an editor came back to Event Details');
  assert.equal(RECORD_EDITOR_COMPONENT.settings, 'EventSettingsEditor');
  assert.match(read(SETTINGS_EDITOR), /export function EventSettingsEditor\b/);
  assert.match(EDITOR, /case 'settings': \{[\s\S]{0,300}?<EventSettingsEditor\b/);
  assert.equal(new Set(Object.values(RECORD_ROW_EDITOR)).size, 1);
  for (const gone of ['ColorsPanel', 'ButtonsLookRow', 'MakerRsvpSettings', 'AnswerPicker', 'NamesEditor', 'DateEditor', 'VenuesEditor', 'LiveStoryPanel', 'SpecialMessageField']) {
    assert.ok(!EDITOR.includes(gone), `record-editor still opens the Maker's ${gone}`);
  }
});

test('the record draws NO field of its own — its controls are PickMenus and switches', () => {
  for (const rel of [
    `${D}/page.tsx`,
    `${D}/_components/record-editor.tsx`,
    `${D}/_components/record-field-slot.tsx`,
    `${D}/_components/record-field-sheet.tsx`,
    `${D}/_components/record-row-link.tsx`,
    `${D}/_components/details-segments.tsx`,
    `${D}/_components/details-fold.tsx`,
    `${D}/_components/details-rows.tsx`,
    `${D}/_components/details-controls.tsx`,
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /<(input|textarea|select|form)\b/, `${rel} draws a field of its own`);
  }
  // Each live control saves through the action that already owns its fact.
  const controls = read(`${D}/_components/details-controls.tsx`);
  assert.match(controls, /fd\.set\('only', 'region'\);[\s\S]{0,400}?updateEventMatchCriteria\(fd\)/, 'Area does not post the region alone');
  assert.match(controls, /fd\.set\('guest_list_edit_deadline', deadline \?\? ''\);[\s\S]{0,300}?updatePaxSettings\(fd\)/, 'Costs shown would blank the reply-by date');
  assert.match(controls, /await setPlanningMode\(fd\)/);
});

test('opening a row writes nothing — a GET to its field, and nothing on that path writes', () => {
  assert.equal(recordFieldHref('E1', 'kind'), '/dashboard/E1/details/field/kind');
  assert.equal(recordRowOfPath('/dashboard/E1/details/field/estimate'), 'estimate');
  assert.equal(parseRecordRow('fonts'), null, 'a retired draft row still opens a field');
  assert.equal(recordRowOfPath('/dashboard/E1/details'), null);
  assert.equal(parseRecordRow('not-a-row'), null, 'an address that names no row opens nothing');

  const path = [
    `${D}/layout.tsx`,
    `${D}/@field/(.)field/[row]/page.tsx`,
    `${D}/@field/(.)field/[row]/loading.tsx`,
    `${D}/@field/default.tsx`,
    `${D}/change/page.tsx`,
    `${D}/field/[row]/page.tsx`,
    `${D}/_components/record-field-slot.tsx`,
    `${D}/_components/record-editor.tsx`,
    `${D}/_components/record-field-sheet.tsx`,
    `${D}/_components/record-row-link.tsx`,
  ];
  for (const rel of path) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/, `${rel} writes`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${rel} is a server action`);
    assert.doesNotMatch(src, /\bawait\s+(update|save|set|apply|hubDraft)\w*\(/, `${rel} calls a writer`);
  }
  // The row itself is a link to that address — a GET.
  const link = read(`${D}/_components/record-row-link.tsx`);
  assert.match(link, /<Link\s+href=\{open \? recordHref : href\}/);
  assert.doesNotMatch(link, /onClick=/, 'the row does something on tap besides following its link');
});

test('nothing saves into the Event Hub draft — no Undo · Apply on Event Details', () => {
  assert.doesNotMatch(PAGE, /HubDraftDock|hub-draft-dock|overlayHubDraftEvent|readHubDraft|Waiting for Apply/, 'Event Details carries the Maker’s Undo · Apply again');
  for (const rel of [`${D}/_components/record-editor.tsx`, `${D}/_components/details-controls.tsx`, SETTINGS_EDITOR]) {
    assert.doesNotMatch(read(rel), /hubDraftAction|HubDraftField/, `${rel} saves into the Event Hub draft`);
  }
});
