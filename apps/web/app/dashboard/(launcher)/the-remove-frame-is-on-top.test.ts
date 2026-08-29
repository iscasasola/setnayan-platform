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

test('the frame is two short screens, and the reason is still optional', () => {
  const src = read();

  /*
    Owner 2026-08-29: "when they click on their reason, change the content of
    the popup to just show the type XXX to confirm so the popup stays fit."
    Everything at once was ~590px on a ~780px phone — and the part that falls
    off the bottom of a frame is always the button.
  */
  assert.match(
    src,
    /\) : step === 'why' \? \(/,
    'The remove frame is one long screen again. It does not fit a phone, and ' +
      'what runs off the bottom is the button.',
  );

  // 1 · A CHIP PRESS TURNS THE PAGE — and clearing one does NOT, because
  //     clearing only means anything on the screen the chips are on.
  assert.match(
    src,
    /setReasonCode\(c\);\s*if \(c\) setStep\('confirm'\);/,
    'Picking a reason no longer moves them on — or worse, clearing one does.',
  );

  // 2 · 🔴 THE LOAD-BEARING ONE. Advancing on a chip press makes an optional
  //     survey the toll gate on somebody's own celebration unless there is a
  //     way past it that records nothing. The owner set that standing on
  //     2026-08-28 and this screen must not quietly take it back.
  assert.match(
    src,
    /setReasonCode\(''\);[\s\S]{0,80}?setStep\('confirm'\);/,
    'There is no way past the reason question without answering it. The ' +
      'reason is asked, never demanded — a celebration held hostage to a ' +
      'survey is the product asking a favour on the way out.',
  );

  // 3 · THE BUTTON IS ONLY ON THE SCREEN THAT ASKS FOR IT. A destructive
  //     control on a screen whose job is to ask a question is one pressed by
  //     accident.
  assert.match(
    src,
    /impact && !impact\.blocked && step === 'confirm' \?/,
    'Remove is offered on the "why" screen again, where nothing has been ' +
      'typed and nobody has been warned yet.',
  );

  // 4 · THE STRONGEST WARNING SITS WITH THE BUTTON, not two screens above it.
  const warnAt = src.indexOf('<PermanenceWarning />');
  const typedAt = src.indexOf('value={typed}');
  assert.equal(
    count(src, /<PermanenceWarning \/>/g),
    1,
    'The permanence warning must render exactly once — on the screen that ' +
      'carries the press.',
  );
  assert.ok(
    warnAt > 0 && warnAt < typedAt,
    'The "your photos are deleted for good" line is no longer above the typed ' +
      'name on the confirm screen. A warning left on the previous screen was ' +
      'read before the person was deciding anything.',
  );

  // 5 · ONE NOTE FIELD, TWO PLACES. The removal frame shows the box on a later
  //     screen than the chips while the request path keeps it inline — two
  //     copies of a field is two copies of its cap and its label, and the copy
  //     nobody remembers to change is the one a person meets.
  assert.equal(
    count(src, /maxLength=\{1000\}/g),
    1,
    'A second copy of the note field appeared. One implementation, two places.',
  );
  assert.equal(
    count(src, /<ReasonNote\b/g),
    2,
    'The shared note field is no longer used in both places — the removal ' +
      'frame’s later screen and the picker’s inline box.',
  );
});
