/**
 * THE COUPLE'S "ADD MANUALLY" SHEET IS THE APPROVED DRAWING. (owner 2026-11-07)
 *
 * Owner, verbatim: *"we only see services and not categories … via drop down. and multiple select. they will list
 * their inclusions and price and payment plan and a check box if something is already paid prior with a screen shot
 * of their payment proof. (optional)."* — then, approving `prototypes/makers_match_2026-11-07/makers-match.html`:
 * *"all swipe to delete works. all changes as this designs are to be fixed on the current design"*, with the thumb-row
 * buttons copying the shipped ActionButton exactly (DECISION_LOG 2026-11-07, "THE FOUR MAKERS ARE APPROVED").
 *
 * The first build of this (PR #7365) shipped four things the drawing does not have, each of which a green suite let
 * through: the thumb row stretched to two equal halves, a ✕ button on every payment line, a GREEN "Already paid" box,
 * and a plain-text "Done ✓" closing the services list. This holds the drawing, by component, anchored on strings:
 *
 *   1. thumb row — `.bbar`: content-width pills (no grid, no `w-full`), Cancel neutral, the save brand + `main`;
 *   2. payment lines — swipe left to remove with Undo; no row button; the paid box is ink, not green;
 *   3. the services list — one multi-select PickMenu whose Done is the shipped ActionButton `tone="ok"` (the ONLY green);
 *   4. every list on the sheet is the one lines drawing (`sheet-lines.tsx`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = path.resolve(HERE, '..', 'app', 'dashboard', '[eventId]', '_components');
const read = (p: string) => readFileSync(p, 'utf8');
const MODAL = read(path.join(C, 'new-manual-vendor-modal.tsx'));
const ROWS = read(path.join(C, 'payment-plan-rows.tsx'));
const PICKER = read(path.join(C, 'services-covered-picker.tsx'));
const EDITOR = path.resolve(HERE, '..', 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components');
const PICK_MENU = read(path.join(EDITOR, 'pick-menu.tsx'));
const PICK_DONE = read(path.join(EDITOR, 'pick-done-row.tsx'));
const PROOF = read(path.resolve(HERE, '..', 'app', '_components', 'chosen-proof-field.tsx'));

/** The text from `start` up to the first `end` after it — fails loudly when an anchor is gone. */
function between(src: string, start: string, end: string, what: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `${what}: anchor "${start}" is gone — re-point this guard`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `${what}: end anchor "${end}" is gone — re-point this guard`);
  return src.slice(a, b);
}

describe('1 · the thumb row is the drawing’s `.bbar`', () => {
  // From the row's OWN `<div` — its className sits BEFORE the data attribute, so a window that starts at the attribute
  // cannot see the classes it is meant to hold (measured: the first draft of this guard stayed green on `grid-cols-2`).
  const at = MODAL.indexOf('data-add-manual-thumb-row=""');
  assert.ok(at > 0, 'thumb row: anchor "data-add-manual-thumb-row" is gone — re-point this guard');
  const row = MODAL.slice(MODAL.lastIndexOf('<div', at), MODAL.indexOf('</form>', at));

  it('the pills keep their own width — no grid halves, nothing stretched', () => {
    assert.doesNotMatch(row, /grid-cols-2/, 'the thumb row is split into equal halves again');
    assert.doesNotMatch(row, /\bw-full\b|\bflex-1\b/, 'a thumb-row pill is stretched');
  });

  it('Cancel is neutral grey; the save is brand terracotta and filled; nothing here is green', () => {
    assert.match(row, /tone="neutral"[^/]*label="Cancel"/);
    const save = between(row, 'type="submit"', '/>', 'save button');
    const saveOpen = row.slice(Math.max(0, row.indexOf('type="submit"') - 120), row.indexOf('type="submit"'));
    assert.match(saveOpen + save, /tone="brand"/, 'the save is not terracotta');
    assert.match(saveOpen + save, /\bmain\b/, 'the save is not the filled main verb');
    assert.doesNotMatch(row, /tone="ok"/, 'green in the thumb row — green is only the Done that closes the dropdown');
  });

  it('the row is frosted, full width', () => {
    const foot = between(MODAL, 'data-record-sheet-footer=""', '>', 'footer');
    assert.match(foot, /-mx-5/);
    assert.match(foot, /bg-cream\/\[0\.84\]/, 'the footer is opaque again');
    assert.match(MODAL, /backdropFilter: 'blur\(16px\) saturate\(1\.3\)'/);
  });
});

describe('2 · payment lines swipe away; the paid box is ink', () => {
  const add = between(ROWS, '{paidAtAdd ? (', '      ) : (\n      <>', 'the add sheet’s payment lines');

  it('a line is a SwipeToDelete with Undo — and has no row button', () => {
    assert.match(add, /<SwipeToDelete\b/);
    assert.match(add, /<PeekToast\b[\s\S]*?label: 'Undo'/);
    assert.match(add, /Swipe a payment left to remove it\./);
    assert.doesNotMatch(add, /iconOnly|icon=\{X\}/, 'a ✕ row button is back on a payment line');
  });

  it('"Already paid" is an ink box, not green', () => {
    const box = between(add, 'type="checkbox"', 'Already paid', 'the paid box');
    assert.match(box, /accent-\[rgb\(var\(--color-ink\)\)\]/);
    assert.doesNotMatch(box, /color-ok/, 'the paid box is green again');
  });

  it('the proof is the shipped field, drawn as the button look', () => {
    assert.match(add, /<ChosenProofField\b[\s\S]*?look="button"/);
    assert.match(PROOF, /label=\{chosen \? 'Replace' : 'Add payment proof'\}/);
    assert.match(PROOF, /optional — screenshot\/receipt/);
  });
});

describe('3 · the services list is one multi-select whose Done is the only green', () => {
  it('ServiceLines opens a PickMenu with the green Done', () => {
    const lines = between(PICKER, 'function ServiceLines(', 'function AlsoCoversPicker(', 'ServiceLines');
    assert.match(lines, /<PickMenu\b[\s\S]*?\bdoneButton\b/);
    assert.match(lines, /picked=\{picked\}/, 'the list is not multi-select');
  });

  it('PickMenu hands its Done row the opt-in, and that row is the shipped ActionButton, tone ok', () => {
    assert.match(PICK_MENU, /<PickDoneRow\b[\s\S]*?button=\{doneButton\}/, 'PickMenu no longer passes doneButton');
    const done = between(PICK_DONE, 'if (button) {', '\n  }\n', 'the green Done');
    assert.match(done, /<ActionButton\b[^>]*tone="ok"[^>]*label="Done"/);
  });
});

describe('4 · one lines drawing for the three lists', () => {
  it('services, inclusions and payments all sit in LINES_BOX_CLASS with a grip', () => {
    for (const [name, src] of [
      ['services', PICKER],
      ['inclusions', MODAL],
      ['payments', ROWS],
    ] as const) {
      assert.match(src, /className=\{LINES_BOX_CLASS\}/, `${name} is not in the lines box`);
      assert.match(src, /<LineGrip \/>/, `${name} lost its grip column`);
    }
  });
});
