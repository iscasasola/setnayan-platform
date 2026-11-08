/**
 * 🗓 A DATE CHANGE AND A REMOVAL REQUEST CAN BE ANSWERED ON THE CLIENT THEY ARE ABOUT
 * (THE ONE BUILD, 8 Nov 2026 · A2 A8 · spec §3.2 · L2 brief "date-change and delete-request answers moved here").
 *
 *   1. ONE drawing: the client's Details mounts C1's `ClientDayAnswers` (`app/vendor-dashboard/_components/
 *      client-day-answers.tsx`), which draws Today's own `DateChangeBody` / `DeleteRequestBody` (exported from
 *      `overview-sections.tsx`, never copied) inside the shipped `UndoableAnswers` holder.
 *   2. ONE way to write: the bodies are handed the shipped actions — `vendorAnswerDateChange`,
 *      `vendorAgreeToDeletion`, `vendorDeclineDeletion` — and nothing else; each posts `return_to` = this client, and
 *      the actions honour it (`dayAnswerBack`), so an answer given on Details lands back on Details.
 *   3. ONE read: `lib/client-day-answers.server.ts` (Today's `readDateChangeAsks` / `readDeletionRequests`, narrowed to
 *      this event); a refused read says so, never "nothing to answer".
 *   4. The client page mounts it for a BOOKED client, on Details, beside the other answers.
 *
 * INTEGRATION (8 Nov): L2 and C1 each built a mount for these answers (`client-desk-answers.tsx` · `client-day-answers.tsx`)
 * — two mechanisms for one fact. C1's is the spec's (§9 #2: "the A8 bodies, which C1 delivers as components"); L2's was
 * deleted and this guard re-aimed at the one that stays.
 *
 * SABOTAGE (integration, done once): mounting `<ClientDeskAnswersBlock` back on Details → test 4 RED; dropping the
 * `return_to` input from `DateChangeBody` → test 2 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const MOUNT = read('../../_components/client-day-answers.tsx');
const SECTIONS = read('../../_components/overview-sections.tsx');
const ACTIONS = read('actions.ts');

test('1 · one drawing — Today’s own bodies, inside the shipped Undo holder', () => {
  assert.match(SECTIONS, /^export function DateChangeBody\(/m);
  assert.match(SECTIONS, /^export function DeleteRequestBody\(/m);
  assert.match(MOUNT, /import \{ DateChangeBody, DeleteRequestBody \} from '\.\/overview-sections';/);
  assert.match(MOUNT, /import \{ UndoableAnswers \} from '\.\/undoable-answers';/);
  const held = MOUNT.slice(MOUNT.indexOf('<UndoableAnswers>'), MOUNT.indexOf('</UndoableAnswers>'));
  assert.ok(held.includes('<DeleteRequestBody') && held.includes('<DateChangeBody'), 'an answer is drawn outside the Undo holder');
  assert.doesNotMatch(MOUNT, /<form\b/, 'the mount drew its own form — the bodies own their answers');
  assert.ok(!existsSync(join(HERE, '_components/client-desk-answers.tsx')), 'a second mount for the same two answers is back');
});

test('2 · one way to write — the shipped actions only, and the answer lands back on this client', () => {
  assert.match(MOUNT, /answerDateChange=\{vendorAnswerDateChange\} returnTo=\{back\}/);
  assert.match(MOUNT, /agreeDeletion=\{vendorAgreeToDeletion\} declineDeletion=\{vendorDeclineDeletion\} returnTo=\{back\}/);
  assert.match(MOUNT, /from '\.\.\/clients\/\[eventId\]\/actions';/);
  assert.match(MOUNT, /const back = `\/vendor-dashboard\/clients\/\$\{eventId\}`;/);
  const bodies = SECTIONS.slice(SECTIONS.indexOf('function DateChangeBody('), SECTIONS.indexOf('\n}\n', SECTIONS.indexOf('function DeleteRequestBody(')));
  assert.equal((bodies.match(/name="return_to" value=\{returnTo\}/g) ?? []).length, 4, 'a date/removal answer form dropped its return_to');
  for (const fn of ['vendorAnswerDateChange', 'answerDeletionRequest']) {
    const start = ACTIONS.indexOf(fn === 'answerDeletionRequest' ? 'async function answerDeletionRequest(' : `export async function ${fn}(`);
    const body = ACTIONS.slice(start, ACTIONS.indexOf('\n}\n', start));
    assert.doesNotMatch(body, /redirect\(['`]\/vendor-dashboard\?/, `${fn} throws the supplier back to Today regardless of where they answered`);
    assert.match(body, /redirect\(dayAnswerBack\(formData, /);
  }
  assert.match(ACTIONS, /back\.startsWith\('\/vendor-dashboard\/clients\/'\) \? `\$\{back\}\?tab=details&\$\{flag\}` : `\/vendor-dashboard\?\$\{flag\}`/);
});

test('3 · one read, narrowed to this event, and a refusal is said', () => {
  const r = read('../../../../lib/client-day-answers.server.ts');
  assert.match(r, /readDateChangeAsks\(admin, vendorProfileId\)/);
  assert.match(r, /readDeletionRequests\(admin, vendorProfileId\)/);
  assert.match(r, /\.filter\(\(r\) => r\.event_id === eventId\)/);
  assert.match(r, /complete: dates\.complete && deletions\.complete/);
  assert.match(MOUNT, /couldn’t load/);
});

test('4 · the client page mounts it for a booked client, on Details', () => {
  const page = read('page.tsx');
  const details = page.slice(page.indexOf('const detailsShipped = ('), page.indexOf('const bodies = pickedPageBodies('));
  assert.match(details, /\{askAnswerBlock\}[\s{}]*\{isBooked \? \(\s*<ClientDayAnswers\b/);
  assert.doesNotMatch(page, /ClientDeskAnswersBlock|readClientDeskAnswers/);
});
