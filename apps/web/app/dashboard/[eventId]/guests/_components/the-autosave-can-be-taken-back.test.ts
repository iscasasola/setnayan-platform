/**
 * the-autosave-can-be-taken-back.test.ts — a save nobody asked for must be
 * refusable.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * A Save button is a moment of consent. The guest card removed it, so a
 * mis-tapped RSVP segment wrote immediately and silently — while the roster
 * BEHIND the card had had an undo snackbar for its deletes since the Living
 * Roster shipped. The destructive path was covered and the ordinary one was not.
 * Owner, 2026-09-22: *"add the undo for field edits."*
 *
 * ── The three ways this can be built wrong ──────────────────────────────────
 *  1. A second write path. `updateGuest` writes the whole document, so undo is
 *     the previous payload through the SAME action — no inverse, no endpoint,
 *     no second set of rules to drift.
 *  2. An undo that reaches the row and not the screen. Restoring the database
 *     while the inputs still show the new values is this repo's recurring
 *     failure: correct data, lying screen.
 *  3. An undo that cannot reach a CONTROLLED input. `InvitedToChips` renders
 *     controlled checkboxes; assigning `.checked` is overwritten by React on
 *     the next render with its state never having changed. Only a real
 *     `click()` goes through `onChange`.
 *
 * 🛡 Mutation-checked, each confirmed RED:
 *  · drop the pushUndo call              → RED
 *  · restore checkboxes by assignment    → RED
 *  · drop the restoring-suppression      → RED
 *  · unmount the host from the route     → RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));
const AUTOSAVE = read('guest-card-autosave.tsx');
const CHIPS = read('invited-to-chips.tsx');
const ROSTER = stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));
const ROUTE = stripComments(
  readFileSync(resolve(HERE, '..', '[guestId]', 'page.tsx'), 'utf8'),
);

test('every autosave offers an undo', () => {
  assert.match(AUTOSAVE, /import \{ pushUndo \}/, 'the card does not use the shipped snackbar');
  assert.match(
    AUTOSAVE,
    /pushUndo\(\{ label, undo: \(\) => undoTo\(prev\) \}\)/,
    'the save path no longer pushes an undo for the payload it replaced',
  );
});

test('undo is the SAME action with the previous payload — not a second writer', () => {
  assert.match(AUTOSAVE, /await action\(snap\)/, 'undo must post through the same server action');
  // A per-field endpoint would be the second source of truth this card exists
  // to avoid; if one appears, this guard should be the thing that objects.
  assert.equal(
    /fetch\(|axios|\/api\//.test(AUTOSAVE),
    false,
    'undo has grown its own endpoint — it must reuse updateGuest',
  );
});

test('the undo reaches the SCREEN, not only the row', () => {
  const at = AUTOSAVE.indexOf('await action(snap)');
  assert.ok(at > -1, 'the undo write is gone — this guard is pinning a ghost');
  const after = AUTOSAVE.slice(at);
  assert.match(
    after,
    /restoreInputs\(form, snap\)/,
    'the row is restored but the controls are not — the screen would keep showing the undone value',
  );
});

test('a CONTROLLED input is restored by clicking it, never by assignment', () => {
  // The hazard is specific and easy to reintroduce: `el.checked = want` looks
  // correct, passes a glance, and silently does nothing to a controlled island.
  assert.match(
    CHIPS,
    /checked=\{blocks\.has\(block\)\}/,
    'invited-to is no longer controlled — re-derive whether click() is still required',
  );
  const fn = AUTOSAVE.slice(AUTOSAVE.indexOf('function restoreInputs'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /el\.click\(\)/, 'checkboxes and radios must be driven through their onChange');
  assert.equal(
    /\.checked\s*=/.test(body),
    false,
    'assigning .checked cannot reach a controlled island; use click()',
  );
});

test('restoring does not schedule another save of what was just undone', () => {
  assert.match(
    AUTOSAVE,
    /if \(restoring\.current\) return;/,
    'without this, the change events a restore fires re-apply the undone value',
  );
});

test('both surfaces that render the card mount the snackbar host', () => {
  // An undo that restores the row and shows nothing is the failure this whole
  // file exists to prevent — and it is what happens on a surface with no host.
  for (const [name, src] of [['roster', ROSTER], ['standalone route', ROUTE]] as const) {
    assert.match(src, /<UndoToastHost/, `the ${name} does not mount the undo snackbar`);
  }
});
