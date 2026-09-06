/**
 * a-host-can-delete-in-either-density.test.ts — the phone roster's DELETE
 * survived the density toggle.
 *
 * The Guests page renders the same guests on a phone two ways, and the host
 * picks between them with one tap of the carousel's grid/list toggle
 * (`?density=list`). The PHOTO GRID (MobileGridItem) has had swipe-left-to-
 * Delete since 2026-06-03. The COMPACT LIST (MobileListRow) shipped without it.
 *
 * Nothing looked broken. The rows were all there, the RSVP cycle worked, the
 * seat chip was live — a host in list density just had no way to remove anybody
 * from the roster without leaving the list, and no reason to suspect the toggle
 * had taken one away. That is the shape of this defect: a display preference
 * that quietly changed what the host was ALLOWED to do.
 *
 * 🔒 WHAT THIS PINS, AND WHAT IT DELIBERATELY DOES NOT
 * It pins that BOTH mobile row components reach the SAME `SwipeToDelete` and
 * that both apply the SAME couple gate. It does NOT re-test the delete itself —
 * `bulkSoftDeleteGuests` (groups-actions.ts) owns the server-side blocks (the
 * couple is protected, an RSVP'd guest must be reset first) and is tested
 * there. A second copy of those gates is exactly what this change avoids.
 *
 * 🛡 Mutation-checked against the real file, failures counted, each RED:
 *  · drop the <SwipeToDelete> wrapper from MobileListRow  → 0 → 2 failing · RED
 *  · widen the gate to `swipeable = !selectMode` (couple admitted)
 *                                                        → 0 → 1 failing · RED
 *  · stop passing `radiusClass` (back to a hardcoded one) → 0 → 1 failing · RED
 *
 * ⚠ UPDATED 2026-09-06 — THE SWIPE NO LONGER POSTS A FORM. It submitted to
 * `bulkSoftDeleteGuests`, which releases the guest's seat WITHOUT capturing it,
 * so a swipe permanently dropped their chair and offered no undo — while the
 * identical act from the desktop bulk bar could be taken back in full, seat and
 * all. Both now call one hook, `useGuestRemoval`. The "ONE delete form"
 * assertion MOVED to follow that mechanism instead of being deleted: left as it
 * was, it counted a pattern that no longer exists.
 *  · route the swipe back through bulkSoftDeleteGuests → 0 → 2 failing · RED
 *  · remove the hook from SwipeToDelete entirely       → 0 → 1 failing · RED
 *  · drop the setTx(0) reset callback                  → 0 → 1 failing · RED
 *    (the FIRST draft of that assertion scored 0 — a bare /setTx\(0\)/ also
 *     matches this component's tap-to-close handler. It pins the callback now.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(
  readFileSync(join(HERE, 'guest-list-multiselect.tsx'), 'utf8'),
);

/**
 * The BODY of one named function declaration.
 *
 * Every component here destructures its props, so the first `{` after the name
 * opens the PARAMETER list, not the body — brace-matching from it returns the
 * signature and nothing else, and every assertion below then passes or fails
 * for the wrong reason. Walk the parens to the end of the parameter list first,
 * then take the `{` after it.
 */
