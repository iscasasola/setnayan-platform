/**
 * every-fact-has-one-editor.test.ts — Event Details' rows open THE Maker's
 * field for their fact; never a second editor, never an "Open … ›" link.
 *
 * ⚖ Owner 2026-10-04 (DECISION_LOG "YES TO ALL"): *"Event Details rows are
 * edited in place (money/supplier rows read-only with their link) — supersedes
 * the 2026-10-01 'information only' line"*. Study § 2 ("one home per fact —
 * one editor, three doors") and § 7 PR-1.
 *
 * What is held here, each as a PROPERTY of the source (comments stripped):
 *   1. every row in `RECORD_ROW_EDITOR` is drawn on the page as a row that opens
 *      its field (`row="x" … open={opens('x')}`) — a count, not a sample;
 *   2. every editor the record mounts is the component the Maker mounts for that
 *      fact — named in `RECORD_EDITOR_COMPONENT`, exported by its own file,
 *      mounted by the Maker's own file — and the record draws NO field of its
 *      own (no `<input>`, `<textarea>`, `<select>` or `<form>` in its files);
 *   3. no part the record edits carries an "Open … ›" link — only the parts
 *      another flow owns (the guest names, Budget, Suppliers, Services,
 *      Purchases); the studio rows (`RECORD_ROW_TOOL`) open their studio;
 *   4. OPENING A ROW WRITES NOTHING — the row is a GET link to its field's
 *      address, and nothing on that path writes (no insert/update/upsert/delete/
 *      rpc, no 'use server', no action called — actions are only BOUND and
 *      handed to the Maker's editors);
 *   5. A SAVED ROW LANDS IN THE DRAFT AND COUNTS IN APPLY — the page carries the
 *      Maker's own Undo · Apply (`HubDraftDock`), and every Hub editor saves
 *      through the draft door (`hubDraftAction` / `HubDraftField`).
 *
 * Sabotage (2026-10-04, each red, then restored green) — see the PR body.
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
  RECORD_ROW_GROUP,
  RECORD_ROW_TOOL,
  parseRecordRow,
  recordFieldHref,
  recordRowOfPath,
  type RecordEditorKey,
} from '@/lib/event-details-record';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const D = 'app/dashboard/[eventId]/details';
const L = 'app/dashboard/[eventId]/launch/_components';
const PAGE = read(`${D}/page.tsx`);
const EDITOR = read(`${D}/_components/record-editor.tsx`);

/**
 * Where each editor is DEFINED and where the MAKER mounts it — so "the same
 * component" is a fact about two files, not a name that merely matches.
 */
const SAME_AS_THE_MAKER: Record<RecordEditorKey, { defined: string; maker: string; mount: RegExp }> = {
  theme: { defined: `${L}/maker-theme-picker.tsx`, maker: `${L}/maker-details.tsx`, mount: /<MakerThemeMenu\b/ },
  font: { defined: 'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx', maker: 'app/dashboard/[eventId]/website/editor/page.tsx', mount: /<ColorsPanel\b[\s\S]{0,200}?part="font"/ },
  colours: { defined: 'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx', maker: 'app/dashboard/[eventId]/website/editor/page.tsx', mount: /<ColorsPanel\b[\s\S]{0,200}?part="colours"/ },
  buttons: { defined: 'app/dashboard/[eventId]/website/editor/_components/buttons-look-row.tsx', maker: 'app/dashboard/[eventId]/website/editor/page.tsx', mount: /<ButtonsLookRow\b/ },
  rsvp: { defined: `${L}/maker-rsvp-ask.tsx`, maker: 'app/dashboard/[eventId]/launch/page.tsx', mount: /<MakerRsvpSettings\b/ },
  papic: { defined: `${L}/details-answers.tsx`, maker: `${L}/details-answers-parts.tsx`, mount: /<AnswerPicker\b[^>]*column="papic_on"/ },
  gifts: { defined: `${L}/details-answers.tsx`, maker: `${L}/details-answers-parts.tsx`, mount: /<AnswerPicker\b[^>]*column="gifts_on"/ },
  'logo-answer': { defined: `${L}/details-answers.tsx`, maker: `${L}/details-answers-parts.tsx`, mount: /<AnswerPicker\b[^>]*column="logo_wanted"/ },
  'cover-answer': { defined: `${L}/details-answers.tsx`, maker: `${L}/details-answers-parts.tsx`, mount: /<AnswerPicker\b[^>]*column="cover_photo_wanted"/ },
  names: { defined: `${L}/details-your-event.tsx`, maker: `${L}/details-your-event-parts.tsx`, mount: /<NamesEditor\b/ },
  date: { defined: `${L}/details-your-event.tsx`, maker: `${L}/details-your-event-parts.tsx`, mount: /<DateEditor\b/ },
  venues: { defined: `${L}/details-your-event.tsx`, maker: `${L}/details-your-event-parts.tsx`, mount: /<VenuesEditor\b/ },
  'love-story': { defined: 'app/dashboard/[eventId]/website/our-story/_components/love-story-live.tsx', maker: `${L}/maker-shell.tsx`, mount: /liveStoryPanel: LiveStoryPanel/ },
  'special-message': { defined: `${L}/special-message-field.tsx`, maker: `${L}/maker-details.tsx`, mount: /<SpecialMessageField\b/ },
  settings: { defined: `${D}/_components/event-settings-editor.tsx`, maker: `${D}/change/page.tsx`, mount: /<EventSettingsEditor\b/ },
};

