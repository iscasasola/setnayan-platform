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

test('the listener is removed when the upload finishes', () => {
  assert.ok(
    /removeEventListener\('submit', refuse, \{ capture: true \}\)/.test(SRC),
    'left attached, every later save on that form would be refused forever',
  );
});
