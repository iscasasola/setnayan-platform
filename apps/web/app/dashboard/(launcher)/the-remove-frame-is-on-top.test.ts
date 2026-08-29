/**
 * the-remove-frame-is-on-top.test.ts — the "Remove this celebration?" frame is
 * in the browser's TOP LAYER, and Enter in the typed-name box removes it.
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * Owner, 2026-08-29, on his phone, with the frame open: *"i cannot click on the
 * delete this frame should be on top and not under."* The frame was rendering
 * as `absolute z-50` inside a board card's wrapper, so the only thing holding
 * it above the shelves below was a number — and a z-index ranks you only inside
 * whatever stacking context an ancestor happens to have opened. The next shelf
 * painted over the bottom of it: over Cancel, and over the one button the frame
 * exists to offer.
 *
 * ⚠ THE OLD ARRANGEMENT WAS NOT BROKEN — IT WAS OUTRANKABLE. That is the reason
 * this is a guard and not a one-line fix left to hold on its own: raising the
 * number would work until the next transform, blur or sticky bar landed on an
 * ancestor, and the symptom would come back looking like a brand-new bug.
 * `showModal()` cannot be outranked by any number anywhere.
 *
 * Every assertion runs over `stripComments` output and is anchored to the ACT —
 * a rendered element, a called method — never a bare identifier, because this
 * file and the component both argue about stacking contexts in prose and a
 * guard a comment can satisfy is decoration. Each was mutation-checked with its
 * occurrence count printed before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MENU = resolve(HERE, '_components/event-card-menu.tsx');
const read = () => stripComments(readFileSync(MENU, 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('the remove frame is a top-layer dialog, not a panel hung off the card', () => {
  const src = read();

  // 1 · MOUNTED, not merely defined. A dialog component that exists and is
  //     never rendered is the imported-but-not-mounted decoration this repo
  //     keeps paying for — and it looks exactly like a working fix in review.
  assert.equal(
    count(src, /<RemoveDialog\b/g),
    1,
    'The remove frame is no longer rendered through RemoveDialog. Defining ' +
      'the dialog and not mounting it puts the frame back under the shelves.',
  );

  // 2 · THE MECHANISM IS THE TOP LAYER. `showModal()` — not `show()`, which
  //     renders in the ordinary flow with no backdrop and no focus trap, and
  //     would leave the frame outrankable again while every other line here
  //     still passed.
  assert.match(
    src,
    /el\.showModal\(\)/,
    'The dialog is no longer opened with showModal(), so it is not in the top ' +
      'layer and any ancestor stacking context can bury it again.',
  );

  // 3 · AND IT IS PORTALED OUT OF THE GRID CELL. The menu renders as a sibling
  //     of a board card; leaving the element inside that cell hands the next
  //     `overflow-hidden` a way to clip it.
  assert.match(
    src,
    /createPortal\(\s*<dialog/,
    'The dialog element is no longer portaled — it renders inside the card’s ' +
      'grid cell, where an ancestor’s overflow can clip it.',
  );

  // 4 · THE FRAME'S OWN CONTENT IS INSIDE THE DIALOG. The load-bearing one:
  //     everything above can pass while the typed-name field still lives in
  //     the anchored popover. Anchored to the field, because that is the
  //     control the owner could not reach.
  const dialogAt = src.indexOf('<RemoveDialog');
  const dialogEnd = src.indexOf('</RemoveDialog>');
  const typedAt = src.indexOf('value={typed}');
  assert.ok(dialogAt > 0 && dialogEnd > dialogAt, 'the dialog must wrap a body');
  assert.ok(
    typedAt > dialogAt && typedAt < dialogEnd,
    'The type-the-name field is back outside the dialog. The frame is only ' +
      'on top if the frame’s CONTENT is what the dialog holds.',
  );

  // 5 · THE ANCHORED POPOVER STANDS DOWN WHILE THE FRAME IS OPEN. Two overlays
  //     for one decision is the menu still painting under its own dialog.
  assert.match(
    src,
    /\{open && !confirming \? \(/,
    'The anchored menu no longer stands down while the remove frame is open.',
  );

  // 6 · A SHORT SCREEN CAN STILL REACH THE BUTTONS. Six reason chips, a notes
  //     box and the typed name make this frame taller than a phone; a capped
  //     height with nothing to scroll is the same "cannot press it" one cause
  //     across.
  assert.match(
    src,
    /className="m-auto max-h-\[[^"]*\] w-\[[^"]*\] overflow-y-auto/,
    'The dialog lost its height cap or its scroll. On a short phone the ' +
      'buttons go off the bottom and nothing can scroll to them.',
  );
});

test('Enter in the typed-name box removes it, on exactly the button’s terms', () => {
  const src = read();

  // Owner 2026-08-29: "also pressing enter on that text box should also
  // confirm". A lone <input> outside a <form> does nothing at all on Enter.
  assert.match(
    src,
    /if \(e\.key !== 'Enter'\) return;[\s\S]{0,200}?confirmDelete\(\);/,
    'Enter no longer removes the celebration — the key every text box has ' +
      'taught people to press does nothing on the last field before the press.',
  );

  // 🔑 THE SECOND DOOR IS NEVER THE LOOSER ONE. If the key handler's guard
  // drifted from the button's, Enter would remove a celebration while the
  // control on screen was still greyed out — a second way to fire something
  // irreversible, on easier terms, and invisible in review.
  assert.equal(
    count(src, /pending \|\| typed\.trim\(\)\.length === 0/g),
    2,
    'The key handler and the button no longer share one spelling of "may this ' +
      'fire". Whichever is looser is now a way to delete a celebration that ' +
      'the screen says cannot be deleted yet.',
  );

  // And Enter must not ALSO do whatever the browser would have done with it.
  assert.match(
    src,
    /if \(e\.key !== 'Enter'\) return;\s*e\.preventDefault\(\);/,
    'The Enter handler stopped preventing the default — a stray submit or a ' +
      'dialog close can now ride along with the removal.',
  );
});