/** How the record reaches each editor: the component itself, or the Maker's own builder of it. */
const RECORD_REACHES: Record<RecordEditorKey, RegExp> = {
  theme: /<MakerThemeMenu\b/,
  font: /<ColorsPanel\b/,
  colours: /<ColorsPanel\b/,
  buttons: /<ButtonsLookRow\b/,
  rsvp: /<MakerRsvpSettings\b/,
  papic: /answerParts\(\{ eventId, answers \}\)\.editors\[editor\]/,
  gifts: /answerParts\(\{ eventId, answers \}\)\.editors\[editor\]/,
  'logo-answer': /logoAnswer\(eventId, answers\)\.node/,
  'cover-answer': /coverAnswer\(eventId, answers\)\.node/,
  names: /yourEventFactEditors\(\{ eventId, input \}\)\[editor\]/,
  date: /yourEventFactEditors\(\{ eventId, input \}\)\[editor\]/,
  venues: /yourEventFactEditors\(\{ eventId, input \}\)\[editor\]/,
  'love-story': /<LiveStoryPanel\b/,
  'special-message': /<SpecialMessageField\b/,
  settings: /<EventSettingsEditor\b/,
};

test('every row that opens its field is drawn as one — a count', () => {
  const rows = Object.keys(RECORD_ROW_EDITOR);
  assert.ok(rows.length >= 20, `only ${rows.length} rows open a field — the list shrank, so this would prove less`);
  const missing: string[] = [];
  for (const row of rows) {
    const re = new RegExp(`row="${row}"[\\s\\S]{0,900}?open=\\{(?:eventWord === 'wedding' \\? )?opens\\('${row}'\\)`);
    if (!re.test(PAGE)) missing.push(row);
  }
  assert.deepEqual(missing, [], `These rows do not open their field on Event Details:\n  ${missing.join('\n  ')}`);
  // …and the door is the record's own: the field's address, built by the one helper.
  assert.match(PAGE, /recordFieldHref\(eventId, row\)/);
  assert.match(PAGE, /<RecordRowLink row=\{row\} href=\{open\} recordHref=\{record\}>/);
});

test('every studio row opens its studio, and is named as one', () => {
  const tools = Object.keys(RECORD_ROW_TOOL);
  assert.equal(tools.length, 6, 'the studio list changed — every entry is a named, reported gap; widen it on purpose');
  for (const row of tools) {
    assert.match(PAGE, new RegExp(`row=(?:"${row}"|\\{i === 0 \\? '${row}')[\\s\\S]{0,500}?tool=\\{`), `the ${row} row does not open its studio`);
    assert.ok(!(row in RECORD_ROW_EDITOR), `${row} is both a studio and a field`);
  }
});

test('each editor the record opens IS the Maker’s — defined once, mounted by the Maker, reached by the record', () => {
  const keys = Object.keys(RECORD_EDITOR_COMPONENT) as RecordEditorKey[];
  assert.equal(keys.length, 15, 'the editor list changed — re-read it against the study');
  for (const key of keys) {
    const name = RECORD_EDITOR_COMPONENT[key];
    const where = SAME_AS_THE_MAKER[key];
    assert.match(read(where.defined), new RegExp(`export function ${name}\\b`), `${name} is not defined in ${where.defined}`);
    assert.match(read(where.maker), where.mount, `the Maker no longer mounts ${name} (${where.maker})`);
    assert.match(EDITOR, RECORD_REACHES[key], `the record does not open ${name} for "${key}"`);
    assert.match(EDITOR, new RegExp(`case '${key}':`), `record-editor has no case for "${key}"`);
  }
  // Every row's editor is one of these, and every editor is opened by a row.
  const used = new Set(Object.values(RECORD_ROW_EDITOR));
  assert.deepEqual([...used].sort(), [...keys].sort(), 'an editor no row opens, or a row naming no editor');
});