function bodyOf(name: string): string {
  const at = SRC.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this test is pinning a ghost`);
  const lparen = SRC.indexOf('(', at);
  let parens = 0;
  let afterParams = -1;
  for (let i = lparen; i < SRC.length; i += 1) {
    if (SRC[i] === '(') parens += 1;
    else if (SRC[i] === ')') {
      parens -= 1;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  assert.notEqual(afterParams, -1, `unbalanced parens in ${name}`);
  const open = SRC.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') {
      depth -= 1;
      if (depth === 0) return SRC.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the body extractor reads the BODY, not the destructured params', () => {
  // Guards the helper itself: the first `{` after `function MobileListRow(` is
  // the props destructure. If bodyOf ever regresses to it, every assertion in
  // this file goes quietly green against a signature.
  const body = bodyOf('MobileListRow');
  assert.ok(body.includes('return ('), 'bodyOf stopped short of the function body');
  assert.ok(!body.startsWith('{\n  guest,'), 'bodyOf matched the parameter list');
});

test('BOTH phone densities render the swipe-to-delete — not just the grid', () => {
  const grid = bodyOf('MobileGridItem');
  const list = bodyOf('MobileListRow');

  assert.ok(
    /<SwipeToDelete/.test(grid),
    'the photo grid lost its delete — that is the regression this file was written after',
  );
  assert.ok(
    /<SwipeToDelete/.test(list),
    'the compact list row has no delete: flipping ?density=list takes the ' +
      'affordance away from the host on the same guests',
  );
});

test('the couple is gated out of the swipe in BOTH densities', () => {
  // bulkSoftDeleteGuests refuses the couple server-side, so a Delete offered on
  // their row is a button that can only ever fail. Both rows must not offer it.
  for (const name of ['MobileGridItem', 'MobileListRow']) {
    const body = bodyOf(name);
    assert.ok(
      /!selectMode/.test(body),
      `${name}: select mode owns the card for checkbox bulk ops — no swipe there`,
    );
    assert.ok(
      /guest\.role !== 'bride'/.test(body) && /guest\.role !== 'groom'/.test(body),
      `${name} would dangle a Delete on the couple that always fails server-side`,
    );
  }
});

test('there is ONE removal path, not one per density', () => {
  // ⚠ THIS ASSERTION MOVED RATHER THAN BEING DELETED (2026-09-06). It used to
  // count `action={bulkSoftDeleteGuests.bind` and expect exactly 1. The swipe no
  // longer posts a form, so that regex now matches ZERO — an "exactly 1" test
  // would have gone RED for the right reason, and an "at most 1" test would have
  // gone GREEN BY FINDING NOTHING. The mechanism changed; the assertion follows
  // it. What replaced it is stronger.
  const hookRefs = SRC.match(/useGuestRemoval\(/g) ?? [];
  assert.ok(
    hookRefs.length >= 3,
    'expected the hook definition plus BOTH call sites (bulk bar + swipe), ' +
      `found ${hookRefs.length} references`,
  );
  const actionCalls = SRC.match(/bulkSoftDeleteGuestsForUndo\(/g) ?? [];
  assert.equal(
    actionCalls.length,
    1,
    'the delete action must be called from exactly one place (the hook), found ' +
      `${actionCalls.length} — a second caller is a second set of rules to drift`,
  );
});

test('nothing on this page calls the delete that cannot be undone', () => {
  // `bulkSoftDeleteGuests` releases the guest's seat WITHOUT capturing it, so a
  // caller silently loses the chair. It stays exported (other trees may use it),
  // but this page must never route through it again — that asymmetry is what
  // this change removed.
  assert.equal(
    /bulkSoftDeleteGuests\s*[.(]/.test(SRC),
    false,
    'this page is calling the un-undoable delete again — use useGuestRemoval, ' +
      'which captures released seats so the undo can re-place them',
  );
});

test('the swipe hands its guest to the shared path, and resets itself', () => {
  const swipe = bodyOf('SwipeToDelete');
  assert.ok(
    /remove\(\[guestId\]/.test(swipe),
    'the swipe must remove through the shared hook',
  );
  // ⚠ NOT a bare /setTx\(0\)/ — this component ALREADY calls setTx(0) in its
  // tap-to-close handler, so a loose match stays green with the reset callback
  // removed. Measured: dropping the callback scored 0 failing against the first
  // draft of this assertion. Pin the callback ITSELF.
  assert.ok(
    /remove\(\[guestId\],\s*\(\)\s*=>\s*setTx\(0\)\)/.test(swipe),
    'the swipe must reset its revealed gesture once the server confirms, or ' +
      'the row stays swiped open over a guest that is already gone',
  );
});

test('the swipe wrapper rounds to the card it wraps', () => {
  // The list row is rounded-xl, the grid card rounded-lg; the wrapper clips with
  // overflow-hidden, so a hardcoded radius shaves the corners of one of them.
  assert.ok(
    /radiusClass\?: string/.test(SRC),
    'SwipeToDelete must take the radius rather than hardcode one',
  );
  assert.ok(
    /radiusClass="rounded-xl"/.test(bodyOf('MobileListRow')),
    'the compact row must pass its own rounded-xl through',
  );
});
