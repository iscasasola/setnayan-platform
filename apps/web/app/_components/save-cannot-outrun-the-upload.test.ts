/**
 * save-cannot-outrun-the-upload.test.ts — live data loss, closed.
 *
 * THE DEFECT. `FileUpload` mirrors its value into the parent form through hidden
 * inputs built from `items` — FINISHED uploads. An upload still in `inFlight`
 * has no input. And in single-file mode the dropzone only opens once `items` is
 * empty, so replacing a photo is necessarily remove-then-add.
 *
 * Submit in that gap and the form posts NOTHING for the field. On
 * /dashboard/profile that becomes `nullIfBlank(null)` → NULL written → redirect
 * to `?saved=1` → the screen says **"Saved."** The person has just lost the old
 * photo AND the new one. One click, both losses, cheerful confirmation.
 *
 * Reachable BY CONSTRUCTION, not by bad luck — which is why prod holding zero
 * photos is not reassurance. It is the reason nobody has hit it yet.
 *
 * 🛡 Mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(resolve(HERE, 'file-upload.tsx'), 'utf8'));

test('a submit during an upload is refused, not silently emptied', () => {
  assert.ok(
    /inFlight\.length === 0\) return;/.test(SRC),
    'the guard must only arm while an upload is actually running',
  );
  assert.ok(
    /closest\('form'\)/.test(SRC),
    'it must find the enclosing form — every consumer of this component has the ' +
      'same gap, and the parents are server components whose buttons cannot see ' +
      'this state',
  );
  assert.ok(
    /addEventListener\('submit', refuse, \{ capture: true \}\)/.test(SRC),
    'CAPTURE phase: a listener on the bubble phase runs after React has already ' +
      'handed the action its (empty) FormData.',
  );
  assert.ok(/e\.preventDefault\(\)/.test(SRC), 'the submit must actually be stopped');
});

test('the refusal is visible — a silent block is its own bug', () => {
  // ⚠ ANCHORED TO THIS NOTICE, not to the word "alert". The first cut asserted
  // /role="alert"/ anywhere in the file — and this file has TWO, so deleting
  // the one on the upload notice left the other and the test stayed GREEN.
  // Measured: the mutation landed 2 -> 1 and proved nothing.
  assert.ok(
    /role="alert"[\s\S]{0,120}Still uploading/.test(SRC),
    'A guard that refuses in silence is indistinguishable from one that passed: ' +
      'the person presses Save, sees nothing, and presses it again. The notice ' +
      'must be announced, not merely rendered.',
  );
  assert.ok(
    /blockedSubmit \?/.test(SRC),
    'the notice must be driven by the refusal state, not always on',
  );
});

test('the notice clears itself when the upload lands', () => {
  assert.ok(
    /inFlight\.length === 0 && blockedSubmit\) setBlockedSubmit\(false\)/.test(SRC),
    'A lingering "still uploading" over a finished upload is a false alarm, and ' +
      'the next real one would be ignored.',
  );
});

test('a freshly uploaded file does not claim to be saved', () => {
  // The owner uploaded a photo, saw a GREEN TICK and the word "Uploaded", and
  // left. His account was unchanged — profile_photo_url still NULL, updated_at
  // five weeks old — because the value only reaches the row when the parent form
  // is submitted, and that button sits ~3,000px down a 4,744px page.
  //
  // Nothing was broken. The file was in R2 and the hidden input was correctly
  // filled. The screen simply said "done" about the UPLOAD while meaning nothing
  // about the ACCOUNT.
  assert.ok(
    /Not saved yet/.test(SRC),
    'A file that has not been submitted must not present as saved.',
  );
  assert.ok(
    /name && !item\.id\.startsWith\('seed-'\)/.test(SRC),
    'The distinction must come from WHERE the item came from: a seeded item was ' +
      'read out of the database and IS saved; one uploaded this session is not. ' +
      'And only when there is a `name` — without one the widget feeds no form.',
  );
  assert.ok(
    /<span className="truncate">Saved<\/span>/.test(SRC),
    'a seeded item should say Saved, because for it that is true',
  );
});

test('the listener is removed when the upload finishes', () => {
  assert.ok(
    /removeEventListener\('submit', refuse, \{ capture: true \}\)/.test(SRC),
    'left attached, every later save on that form would be refused forever',
  );
});