test('the record draws NO field of its own — every input is the Maker’s', () => {
  for (const rel of [
    `${D}/page.tsx`,
    `${D}/_components/record-editor.tsx`,
    `${D}/_components/record-field-slot.tsx`,
    `${D}/_components/record-field-sheet.tsx`,
    `${D}/_components/record-fold.tsx`,
    `${D}/_components/record-row-link.tsx`,
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /<(input|textarea|select|form)\b/, `${rel} draws a field of its own — open the Maker’s editor instead`);
  }
});

test('only the parts another flow owns carry a quiet "Open … ›" link', () => {
  const linked = [...PAGE.matchAll(/<Section\s+k="([^"]+)"\s+open=\{/g)].map((m) => m[1]);
  assert.deepEqual(linked.sort(), ['budget', 'guests', 'purchases', 'services', 'suppliers'], 'an owned part grew an "Open … ›" link, or a money part lost its');
  // The old section doors to owned facts are gone.
  for (const gone of ["label: 'Open Event settings'", "label: 'Open in the Event Hub Maker'", "label: 'Open RSVP'", "label: 'Open Love Story'", "label: 'Open Mood Board'", "label: 'Open Schedule'"]) {
    assert.ok(!PAGE.includes(gone), `Event Details still sends an owned fact elsewhere: ${gone}`);
  }
});

test('opening a row writes nothing — a GET to its field, and nothing on that path writes', () => {
  assert.equal(recordFieldHref('E1', 'theme'), '/dashboard/E1/details/field/theme');
  assert.equal(recordRowOfPath('/dashboard/E1/details/field/reply-by'), 'reply-by');
  assert.equal(recordRowOfPath('/dashboard/E1/details'), null);
  assert.equal(parseRecordRow('not-a-row'), null, 'an address that names no row opens nothing');
  for (const row of Object.keys(RECORD_ROW_EDITOR)) assert.ok(RECORD_ROW_GROUP[row as keyof typeof RECORD_ROW_GROUP], `${row} sits in no fold`);

  const path = [
    `${D}/layout.tsx`,
    `${D}/@field/(.)field/[row]/page.tsx`,
    `${D}/@field/(.)field/[row]/loading.tsx`,
    `${D}/@field/default.tsx`,
    `${D}/@field/page.tsx`,
    `${D}/@field/[...catchAll]/page.tsx`,
    `${D}/field/[row]/page.tsx`,
    `${D}/_components/record-field-slot.tsx`,
    `${D}/_components/record-editor.tsx`,
    `${D}/_components/record-field-sheet.tsx`,
    `${D}/_components/record-fold.tsx`,
    `${D}/_components/record-row-link.tsx`,
  ];
  for (const rel of path) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/, `${rel} writes`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${rel} is a server action`);
    assert.doesNotMatch(src, /\bawait\s+(update|save|set|apply|hubDraft)\w*\(/, `${rel} calls a writer`);
  }
  // Actions reach the Maker's editors only BOUND, never called here.
  for (const action of ['updateSiteColors', 'updateSpecialMessage']) {
    const uses = [...EDITOR.matchAll(new RegExp(`${action}\\b(?!\\s*\\}\\s*from)[^\\n]*`, 'g'))].map((m) => m[0]);
    assert.ok(uses.length >= 1, `${action} is no longer handed to its editor`);
    for (const u of uses) assert.match(u, new RegExp(`${action}\\.bind\\(null, eventId\\)`), `${action} is used other than bound: ${u}`);
  }
  // The row itself is a link to that address — a GET.
  const link = read(`${D}/_components/record-row-link.tsx`);
  assert.match(link, /<Link\s+href=\{open \? recordHref : href\}/);
  assert.doesNotMatch(link, /onClick=/, 'the row does something on tap besides following its link');
});

test('a saved row lands in the draft and counts in Apply', () => {
  // The record carries the Maker's own Undo · Apply, for whoever may change the Hub.
  assert.match(PAGE, /\{canEditHub \? \([\s\S]{0,200}?<HubDraftDock eventId=\{eventId\} \/>/, 'Event Details lost the Maker’s Undo · Apply');
  assert.match(PAGE, /from '\.\.\/website\/_components\/hub-draft-dock'/);
  // Every Hub editor saves through the draft door (Event settings save live, on purpose — study § 2).
  for (const key of Object.keys(SAME_AS_THE_MAKER) as RecordEditorKey[]) {
    if (key === 'settings') continue;
    const src = read(SAME_AS_THE_MAKER[key].defined);
    assert.match(src, /hubDraftAction|HubDraftField/, `${RECORD_EDITOR_COMPONENT[key]} does not save into the Event Hub draft`);
  }
  // …and the row shows the drafted value until it is applied.
  assert.match(PAGE, /const shown = overlayHubDraftEvent\(e, draft\);/);
  assert.match(PAGE, /Waiting for Apply/);
});
