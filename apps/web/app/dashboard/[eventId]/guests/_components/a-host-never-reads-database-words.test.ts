/**
 * a-host-never-reads-database-words.test.ts — A REFUSAL IS TOLD IN ONE PLAIN SENTENCE.
 *
 * Controller, 2026-10-09, on a refused delete that printed "invalid input syntax for type uuid…" in the toast and in the
 * sheet: whatever the action returns, the page says its own plain sentence ("Couldn’t delete Daniel Ramos. Try again.");
 * the action's words are shown only when they are plainly a sentence written for a person. The raw text goes to the fault
 * report (`lib/telemetry/fault-observer.ts` records every `{ ok:false, error }` an action returns) — never the screen.
 *
 * SABOTAGE (each seen RED, then restored): the delete printing `result.error` again · the database-word list emptied ·
 * the lab's raw-looking refusal made a plain sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { couldntDelete, isPlainSentence, plainRefusal } from './plain-refusal';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

const RAW = [
  'invalid input syntax for type uuid: "g-mj-3"',
  'new row violates row-level security policy for table "guests"',
  'duplicate key value violates unique constraint "guests_pkey"',
  'JWT expired',
  'column guests.foo does not exist',
  'Could not find the function public.release_deleted_guest_song_requests(p_guest_ids) in the schema cache',
  'TypeError: Cannot read properties of undefined (reading \'ok\')',
  'fetch failed',
  'permission denied for table guests',
  'PGRST116: The result contains 0 rows',
  'Invalid input syntax for type uuid.',
  'New row violates row-level security policy for table guests.',
  'Duplicate key value violates unique constraint.',
  'Something went wrong in the guests_table.',
  '',
];
const PLAIN = [
  'The bride and groom can’t be removed — they’re the foundation of the event.',
  "The bride and groom can't be removed — they're the foundation of the event.",
  'Nothing selected.',
  'Add both a first and last name.',
  'Could not regenerate the QR — please try again.',
];

test('database words never become the sentence the page shows (fixtures)', () => {
  for (const raw of RAW) {
    assert.equal(plainRefusal(raw, 'FALLBACK'), 'FALLBACK', `printed to the host: ${raw}`);
    assert.equal(isPlainSentence(raw), false, `taken for a sentence: ${raw}`);
  }
  assert.equal(plainRefusal(null, 'FALLBACK'), 'FALLBACK');
  assert.equal(plainRefusal(undefined, 'FALLBACK'), 'FALLBACK');
});

test('a sentence written for a person is kept (fixtures)', () => {
  for (const raw of PLAIN) assert.equal(plainRefusal(raw, 'FALLBACK'), raw.trim(), `lost a plain sentence: ${raw}`);
});

test('the delete’s sentence names who', () => {
  assert.equal(couldntDelete('Daniel Ramos'), 'Couldn’t delete Daniel Ramos. Try again.');
  assert.equal(couldntDelete('3 guests'), 'Couldn’t delete 3 guests. Try again.');
});

test('the delete, the capture bar, Regenerate QR, quick add and Add-from-people print their own sentence, not the action’s', () => {
  const del = read('guest-delete.tsx');
  assert.match(del, /const said = plainRefusal\(result\.error, couldntDelete\(whom\)\);\s*guestToast\.error\(said\);\s*return said;/);
  assert.doesNotMatch(del, /guestToast\.error\(result\.error\)|return result\.error/);
  assert.match(del, /plainRefusal\(r\.warning, /, 'an undo warning prints raw');
  assert.match(read('capture-bar.tsx'), /toast\.error\(plainRefusal\(res\.error, /);
  assert.match(read('..', 'invite', '_components', 'regenerate-qr-button.tsx'), /toast\.error\(plainRefusal\(result\.error, /);
  const q = read('quick-add-sheet.tsx');
  assert.equal((q.match(/setError\(res\.error\)/g) ?? []).length, 0, 'quick add prints a raw refusal');
  assert.equal((q.match(/setError\(plainRefusal\(res\.error, /g) ?? []).length, 3);
  assert.match(q, /setGroupError\(plainRefusal\(res\.error, /);
  const p = read('add-from-people-sheet.tsx');
  assert.doesNotMatch(p, /setError\(res\.error\)|\$\{res\.firstError\}/, 'Add from your people prints a raw refusal');
});

test('the sheet is told the same sentence (it is what remove() resolves to), by name', () => {
  const screen = read('guests-screen.tsx');
  assert.match(screen, /const who = ids\.length === 1 \? removeNames\[0\] \|\| 'that guest' : `\$\{formatCount\(ids\.length\)\} guests`;/);
  const flow = read('guest-delete.tsx');
  assert.match(flow, /guestName,\s*\);/, 'the card’s delete does not pass the name');
});

test('the lab’s refusal is a raw-looking string ON PURPOSE — so this guard can prove it never reaches the screen', () => {
  const lab = readFileSync(join(HERE, '..', '..', '..', '..', 'dev', 'guests-lab', 'lab-guest-actions.tsx'), 'utf8');
  const m = /error: '([^']+)'/.exec(lab);
  assert.ok(m, 'the lab no longer refuses with a string');
  assert.equal(isPlainSentence(m![1] as string), false, 'the lab’s refusal reads as a plain sentence — it can no longer prove anything');
  assert.equal(plainRefusal(m![1] as string, couldntDelete('Daniel Ramos')), 'Couldn’t delete Daniel Ramos. Try again.');
});

test('the list page’s ?error= banner never prints a database message (it has spaces, so it used to pass as "prose")', async () => {
  const { guestListErrorCopy } = await import('./guest-list-error-copy');
  const neutral = "That didn't go through — please try again.";
  assert.equal(guestListErrorCopy(encodeURIComponent('invalid input syntax for type uuid: "g-mj-3"')), neutral);
  assert.equal(guestListErrorCopy(encodeURIComponent('new row violates row-level security policy for table "guests"')), neutral);
  assert.equal(guestListErrorCopy('invalid_group'), neutral, 'an unmapped code is shown');
  assert.equal(guestListErrorCopy('no_selection'), 'Select at least one guest first.');
  assert.equal(
    guestListErrorCopy(encodeURIComponent('The table could not be set just now. Please try again.')),
    'The table could not be set just now. Please try again.',
    'a sentence an action wrote for the host is lost',
  );
  assert.match(read('..', 'page.tsx'), /import \{ guestListErrorCopy \} from '\.\/_components\/guest-list-error-copy';/);
  assert.match(read('guest-list-error-copy.ts'), /return plainRefusal\(decoded, /);
});
