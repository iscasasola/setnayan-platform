/**
 * 🗓 A DATE CHANGE AND A REMOVAL REQUEST CAN BE ANSWERED ON THE CLIENT THEY ARE ABOUT
 * (THE ONE BUILD, 8 Nov 2026 · A2 A8 · spec §3.2 · L2 brief "date-change and delete-request answers moved here").
 *
 *   1. ONE drawing: the client's Details mounts Today's own `DateChangeBody` / `DeleteRequestBody` (exported from
 *      `overview-sections.tsx`, never copied), inside the shipped `UndoableAnswers` holder, each in a
 *      `data-today-ask` row so the press finishes in its row with Undo.
 *   2. ONE way to write: the bodies are handed the shipped actions — `vendorAnswerDateChange`,
 *      `vendorAgreeToDeletion`, `vendorDeclineDeletion` — and nothing else.
 *   3. ONE read: Today's `readDateChangeAsks` / `readDeletionRequests`, narrowed to this event; a refused read says
 *      so in a line, never "nothing to answer".
 *   4. The client page reads them only for a BOOKED client and mounts them on Details, beside the other answers.
 *
 * SABOTAGE (done once, 8 Nov): dropping `failed:` from the read → test 3 RED; mounting outside `<UndoableAnswers>`
 * → test 1 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const MOUNT = read('_components/client-desk-answers.tsx');
const SECTIONS = read('../../_components/overview-sections.tsx');

test('1 · one drawing — Today’s own bodies, inside the shipped Undo holder', () => {
  assert.match(SECTIONS, /^export function DateChangeBody\(/m);
  assert.match(SECTIONS, /^export function DeleteRequestBody\(/m);
  assert.match(MOUNT, /import \{ DateChangeBody, DeleteRequestBody \} from '\.\.\/\.\.\/\.\.\/_components\/overview-sections';/);
  assert.match(MOUNT, /import \{ UndoableAnswers \} from '\.\.\/\.\.\/\.\.\/_components\/undoable-answers';/);
  const held = MOUNT.slice(MOUNT.indexOf('<UndoableAnswers>'), MOUNT.indexOf('</UndoableAnswers>'));
  assert.ok(held.includes('<DeleteRequestBody') && held.includes('<DateChangeBody'), 'an answer is drawn outside the Undo holder');
  assert.equal((held.match(/data-today-ask=""/g) ?? []).length, 2, 'each answer finishes in its own row');
  assert.doesNotMatch(MOUNT, /<form\b/, 'the mount drew its own form — the bodies own their answers');
});

test('2 · one way to write — the shipped actions only', () => {
  assert.match(MOUNT, /answerDateChange=\{vendorAnswerDateChange\}/);
  assert.match(MOUNT, /agreeDeletion=\{vendorAgreeToDeletion\}/);
  assert.match(MOUNT, /declineDeletion=\{vendorDeclineDeletion\}/);
  assert.match(MOUNT, /from '\.\.\/actions';/);
});

test('3 · one read, narrowed to this event, and a refusal is said', () => {
  assert.match(MOUNT, /readDateChangeAsks\(admin, vendorProfileId\)/);
  assert.match(MOUNT, /readDeletionRequests\(admin, vendorProfileId\)/);
  assert.match(MOUNT, /\.filter\(\(dc\) => dc\.event_id === eventId\)/);
  assert.match(MOUNT, /\.filter\(\(dr\) => dr\.event_id === eventId\)/);
  assert.match(MOUNT, /failed: Boolean\(dates\.error\) \|\| Boolean\(deletes\.error\)/);
  assert.match(MOUNT, /Couldn&rsquo;t check for a date change or a removal request/);
});

test('4 · the client page reads them for a booked client and mounts them on Details', () => {
  const page = read('page.tsx');
  assert.match(page, /const deskAnswers = isBooked\s*\?\s*await readClientDeskAnswers\(/);
  const details = page.slice(page.indexOf('const detailsShipped = ('), page.indexOf('const bodies = pickedPageBodies('));
  assert.match(details, /\{askAnswerBlock\}\s*\{deskAnswers \? <ClientDeskAnswersBlock answers=\{deskAnswers\} \/> : null\}/);
});
