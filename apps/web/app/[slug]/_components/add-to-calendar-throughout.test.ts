/**
 * add-to-calendar-throughout.test.ts — H-5.
 *
 * WHAT WAS WRONG, MEASURED ON TWO LIVE INVITATIONS 2026-08-24. An anonymous
 * fetch of `/cale-ice` (271,700 bytes) and `/maria-and-jose` (158,157 bytes)
 * each contained the string "Add to calendar" EXACTLY ONCE — at the film's
 * terminal beat. A guest who lifted the veil, read the date and left had no way
 * to put it in their phone short of watching the whole film to its end.
 *
 * 🔑 THIS IS THE SECOND TIME THE SAME SHAPE HAS BEEN FIXED IN THIS FILE. The
 * "See our page" exit had the identical defect and the identical cause — a real
 * control parked on the LAST beat — and the owner hit it on his own phone on
 * 2026-08-04. That repair is the template this one copies, deliberately, rather
 * than inventing a second pattern beside it.
 *
 * 🚨 AND THE MOUNT CONDITION IS THE WHOLE SAFETY ARGUMENT. Every beat of this
 * film is mounted from frame one behind `pointer-events-none` + `aria-hidden`,
 * and NEITHER of those removes an element from the tab order. A control merely
 * RENDERED in the persistent chrome would be Tab-reachable under the veil,
 * before the music, the clip or the gallery have played — two keystrokes past
 * everything the couple paid for. `started` only flips at the lift, so it is a
 * genuine mount condition and not a style. If a future edit swaps it for an
 * opacity or a `hidden` class, this file goes red.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = join(HERE, 'save-the-date-film.tsx');
const raw = () => readFileSync(FILM, 'utf8');

/** Comments name the defect and quote the old strings; a raw grep would match
 *  the explanation and report the bug it just fixed. */
