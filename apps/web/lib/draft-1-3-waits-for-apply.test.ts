/**
 * ⏳ "DRAFT 1-3" WAITS FOR APPLY (owner 2026-10-08, verbatim *"draft 1-3"*): in the Maker,
 *
 *   1 · the opening line   — `print_details.opening_line` (Info and Prints, via the words form);
 *   2 · the thank-you words — `events.pabuya_message` (E-Gifts / Prints › Finer Details);
 *   3 · Reply by           — `events.guest_list_edit_deadline` (`updatePaxSettings`);
 *
 * go into the hub DRAFT and reach the live column only at ✓ Apply. Item 4, the Event Hub address,
 * stays live. E-Gifts' WAYS TO GIVE are rows of `event_egift_methods`, not an `events` column — not
 * drafted here (the draft holds only `events` columns and section rows; reported, a shape change).
 *
 * For each field: A · the draft holds it (sanitised the way its live writer cleans it); B · the
 * Maker's write goes to the draft and NOT to the live column; C · the Maker reads it draft-over-live;
 * D · Apply writes it to the live column (merged, for the opening line).
 *
 * 🛡 Sabotaged once each (2026-10-08), each red alone: `savePabuyaMessage`'s draft branch removed →
 * B; Apply's `openingLine: openingLineWrite` merge removed → D; the Reply-by fd without the draft
 * field → B.
 * ⤷ Preview merge 2026-10-08 (the Reply-by field had moved into the shared `ReplyBy` part): `draft`
 * dropped from one Maker mount → B; the part's `if (draft)` line removed → B; the part's live note
 * shown regardless of `draft` → C and the Maker's render (`details-words-and-plans.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_EVENT_READ_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  printDetailsKeysChanged,
  sanitizeHubDraftEventValue,
} from './hub-draft';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';

test('A · the draft holds the three — cleaned as their live writers clean them; the address is not drafted', () => {
  for (const c of ['pabuya_message', 'guest_list_edit_deadline', 'print_details'])
    assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(c), `${c} is not draftable`);
  assert.ok(!(HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes('slug'), 'the Event Hub address is drafted (it stays live)');
  assert.ok(!(HUB_DRAFT_EVENT_READ_COLUMNS as readonly string[]).includes('guest_list_edit_deadline'), 'Reply by joined the session-client live read (its readers are admin-only)');
  assert.equal(sanitizeHubDraftEventValue('pabuya_message', '  Thank you  '), 'Thank you');
  assert.equal(sanitizeHubDraftEventValue('pabuya_message', 'x'.repeat(900))?.toString().length, 600, 'the thank-you words are not capped as `cleanPabuyaMessage` caps them');
  assert.equal(sanitizeHubDraftEventValue('guest_list_edit_deadline', '2027-01-14'), '2027-01-14');
  assert.equal(sanitizeHubDraftEventValue('guest_list_edit_deadline', '2027-02-30'), undefined, 'a day that does not exist is drafted');
  assert.equal(sanitizeHubDraftEventValue('guest_list_edit_deadline', null), null, 'Reply by cannot go back to the default');
  assert.deepEqual(sanitizeHubDraftEventValue('print_details', { opening_line: '  Together   with their families ', menu: ['x'] }), { opening_line: 'Together with their families' }, 'the opening line is not drafted alone and cleaned');
  /* A second drafted key never drops the first (merged inside `print_details`). */
  const one = mergeHubDraft(emptyHubDraft(), { events: { print_details: { name_style: 'surname-first' } } });
  const two = mergeHubDraft(one, { events: { print_details: { opening_line: 'With joy' } } });
  assert.deepEqual(two.events.print_details, { name_style: 'surname-first', opening_line: 'With joy' }, 'drafting the opening line dropped the drafted name style');
  assert.deepEqual(printDetailsKeysChanged({ opening_line: 'Old' }, { opening_line: 'With joy' }), ['opening_line'], 'Apply does not see the opening line move');
  assert.deepEqual(printDetailsKeysChanged({ opening_line: 'Same' }, { opening_line: 'Same' }), [], 'an unchanged opening line counts as a change');
});

