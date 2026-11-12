/**
 * 📋 PIECE 3a — FORMS: VIEW FIRST, AN EDIT SAVES A NEW FORM WITH THE EVENT (DECISION_LOG 2026-11-12).
 *
 * The pure rules (the couple's title, the one state word both sides read) and the source anchors that keep the flow
 * honest: a client's page opens a form read-only first; Edit there builds a COPY for the event (no item id carried —
 * an id would re-point the ORIGINAL's question into the copy); the save inserts a new row with `for_event_id`; the
 * library read filters `in_library`; the couple reads one "Forms from <shop>" list. The schema half is
 * tests/db/an-edited-form-stays-with-its-event.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORM_TITLE_MAX, sentFormState, titleForCouple } from './vendor-forms';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the copy is named for the couple, never twice, inside the title limit', () => {
  assert.equal(titleForCouple('Any allergies at the table?', 'Ana & Miguel'), 'Any allergies at the table? · for Ana & Miguel');
  assert.equal(titleForCouple('Any allergies at the table? · for Ana & Miguel', 'Ana & Miguel'), 'Any allergies at the table? · for Ana & Miguel');
  const long = titleForCouple('x'.repeat(200), 'Ana & Miguel');
  assert.ok(long.length <= FORM_TITLE_MAX, 'the copy outgrew the title column');
  assert.ok(long.endsWith(' · for Ana & Miguel'));
});

test('one state word: Final beats everything; then All answered; Answered N of M; Open', () => {
  assert.equal(sentFormState({ locked: true, answered: 0, total: 3 }).words, 'Final');
  assert.equal(sentFormState({ answered: 3, total: 3 }).words, 'All answered');
  assert.equal(sentFormState({ answered: 2, total: 3 }).words, 'Answered 2 of 3');
  assert.equal(sentFormState({ answered: 0, total: 3 }).words, 'Open · not answered yet');
});

test('a client’s page opens a form read-only first, and its Edit builds a copy for the event', () => {
  const body = read('app/vendor-dashboard/forms/_components/forms-page-body.tsx');
  assert.match(body, /const openForm = \(f: ShopForm\) => \(eventId \? setViewing\(f\) : edit\(f\)\);/, 'a client’s form row jumps straight into the maker again');
  assert.match(body, /onClick=\{\(\) => openForm\(f\)\}/, 'the library row no longer opens the view first');
  const editFn = body.slice(body.indexOf('const editFromView'), body.indexOf('const openForm'));
  assert.match(editFn, /editedFromFormId: f\.formId/, 'the copy forgot which form it was edited from');
  assert.match(editFn, /const \{ id: _id, \.\.\.rest \} = draftItemOf\(r\)/, 'the copy carries the original’s item ids — a save would move the ORIGINAL’s questions');
  assert.match(editFn, /inLibrary: false/, '“Also keep in my library” must start OFF (the ruling: the edit stays with the event)');
});

test('the save inserts the new row for the event, and never links an event-only form to a card', () => {
  const act = read('app/vendor-dashboard/forms/actions.ts');
  assert.match(act, /for_event_id: draft\.forEventId, edited_from_form_id: draft\.editedFromFormId \?\? null, in_library: draft\.inLibrary === true/);
  assert.match(act, /if \(eventOnly\) draft = \{ \.\.\.draft, serviceIds: \[\] \};/);
  assert.match(act, /items: draft\.items\.map\(\(\{ id: _id, \.\.\.rest \}\) => rest as FormItemDraft\)/, 'a NEW form re-points carried item ids');
  assert.match(act, /if \(op === 'keep'\)/, '“Save to my library” lost its op');
});

test('the library read filters in_library; the event’s own forms come back beside it', () => {
  const srv = read('lib/vendor-forms.server.ts');
  assert.match(srv, /formsQ\.eq\('in_library', true\)/, 'the library lists event-only forms again');
  assert.match(srv, /in_library\.eq\.true,for_event_id\.eq\.\$\{eventId\}/);
  assert.match(srv, /\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(forEvent\)/, 'an unchecked id reaches the PostgREST or= filter');
});

test('the couple reads ONE "Forms from <shop>" list, open ones first', () => {
  const card = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-forms-card.tsx');
  assert.match(card, /<FormsFromShopList/);
  assert.match(card, /const RANK = \{ open: 0, some: 1, all: 2, final: 3 \} as const;/, 'open forms no longer sort first');
  assert.match(card, /\.select\('form_id, sent_at, locked'\)/, 'the couple can no longer see which forms are Final');
});