function code(): string {
  return raw()
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('🔴 "Add to calendar" is reachable from more than the last beat', () => {
  const src = code();
  const hits = src.match(/>\s*Add to calendar/g) ?? [];
  assert.ok(
    hits.length >= 2,
    `"Add to calendar" renders ${hits.length} time(s). One means it is back on ` +
      `the terminal beat only, and a guest who leaves early never gets the date ` +
      `into their phone — the defect this file exists for.`,
  );
});

test('the persistent chip is mounted on `started`, not merely styled', () => {
  const src = code();
  // The exact guard: the chip's own render condition. `started` is what stops it
  // existing in the tab order under the veil.
  assert.match(
    src,
    /\{started && !preview && \(content\.icsHref \|\| content\.gcalUrl\) \?/,
    'the persistent Add-to-calendar chip lost its `started` mount condition — ' +
      'aria-hidden and pointer-events-none do NOT remove an element from the ' +
      'tab order, so it would be Tab-reachable under the veil, before the ' +
      'music, the clip or the gallery have played',
  );
});

test('it offers nothing when there is nothing to add', () => {
  const src = code();
  // A chip linking to '#' would be a dead control on a wedding invitation.
  assert.match(
    src,
    /\(content\.icsHref \|\| content\.gcalUrl\)/,
    'the chip must not render when the event has neither an ICS file nor a ' +
      'Google Calendar URL',
  );
});

test('🔴 the FINALE waits for the finale — it is not Tab-reachable under the veil', () => {
  const src = code();
  // WHAT THIS CAUGHT, MEASURED ON THE LIVE PRODUCTION BUILD 2026-08-24 before
  // any veil lift: the terminal beat's accent "Add to calendar" anchor was
  // gated on the LINK EXISTING and nothing else, so it sat inside an
  // `aria-hidden` beat with non-zero size and `tabIndex >= 0` — keyboard
  // reachable from frame one, under the veil, before the music or the clip had
  // played.
  //
  // 🔑 AND THE FILE ALREADY KNEW. The rule is written out in full eight lines
  // below, for the "See our page" button, which WAS gated correctly. The
  // comment sat BETWEEN the two blocks, attached to the one that obeyed it, so
  // a reader met the unprotected control first and the rule second.
  assert.match(
    src,
    /\{\(content\.icsHref \|\| content\.gcalUrl\) && idx === closeIdx \?/,
    'the terminal beat’s accent Add-to-calendar anchor is no longer gated on ' +
      '`idx === closeIdx`. aria-hidden and pointer-events-none do NOT remove an ' +
      'element from the tab order, so it becomes keyboard-reachable from frame ' +
      'one — under the veil, before the film has played.',
  );
});

test('every control inside the closing beat waits for it — none is left ungated', () => {
  const src = code();
  // Derived, not hand-listed: take the closing beat's OWN node and require that
  // every interactive element in it sits behind an `idx === closeIdx`
  // conditional. A hand-enumerated list is a list of the controls you thought
  // of, and this defect existed precisely because the second control was not on
  // anybody's list.
  //
  // 🪤 THE FIRST CUT OF THIS SCAN WAS LOOSE IN TWO WAYS, AND PRINTING WHAT IT
  // COUNTED IS WHAT SHOWED IT:
  //   1. Its beat boundary fell through to an arbitrary 4000-character window,
  //      so what counted as "the beat" drifted with the file.
  //   2. It counted every `idx === closeIdx`, including `active={idx ===
  //      closeIdx}` on the monogram — a prop, not a gate. It read 3 gates for 2
  //      controls and would still have passed with one control ungated.
  // It is now bounded by the beat's real terminator and counts only the
  // CONDITIONAL form, so controls and gates are 1:1.
  const start = src.indexOf('const closeIdx = slides.length;');
  assert.notEqual(start, -1, 'the closing beat is gone from the film');
  const rest = src.slice(start);
  const end = rest.search(/\n {2}\}\);/);
  assert.notEqual(end, -1, 'could not find the end of the closing beat — the scan is unbounded');
  const beat = rest.slice(0, end);

  const controls = beat.match(/<(?:a|button)\b/g) ?? [];
  const gates = beat.match(/idx === closeIdx \? \(/g) ?? [];
  assert.ok(
    controls.length >= 2,
    `only ${controls.length} control(s) found in the closing beat — the scan ` +
      `stopped matching and is no longer measuring anything`,
  );
  assert.equal(
    gates.length,
    controls.length,
    `the closing beat renders ${controls.length} interactive control(s) but ` +
      `carries ${gates.length} \`idx === closeIdx\` gate(s). Every control mounted ` +
      `in this beat is Tab-reachable from frame one unless it waits for the beat ` +
      `— aria-hidden and pointer-events-none do not remove anything from the tab ` +
      `order.`,
  );
});

test('the closing beat keeps its full button — the chip does not replace the finale', () => {
  const src = code();
  // The terminal beat's accent button is the finale the couple paid for. The
  // persistent chip is CHROME and must not have eaten it.
  assert.match(
    src,
    /accentBtnCls\}[\s\S]{0,200}?>\s*\n?\s*Add to calendar/,
    'the closing beat lost its accent Add-to-calendar button',
  );
});

test('the persistent chip reads as chrome, not as a competing call to action', () => {
  const src = code();
  // Same quiet weight as the mute control and the way-out it sits between. A
  // solid accent pill floating over the film for its whole run would shout over
  // the thing it is decorating — the reason the way-out is quiet too.
  const chip = /pointer-events-auto[^"]*bg-current\/10[^"]*opacity-75/.exec(src);
  assert.notEqual(
    chip,
    null,
    'the persistent chip no longer uses the quiet chrome weight shared with ' +
      'the mute control and the way-out',
  );
  assert.equal(
    /pointer-events-auto[^"]*accentBtn/.test(src),
    false,
    'the persistent chip must not wear the accent button styling — that is the ' +
      "closing beat's finale, not the film's chrome",
  );
});

test('the persistent chip and the transient hold-hint do not share a row', () => {
  const src = code();
  // Both were `bottom-16`. Stacked, a fading cue would sit on top of a real
  // control for the first seconds of every film.
  const chipRow = /inset-x-0 bottom-16 z-20 flex justify-center px-4/.test(src);
  const hintRow = /inset-x-0 bottom-28 z-20 flex justify-center transition-opacity/.test(src);
  assert.ok(chipRow, 'the persistent chip left its row');
  assert.ok(
    hintRow,
    'the "press and hold to pause" cue moved back onto the chip\'s row — a ' +
      'transient hint would overlap a persistent control',
  );
});

test('the bottom chrome row is not overloaded', () => {
  const src = code();
  // The row at bottom-5 holds the way-out (left) and mute (right). A third chip
  // between them overlaps both on a 375px phone, which is why the calendar chip
  // sits ABOVE the row rather than in it.
  //
  // 🪤 THE FIRST VERSION OF THIS ASSERTION WAS DECORATION, and the mutation run
  // is what said so. It counted `absolute bottom-5 (left-4|right-4)` — so it
  // could not see the very thing it claims to prevent, a CENTRED third chip
  // (`bottom-5 inset-x-0`), and a sabotage that moved the mute control to the
  // left scored 1 → 2 on its pattern while the total stayed 2 and it passed.
  // It now counts every box anchored to that row, however it is anchored.
  const bottom5 = (src.match(/absolute[^"`]*\bbottom-5\b/g) ?? []).length;
  assert.equal(
    bottom5,
    2,
    `the bottom chrome row holds ${bottom5} anchored control(s); it is designed ` +
      `for exactly two (way-out left, mute right) and a third crowds a phone. ` +
      `If a control genuinely belongs there, move another one out first.`,
  );
});
