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

test('there is ONE delete form, not one per density', () => {
  // The point of the shared wrapper: the gates, the action and the soft-delete
  // semantics have a single home. A second form is a second set of rules to
  // drift.
  const forms = SRC.match(/action=\{bulkSoftDeleteGuests\.bind/g) ?? [];
  assert.equal(
    forms.length,
    1,
    `expected the single form inside SwipeToDelete, found ${forms.length} — ` +
      'a density that spells its own delete will drift from the other',
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
