/**
 * a-44px-tap-target-is-not-a-44px-ring.test.ts — two defects found by OPENING
 * THE PAGE, after three PRs of green tests said the work was done.
 *
 * ── 1 · THE DASHED ELLIPSE ─────────────────────────────────────────────────
 * `globals.css` gives every `button` `min-height: 44px` — the ≥44pt touch
 * target from the kickoff multi-platform rules, and correct. `AddToGroupControl`
 * put `h-6 w-6 rounded-full border border-dashed` on the BUTTON, so the height
 * lost to that rule and the "circle" rendered as a **24 × 44 ellipse**. Measured
 * live on the shipped page with getBoundingClientRect, not inferred.
 *
 * It survived on the desktop row for months because a tall control just absorbs
 * into a tall row. It became obvious only on the compact list row, where the
 * chips beside it are 20px tall. 🔑 A style bug hides in whatever layout is
 * loose enough to swallow it — shipping the same control into a TIGHT layout is
 * what exposed it, and no test could have.
 *
 * The fix keeps the 44px hit area and moves the ring to an inner 24×24 span.
 * NEVER shrink a touch target to fix a shape.
 *
 * ── 2 · THE PANEL THAT CONTRADICTED ITS OWN TRIGGER ────────────────────────
 * `LockedChip` (shipped hours earlier) advertises `aria-haspopup="dialog"`
 * because nothing in its panel is choosable — and then rendered that panel
 * through `Popover`, which hardcoded `role="menu"`. A menu containing zero
 * `menuitem`s, promised by a trigger that says dialog. The trigger's own test
 * asserted `aria-haspopup="dialog"` and passed, because it never looked at what
 * actually opened. 🔑 Asserting the promise is not asserting the thing promised.
 *
 * 🛡 Mutation-checked against the real files, each RED:
 * 🪤 AND THE FIRST DRAFT OF THIS FILE DID NOT CATCH DEFECT 1. Its button-tag
 * regex was `/<button[\s\S]*?>/`, which stops at the `>` inside
 * `onClick={() =>` — so it matched `<button ref={ref} type="button" onClick={()
 * =` and never reached the className. Putting the ring back on the button
 * scored **0 failing**. The regex is now a scan for a `>` not preceded by `=`,
 * and a test above guards the extractor itself. 🔑 A green mutation run is the
 * only reason this was found; asserting on an extract nobody checked is the
 * same mistake as defect 2, one level down.
 *
 * 🛡 Mutation-checked against the real files, failures counted, each RED:
 *  · put the ring back on the button (h-6 w-6 border on <button>) → 0 → 2 · RED
 *  · drop `role="dialog"` from LockedChip's Popover                → 0 → 1 · RED
 *  · hardcode `role="menu"` in Popover again                       → 0 → 1 · RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) =>
  stripComments(readFileSync(join(HERE, f), 'utf8'));
const CHIPS = read('chip-editors.tsx');
const OVERLAY = read('overlay-primitives.tsx');

/** The body of a named function declaration (params walked past first). */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this test is pinning a ghost`);
  const lparen = src.indexOf('(', at);
  let parens = 0;
  let afterParams = -1;
  for (let i = lparen; i < src.length; i += 1) {
    if (src[i] === '(') parens += 1;
    else if (src[i] === ')') {
      parens -= 1;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  const open = src.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/**
 * The OPENING TAG of the first <button> in `src`.
 *
 * Not `/<button[\s\S]*?>/` — that stops at the `>` of `onClick={() =>`, so it
 * returns `<button ref={ref} type="button" onClick={() =` and never sees the
 * className. Both assertions below then pass no matter what the button wears,
 * which is exactly what happened: the mutation that put the dashed ring back on
 * the button scored 0 failures against the first draft of this file. Scan for a
 * `>` whose previous non-space character is not `=`.
 */
function openingButtonTag(src: string): string {
  const at = src.indexOf('<button');
  assert.notEqual(at, -1, 'no <button> found');
  for (let i = at; i < src.length; i += 1) {
    if (src[i] !== '>') continue;
    let j = i - 1;
    while (j > at && /\s/.test(src[j])) j -= 1;
    if (src[j] !== '=') return src.slice(at, i + 1);
  }
  throw new Error('unterminated <button> tag');
}

test('the extractor sees the className, not just `onClick={() =`', () => {
  // Guards the guard. Without this the file scores green against a real defect.
  assert.ok(
    /className=/.test(openingButtonTag(bodyOf(CHIPS, 'AddToGroupControl'))),
    'openingButtonTag stopped at the arrow function again',
  );
});

test('the add-to-group ring is not drawn on the 44px button', () => {
  const body = bodyOf(CHIPS, 'AddToGroupControl');
  const button = openingButtonTag(body);
  assert.equal(
    /h-6[\s\S]*?border-dashed/.test(button),
    false,
    'the dashed ring is back on the button — min-height:44px will stretch it ' +
      'into a 24x44 ellipse',
  );
  assert.ok(
    /<span[\s\S]*?h-6 w-6[\s\S]*?border-dashed/.test(body),
    'the ring must live on an inner fixed-size span',
  );
});

test('the hit area is still the full 44px — the shape fix must not shrink it', () => {
  // The button carries no height class of its own, so globals.css's
  // `min-height: 44px` still applies. An explicit h-6 here would defeat it.
  const button = openingButtonTag(bodyOf(CHIPS, 'AddToGroupControl'));
  assert.equal(
    /\bh-6\b/.test(button),
    false,
    'pinning the button to 24px would shrink the touch target below 44pt',
  );
});

test('Popover lets its caller declare what kind of panel it is', () => {
  assert.ok(
    /role\?: 'menu' \| 'dialog'/.test(OVERLAY),
    'Popover must accept a role rather than hardcoding one',
  );
  assert.ok(
    /role=\{role\}/.test(OVERLAY),
    'the rendered panel must use the passed role',
  );
  assert.equal(
    /role="menu"/.test(OVERLAY),
    false,
    'a hardcoded menu role is what contradicted LockedChip',
  );
  assert.ok(
    /role = 'menu'/.test(OVERLAY),
    'menu stays the DEFAULT — every existing picker relies on it',
  );
});

test("LockedChip's panel agrees with its trigger", () => {
  const chip = bodyOf(CHIPS, 'LockedChip');
  assert.ok(
    /aria-haspopup="dialog"/.test(chip),
    'the trigger promises a dialog',
  );
  assert.ok(
    /role="dialog"/.test(chip),
    'and the panel must BE one — a menu with no menuitem is not a menu',
  );
});
