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
import { DIDNT_SAVE, plainSaveError, plainSaveWords } from '@/lib/plain-save-error';

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
  // The fallback is the page's own sentence — "Couldn't delete …", or for Release seat "Couldn't release …" (`couldnt`).
  assert.match(del, /const said = plainRefusal\(result\.error, (couldntDelete\(whom\)|couldnt)\);\s*guestToast\.error\(said\);\s*return said;/);
  assert.match(del, /const couldnt = o\.release \? `Couldn’t release [^`]*` : couldntDelete\(whom\);/, 'Release seat’s fallback is not its own sentence');
  assert.doesNotMatch(del, /guestToast\.error\(result\.error\)|return result\.error/);
  assert.match(del, /plainRefusal\(r\.warning, /, 'an undo warning prints raw');
  // The name box's refusal is said on the name's own row since 2026-10-19 (the add queue — guest-add-queue.ts).
  assert.match(read('guest-add-queue.ts'), /res\.error \? plainRefusal\(res\.error, FALLBACK\)/, 'a refused add prints the action’s words');
  assert.match(read('..', 'invite', '_components', 'regenerate-qr-button.tsx'), /toast\.error\(plainRefusal\(result\.error, /);
  const q = read('quick-add-sheet.tsx');
  assert.equal((q.match(/setError\(res\.error\)/g) ?? []).length, 0, 'quick add prints a raw refusal');
  // Two — Add role too · Change role; the guest write itself is refused on its row through the queue (2026-10-19).
  assert.equal((q.match(/setError\(plainRefusal\(res\.error, /g) ?? []).length, 2);
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

/* ── SW-RAWDB (final check 25 Nov 2026, plan batch A-7): the same rule, widened to every action of the sweep ── */

const WEB = join(HERE, '..', '..', '..', '..', '..');
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Shapes that carry the database's words toward a screen. */
const RAW_SHAPES = [
  /encodeURIComponent\(\s*[A-Za-z_.]*(?:error|Error|Err)\??\.message/,
  /encodeURIComponent\(\s*'[a-z_]+: ' \+ \w+\.message/,
  /encodeURIComponent\(\(e as Error\)\.message/,
  /error:\s*error\.message\.slice\(/,
  /message:\s*\w*Err\.message/,
  /:\s*error\.message\.slice\(0, 80\)/,
  /We could not add them: \$\{/,
  /body=\{readyErr\?\.message/,
  /body=\{linked\.message\}/,
  /\?error=\$\{encodeURIComponent\(result\.error\)/,
];

const SW_RAWDB_ACTION_FILES = [
  'app/host/accept/[token]/actions.ts',
  'app/dashboard/[eventId]/sponsors/actions.ts',
  'app/dashboard/[eventId]/disputes/actions.ts',
  'app/dashboard/[eventId]/guests/new/actions.ts',
  'app/dashboard/[eventId]/guests/import/actions.ts',
  'app/dashboard/(account)/samahan/actions.ts',
  'app/samahan/join/[token]/actions.ts',
  'app/vendor/claim/[token]/finalize/page.tsx',
  'app/dashboard/(account)/clusters/actions.ts',
  'app/dashboard/[eventId]/studio/papic/moderation/actions.ts',
  'app/dashboard/[eventId]/studio/guest-columns/actions.ts',
  'app/dashboard/[eventId]/studio/mood-board/actions.ts',
  'app/dashboard/[eventId]/studio/photo-delivery/actions.ts',
];

test('SW-RAWDB: no action of the sweep hands the database’s own words to a person', () => {
  for (const f of SW_RAWDB_ACTION_FILES) {
    const s = readWeb(f);
    for (const re of RAW_SHAPES) assert.doesNotMatch(s, re, `${f} still carries raw database text (${re})`);
    assert.doesNotMatch(s, /error: \w+\.message \}/, `${f} returns error.message`);
  }
});

test('SW-RAWDB: the one mapper says what to do, and never a database word (fixtures)', () => {
  const [origError, origWarn] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    for (const message of RAW) {
      const words = plainSaveError('test', { message });
      assert.ok(isPlainSentence(words.replace(' · ', ', ')), `not a plain sentence: ${words}`);
      for (const leak of ['violates', 'constraint', 'policy', 'uuid', 'JWT', 'PGRST', 'schema', 'column']) {
        assert.ok(!words.includes(leak), `${leak} reached the screen from: ${message}`);
      }
    }
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
  assert.equal(plainSaveWords({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }), 'That’s already there — check the list, then try again.');
  assert.equal(plainSaveWords({ code: '42501', message: 'permission denied for table guests' }), 'You can’t change this here. Ask a host of this event.');
  assert.equal(plainSaveWords({ message: 'new row violates row-level security policy for table "guests"' }), 'You can’t change this here. Ask a host of this event.');
  assert.equal(plainSaveWords({ code: '23503' }), 'Something this needs was changed meanwhile. Reload, then try again.');
  assert.equal(plainSaveWords({ message: 'TypeError: fetch failed' }), 'Couldn’t reach Setnayan. Check your connection, then try again.');
  assert.equal(plainSaveWords({ code: 'XX000', message: 'column guests.foo does not exist' }), DIDNT_SAVE);
  assert.equal(plainSaveWords(null), DIDNT_SAVE);
  // A screen that is not an event's says its own "not allowed"; every other refusal keeps the shared words.
  const voice = { notAllowed: 'You can’t change this group of events. Only the person who made it can.' };
  assert.equal(plainSaveWords({ code: '42501' }, voice), voice.notAllowed);
  assert.equal(plainSaveWords({ code: '23505' }, voice), 'That’s already there — check the list, then try again.');
  assert.match(readWeb('app/dashboard/(account)/clusters/actions.ts'), /plainSaveError\('clusters', \w+, CLUSTER_VOICE\)/);
});