test('B · the Maker writes each into the DRAFT, never the live column', () => {
  const pab = read(`${D}/pabuya/actions.ts`);
  const save = pab.slice(pab.indexOf('export async function savePabuyaMessage('));
  const draftAt = save.indexOf("if (isHubDraftWrite(formData) && 'pabuya_message' in patch)");
  assert.ok(draftAt > 0, 'savePabuyaMessage has no draft branch');
  assert.ok(draftAt < save.indexOf('.update(patch)'), 'the draft branch comes after the live write');
  assert.match(save.slice(draftAt), /saveHubDraftPatch\(eventId, \{ events: \{ pabuya_message: patch\.pabuya_message \?\? null \} \}\);[\s\S]{0,200}delete patch\.pabuya_message;/, 'the drafted words still reach the live write');
  const editor = read(`${D}/pabuya/_components/pabuya-message-editor.tsx`);
  assert.match(editor, /if \(maker\) fd\.set\(HUB_DRAFT_FIELD, '1'\);/, 'the Maker’s thank-you editor does not ask for the draft');

  const pax = read(`${D}/actions.ts`);
  const upd = pax.slice(pax.indexOf('export async function updatePaxSettings('));
  const branch = upd.slice(upd.indexOf('if (isHubDraftWrite(formData)) {'), upd.indexOf('.update({ guest_list_edit_deadline: deadline, adaptive_pricing_mode: mode })'));
  assert.ok(branch.length > 0, 'updatePaxSettings has no draft branch before its live write');
  assert.match(branch, /saveHubDraftPatch\(eventId, \{ events: \{ guest_list_edit_deadline: deadline \} \}\);[\s\S]*return \{ ok: true \};/, 'a drafted Reply by also reaches the live column');
  assert.doesNotMatch(branch, /guest_list_edit_deadline: deadline,? adaptive|update\(\{ guest_list_edit_deadline/, 'the draft branch writes the live date');
  /* ⤷ Preview merge 2026-10-08: the field is the shared `ReplyBy` part now (#6409, Guests › Setup mounts it too,
     and there — no Apply — it stays live). The Maker asks for the draft by mounting it with `draft`: every
     editable (`stack`) mount in the Maker carries it, and the part sends the draft field for it. */
  const replyByPart = read(`${D}/_components/guest-setup/reply-by.tsx`);
  assert.match(replyByPart, /fd\.set\('maker_quiet', '1'\);\s*if \(draft\) fd\.set\(HUB_DRAFT_FIELD, '1'\);/, 'the Maker’s Reply by does not ask for the draft');
  const makerRsvp = read(`${D}/launch/_components/maker-rsvp-ask.tsx`);
  const stackMounts = makerRsvp.match(/<ReplyBy\s+layout="stack"[\s\S]*?\/>/g) ?? [];
  assert.ok(stackMounts.length >= 2, `the Maker mounts ${stackMounts.length} editable Reply by fields — the stage and Event Details each have one`);
  for (const mount of stackMounts) assert.match(mount, /\baction=\{replyByAction\}\s+draft\s*\/>$/, 'a Maker Reply by field writes the live date');
  assert.doesNotMatch(read(`${D}/_components/guest-setup/guest-setup-rows.tsx`), /<ReplyBy\b[^>]*\bdraft\b/, 'Guests › Setup drafts Reply by — it has no Apply to publish it');

  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /const draftLine = form\.get\('opening_line_to_draft'\) === '1' && form\.has\('opening_line'\);/);
  assert.match(route, /saveHubDraftPatch\(eventId, \{ events: \{ print_details: \{ opening_line: words\.openingLine \} \} \}\)/, 'the opening line is not drafted');
  assert.match(route, /openingLine: draftLine \? stored\.openingLine : words\.openingLine/, 'a drafted opening line still reaches the live blob');
  assert.match(read(`${D}/launch/_components/maker-details.tsx`), /<input type="hidden" name="opening_line_to_draft" value="1" \/>/, 'the Maker’s words form does not draft the opening line');
});

test('C · the Maker reads each draft-over-live; the host preview overlays them', () => {
  const page = read(`${D}/launch/page.tsx`);
  assert.match(page, /if \(d && 'pabuya_message' in d\.events\) pabuyaMessage = /);
  assert.match(page, /pabuyaMessage=\{pabuyaMessage\}/, 'Details reads the live thank-you words');
  assert.match(page, /draftedDeadline !== undefined \? draftedDeadline : /);
  assert.doesNotMatch(page, /\(deadlineRes\.data\?\.guest_list_edit_deadline as string \| null\) \?\? null,/, 'a Reply-by door still reads live only');
  assert.match(page, /if \(draftedOpeningLine !== undefined\) stored\.openingLine = draftedOpeningLine;/, 'the opening line is read live only');
  const row = overlayHubDraftEvent(
    { pabuya_message: 'live words', print_details: { opening_line: 'Live line', name_style: 'full' } } as Record<string, unknown>,
    { events: { pabuya_message: 'drafted words', print_details: { opening_line: 'Drafted line' } }, widgets: {} } as never,
  );
  assert.equal(row.pabuya_message, 'drafted words');
  assert.deepEqual(row.print_details, { opening_line: 'Drafted line', name_style: 'full' }, 'the preview loses the live name style or the drafted line');
  /* No "Guests see this right away" on them any more. */
  const details = read(`${D}/launch/_components/maker-details.tsx`);
  assert.doesNotMatch(details, /<HubSavesImmediately\s*\/>\s*<PabuyaMessageEditor/, 'the thank-you words still say they save immediately');
  assert.doesNotMatch(read(`${D}/launch/_components/maker-rsvp-ask.tsx`), /<HubSavesImmediately/, 'Reply by still says it saves immediately');
  assert.match(read(`${D}/_components/guest-setup/reply-by.tsx`), /\{draft \? null : <HubSavesImmediately \/>\}/, 'the Maker’s drafted Reply by still says it saves immediately');
});

test('D · Apply writes each to the live column — Reply by through the admin client, the line merged', () => {
  const a = read(`${D}/website/hub-draft-actions.ts`);
  assert.match(a, /const deadlineWrite =\s*'guest_list_edit_deadline' in eventsPatch/);
  assert.match(a, /delete eventsPatch\.guest_list_edit_deadline;/, 'Reply by rides the session update (no grant)');
  assert.match(a, /if \(deadlineWrite !== undefined\) \{\s*const admin = createAdminClient\(\);[\s\S]{0,300}\.update\(\{ guest_list_edit_deadline: deadlineWrite \}\)/, 'Apply does not write Reply by');
  assert.match(a, /dlRows\.length === 0/, 'a zero-row Reply-by write counts as applied');
  assert.match(a, /openingLine: openingLineWrite/, 'Apply does not merge the opening line');
  assert.match(a, /nameStyleWrite !== undefined \|\| passDesignWrite !== undefined \|\| openingLineWrite !== undefined/, 'a lone drafted opening line is never written');
  /* `pabuya_message` rides the session update — its UPDATE grant is 20271230123132. */
  assert.ok((HUB_DRAFT_EVENT_READ_COLUMNS as readonly string[]).includes('pabuya_message'));
  const grant = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271230123132_pabuya_message.sql'), 'utf8');
  assert.match(grant, /GRANT UPDATE \(pabuya_message\) ON public\.events TO authenticated;/);
});
