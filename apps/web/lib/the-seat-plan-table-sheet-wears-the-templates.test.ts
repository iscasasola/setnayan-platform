/**
 * the-seat-plan-table-sheet-wears-the-templates.test.ts — THE TABLE'S SHEET ON A PHONE IS THE TEMPLATES' (2026-10-09, owner on the live Seat plan: *"toolbar is not fixed as well"*;
 * `INTERACTION_RULES.md` § 9). Seating logic is not touched: every handler is the editor's own, handed into `PhoneTableDock` (`seat-plan-phone.tsx`).
 *
 * control → kind:
 *   Table name                           → Form row (`TypedRow`; kept — `renameTable` — when it is left, as the box saved on blur; required: an empty name was ignored by the editor)
 *   Round ▾ (the table's shape)          → Dropdown row (`ChosenRow`, the house `PickMenu`)
 *   − 10/10 +  (seats)                   → NOT MOVED: the app has no counter template (`slider.tsx` is a range; no stepper) — left as it was, handlers untouched
 *   Rotate · Edit chairs… · Link… · Unlink → Action button, one row (Link… wears the brand tone while it is waiting for the next table)
 *   Done                                 → Action button (the row's one filled step, brand)
 *   Delete this table                    → Action button (danger, quiet) → the delete's confirm is the centred confirm box (`GuestPopup kind="confirm"`, Cancel first)
 *   Unseat (a seated guest's row)        → Action button (neutral, quiet) — "tap · move" and the P1 pill are the guest row's own and stay
 *   Seat people · the Seat N removed · Undo strip → NOT MOVED here (the editor's own nodes, handed in; "Seat people" shows only outside Details)
 * SAVES: `the-seat-plan-table-sheet-posts-the-same.golden.json` — which handler each press called BEFORE (recorded in Chromium); the after-run matched in every press but the two
 * differences its `_about` names.
 *
 * SABOTAGE (each seen RED, then restored): the name as a bare input again · Rotate as a hand-made button · Delete as a plain red link · the confirm as the old bottom sheet · Unseat as a
 * hand-made button · Rotate calling another handler · the Done two-colour clash back · a template import into a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const WEB = join(__dirname, '..');
const S = 'app/dashboard/[eventId]/seating/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const golden = JSON.parse(readFileSync(join(__dirname, 'the-seat-plan-table-sheet-posts-the-same.golden.json'), 'utf8')) as Record<string, unknown>;
const tags = (m: string, tag: string) => [...m.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((x) => x[0]);

async function dock(over: Record<string, unknown> = {}) {
  const { PhoneTableDock } = await import(`../${S}/seat-plan-phone`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const noop = () => {};
  return renderToStaticMarkup(
    React.createElement(PhoneTableDock as never, {
      tableId: 'T10', tableLabel: 'Table 10', typeValue: 'round', typeWord: 'Round',
      typeOptions: [{ key: 'round', label: 'Round', group: 'Round' }],
      onRename: noop, onPickType: noop,
      seatsStepper: React.createElement('span', { 'data-stub-stepper': '' }, React.createElement('button', { type: 'button', 'aria-label': 'Remove a chair' }, '−')),
      undoStrip: null, canEdit: true, onRotate: noop, onEditChairs: noop, linked: false, onUnlink: noop, linkPressed: false, onLink: noop, seatPeople: null, onDone: noop, onDelete: noop,
      ...over,
    } as never),
  );
}

test('1 · the sheet is the templates: the name is a Form row, the shape a dropdown row, every verb the ActionButton — one filled step, Done', async () => {
  for (const over of [{}, { linked: true }, { linkPressed: true }, { canEdit: false }]) {
    const m = await dock(over);
    assert.match(m, /data-seat-table-name=""[\s\S]*?data-form-row-kind="typed"|data-form-row-kind="typed"[^>]*data-seat-table-name=""/, 'the table’s name is not the Form row’s typed answer');
    assert.match(m, /data-form-row-kind="chosen"[\s\S]*?Shape[\s\S]*?aria-haspopup="listbox"[^>]*data-seat-plan-type=""/, 'the shape is not the dropdown row');
    assert.doesNotMatch(m, /<input\b/, 'a bare input is drawn in the table’s sheet');
    for (const b of tags(m, 'button')) assert.match(b, /class="ab |data-form-row-pill="typed"|aria-haspopup="listbox"|aria-label="Remove a chair"/, `a hand-made button on the table’s sheet: ${b.slice(0, 90)}`);
    assert.equal((m.match(/data-main=""/g) ?? []).length, 1, 'the sheet does not have exactly one filled step');
    assert.match(m, /class="ab ab-brand ab-main[^"]*"[^>]*>[\s\S]*?<span class="lbl">Done<\/span>/, 'Done is not the accent’s filled button with its word');
    assert.match(m, /<span class="lbl">Delete this table<\/span>/);
    assert.match(m, /class="ab ab-danger quiet[^"]*"[^>]*>[\s\S]{0,1500}Delete this table/, 'Delete this table is not the danger ActionButton');
    assert.doesNotMatch(m, /text-danger-600 underline/, 'Delete is a plain red link again');
  }
  const linked = await dock({ linked: true });
  assert.match(linked, /<span class="lbl">Unlink<\/span>/);
  assert.doesNotMatch(linked, /data-seat-plan-link/);
  const waiting = await dock({ linkPressed: true });
  assert.match(waiting, /data-seat-plan-link=""[^>]*>\s*<button[^>]*aria-pressed="true"[^>]*class="ab ab-brand/, 'a Link… waiting for the next table does not say so');
  const viewOnly = await dock({ canEdit: false });
  for (const w of ['Rotate', 'Edit chairs…', 'Link…', 'Delete this table']) assert.match(tags(viewOnly, 'button').find((t) => t.includes(`aria-label="${w}"`)) ?? '', /\bdisabled=""/, `${w} is pressable while someone else holds the editor`);
});

test('2 · the handlers are the editor’s own — each press called the one it names (the recorded golden) — and the editor hands them in untouched', () => {
  const calls = (k: string) => golden[k] as unknown[];
  assert.deepEqual(calls('pickType'), [['type', 'long']]);
  assert.deepEqual(calls('rotate'), [['rotate']]);
  assert.deepEqual(calls('editChairs'), [['editChairs']]);
  assert.deepEqual(calls('link'), [['link']]);
  assert.deepEqual(calls('unlink'), [['unlink']]);
  assert.deepEqual(calls('done'), [['done']]);
  assert.deepEqual(calls('delete'), [['delete']]);
  assert.deepEqual(calls('renameBlur'), [['rename', 'Table Ten']]);
  assert.deepEqual(calls('renameEnter'), [['rename', 'Table Eleven']]);
  assert.deepEqual(golden.viewOnly, ['Rotate', 'Edit chairs…', 'Link…', 'Delete this table']);
  const ed = read(`${S}/seating-editor.tsx`);
  const use = ed.slice(ed.indexOf('<PhoneTableDock'), ed.indexOf('/>', ed.indexOf('onDelete={')) + 2);
  for (const want of [
    'onRename={(label) => renameTable(st.table_id, label)}',
    "onPickType={(k) => changeStyle(st, k as TableType)}",
    'onRotate={() => rotateTable(st, 90)}',
    'onEditChairs={() => { setEditChairs(true); setPickerOpen(false); setShapePickerOpen(false); }}',
    'onUnlink={() => doUnlink(st.table_id)}',
    'onDone={() => { setLinkFrom(null); clearSelection(); }}',
    'onDelete={() => requestRemoveTable(st)}',
  ]) assert.ok(use.includes(want), `the editor hands another handler: ${want}`);
  const phone = read(`${S}/seat-plan-phone.tsx`);
  assert.match(phone, /onKeep=\{\(label\) => \{\s*onRename\(label\);\s*return \{ ok: true as const \};\s*\}\}/, 'the name is kept through another door than `renameTable`');
  assert.match(phone, /<ActionButton tone="neutral" icon=\{RotateCw\} label="Rotate" disabled=\{!canEdit\} onClick=\{onRotate\} \/>/);
});

test('3 · Delete confirms in the centred box (the template), the same two answers; Unseat is the quiet ActionButton with the same handler', () => {
  const ed = read(`${S}/seating-editor.tsx`);
  assert.match(ed, /<GuestPopup kind="confirm" onClose=\{\(\) => setConfirmDelete\(null\)\}/);
  assert.match(ed, /keep=\{<ActionButton tone="neutral" icon=\{X\} label="Cancel" onClick=\{\(\) => setConfirmDelete\(null\)\} \/>\}/);
  assert.match(ed, /tone="danger"\s+main\s+icon=\{Trash2\}\s+label=\{joined \? 'Delete unit' : 'Delete table'\}\s+onClick=\{\(\) => \{\s*confirmDelete\.members\.forEach\(\(m\) => removeTable\(m\.table_id\)\);\s*setConfirmDelete\(null\);/);
  assert.doesNotMatch(ed, /fixed inset-0 z-\[60\] flex items-end justify-center bg-ink\/40/, 'the old bottom-sheet confirm is back');
  assert.match(ed, /<ActionButton tone="neutral" quiet icon=\{UserMinus\} label="Unseat" name=\{`Unseat \$\{g\.name\}`\} onClick=\{\(\) => unseat\(g\.guest_id\)\} \/>/, 'Unseat is not the quiet ActionButton with the same handler');
  /* An empty table still deletes in one tap; one with seated guests asks first (the editor's own rule — untouched). */
  assert.match(ed, /if \(seatedAt\(t\.table_id\) === 0\) removeTable\(t\.table_id\);\s*else setConfirmDelete/);
});

test('4 · no lab draws the seat plan, and the first load stays clear of the sheet’s templates', () => {
  for (const f of ['maker-details.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'details-lazy.tsx']) {
    const src = read(`app/dashboard/[eventId]/launch/_components/${f}`).replace(/^import type [^;]*;$/gm, '').replace(/import\(\/\*[^*]*\*\/ '[^']*'\)/g, '');
    assert.doesNotMatch(src, /seat-plan-phone|seating-editor|guests\/_components\/guest-popup|from '@\/app\/_components\/form-row'|from '@\/components\/action-button'/, `${f} imports the table sheet or a template statically`);
  }
});
