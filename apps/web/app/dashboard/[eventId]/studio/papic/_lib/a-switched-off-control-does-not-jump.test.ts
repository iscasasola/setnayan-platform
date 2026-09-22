/**
 * SWITCHING SOMETHING OFF MUST NOT MOVE EVERYTHING ELSE.
 *
 * ⚖ Owner 2026-09-22: *"don't make it jump."*
 *
 * 🔑 HIDDEN IS A LAYOUT EVENT. The allotment block was `{enabled ? … : null}`:
 * turning the per-guest limits off DELETED every control below the switch and
 * pulled every block after it up the page. A couple presses one switch to
 * answer one question and the screen rearranges under their thumb — and on the
 * way back on, it rearranges again.
 *
 * So the controls stay mounted and go QUIET: `inert` takes them out of the tab
 * order and stops every press, the opacity says so, and the number boxes read
 * "No limit" / "No minimum" — which is also the honest answer to what is in
 * force.
 *
 * ── ⚠ WHAT IS *NOT* BANNED, AND WHY THE DISTINCTION MATTERS ──────────────
 * A component that renders NOTHING when there is nothing to decide is correct
 * and stays — `GuestAllotmentsChoice` returns null when guests cannot shoot at
 * all, because a control that governs nothing is worse than an absent one. The
 * rule is about a control COLLAPSING as the couple operates it, not about a
 * block that was never applicable. This guard therefore asserts the specific
 * shape that was wrong, not a ban on `null`.
 *
 * Run: cd apps/web && npx tsx --test "app/**\/a-switched-off-control-does-not-jump.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = stripComments(
  readFileSync(join(PAPIC, '_components', 'guest-allotments-choice.tsx'), 'utf8'),
);

test('THE ALLOTMENT CONTROLS ARE NOT UNMOUNTED BY THEIR OWN SWITCH', () => {
  /*
    The exact shape that was wrong, asserted STRUCTURALLY rather than by banning
    a phrasing. `{enabled ? …}` is legitimate elsewhere in this file — the
    switch's own form carries hidden inputs that way — so a text ban would
    convict innocent code, which is the other half of how a phrasing ban fails.

    What must be true: the quiet wrapper opens BEFORE the live summary line, and
    no `enabled ?` conditional sits between them. That is precisely "the block is
    inside the wrapper, not inside a branch".

    Sabotage: put `{enabled ? (` back in front of the block and `) : null}` after.
  */
  const wrapper = SRC.indexOf('inert={!enabled}');
  const summary = SRC.indexOf('{summary}');
  assert.ok(wrapper > 0, 'the quiet wrapper is gone');
  assert.ok(summary > 0, 'the live summary line is gone');
  assert.ok(wrapper < summary, 'the summary is outside the quiet wrapper');

  /*
    🚨 AND THE WINDOW MUST FACE THE OTHER WAY TOO. The first cut of this guard
    sliced FORWARD from the wrapper — which cannot see a gate wrapped AROUND it.
    A sabotage that put `{enabled ? (` immediately BEFORE the wrapper restored
    the exact defect and the guard stayed green.

    So the region between the switch's own form and the wrapper is checked as
    well: nothing may branch the wrapper away.
  */
  const switchLabel = SRC.indexOf("{enabled ? 'On' : 'Off'}");
  assert.ok(switchLabel > 0 && switchLabel < wrapper, 'the switch is gone or has moved below the block');
  const afterSwitch = SRC.indexOf('</form>', switchLabel);
  assert.ok(afterSwitch > 0 && afterSwitch < wrapper, "the switch's form does not close before the block");
  assert.ok(
    !/\{enabled \?\s*\(/.test(SRC.slice(afterSwitch, wrapper)),
    'the quiet wrapper is itself inside an `enabled ?` branch — the whole block still vanishes on switch-off',
  );
  // ⚠ `{enabled ? '…' : '…'}` IS FINE — the wrapper's own opacity is written
  // that way, and a pattern that banned every `enabled ?` convicted it. What is
  // banned is the BRANCH shape, `{enabled ? (`, which is what wraps JSX.
  const between = SRC.slice(wrapper, summary);
  assert.ok(
    !/\{enabled \?\s*\(/.test(between),
    'the allotment block is branched on its own switch again — switching it off moves every block below it',
  );

  // And every control further down is inside it too, not only the summary line.
  // ⚠ Located by "after the wrapper opens, with no `enabled ?` branch in
  // between" rather than by finding the wrapper's closing tag — the first
  // `</div>` after the summary belongs to an inner element, and slicing to it
  // would silently check almost nothing.
  for (const control of ['name="everyone_else"', 'name="minimum_each"', '<GuestAllotmentPicker']) {
    // ⚠ SEARCH FROM THE WRAPPER, NOT FROM THE START. `name="everyone_else"`
    // also appears as a hidden input on the switch's own form ABOVE the
    // wrapper, so a plain indexOf finds that one and reports the real control
    // missing — a false finding about correct code.
    const at = SRC.indexOf(control, wrapper);
    assert.ok(at > wrapper, `${control} is not inside the quiet wrapper at all`);
    assert.ok(
      !/\{enabled \?\s*\(/.test(SRC.slice(wrapper, at)),
      `${control} sits inside an \`enabled ?\` branch — it would still vanish on switch-off`,
    );
  }
});

test('IT GOES QUIET INSTEAD — inert, dimmed, and still there', () => {
  assert.match(SRC, /inert=\{!enabled\}/, 'the quiet block must be inert when off, or it stays tabbable and pressable');
  assert.match(SRC, /aria-hidden=\{!enabled\}/, 'a screen reader must not be offered controls that cannot act');
  assert.match(SRC, /opacity-45/, 'nothing says the block is switched off');
});

test('THE NUMBERS SAY WHAT IS IN FORCE WHEN IT IS OFF', () => {
  /*
    ⚠ A STALE NUMBER IN A DEAD BOX IS WORSE THAN AN EMPTY ONE. Leaving "40" in a
    greyed field says the limit is 40; it is not, because the switch is off.
  */
  assert.match(
    SRC,
    /placeholder=\{enabled \? String\(split\.perHead\) : 'No limit'\}/,
    'the per-guest limit must read "No limit" when the switch is off',
  );
  assert.match(
    SRC,
    /defaultValue=\{enabled \? everyoneElse \?\? '' : ''\}/,
    'a switched-off box must not keep showing the saved number as if it applied',
  );
  assert.match(
    SRC,
    /defaultValue=\{enabled \? floorPoints \?\? '' : ''\}/,
    'the minimum box must not keep showing a promise that is not in force',
  );
});

test('A COMPONENT THAT GOVERNS NOTHING MAY STILL RENDER NOTHING', () => {
  /*
    The other half of the rule, asserted so a later session does not read this
    guard as "never return null". Guests who cannot shoot at all have no
    allotment to divide, and a control for that is an empty promise.
  */
  assert.match(
    SRC,
    /if \(access === 'off'\) return null;/,
    'the not-applicable case must still render nothing — that is not a jump, it is an absent question',
  );
});
