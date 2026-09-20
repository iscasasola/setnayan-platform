/**
 * A guest can get to the boxes that hold their own contact details.
 *
 * 🚨 THE DEFECT. The reply card carries the guest's email, mobile and preferred
 * name. It renders inline on `/{slug}` — the page they are already on — and
 * nothing anywhere pointed at it. For a guest who has already answered it is
 * folded behind a disclosure whose label said only **"Need to change your
 * reply?"**, so someone wanting to correct a phone number had no reason to open
 * it. That is the same failure the widget's own #4683 note cites four lines from
 * the boxes: a drawer whose label advertises something else.
 *
 * 🔑 THE PART A NAIVE FIX GETS WRONG — AND RULE 0 CAUGHT IT. The reply card is
 * PHASE-GATED to `rsvp` (`WIDGET_PHASES.rsvp`), so on save_the_date, event and
 * editorial it is ABSENT — while the summary card that would carry the chip is
 * present in all of them. A chip rendered unconditionally would scroll a guest
 * to nothing in three of four phases. The chip is therefore gated on the same
 * `plan.rsvpShouldRender` that decides the card.
 *
 * ⚠ AND THE ANCHOR COULD NOT GO WHERE IT OBVIOUSLY BELONGS.
 * `only-the-answer-freezes.test.ts` pins each `<RsvpWidget` mount's IMMEDIATE
 * predecessor, and calls itself deliberately brittle. Adding `id=` to the
 * wrapper above a mount, or wrapping a mount, breaks it.
 *
 * ── REPOINTED 2026-09-20 · THE REPLY BECAME A SHEET ─────────────────────────
 * Everything above still holds; only the addresses moved. The reply card is no
 * longer a section in the page's flow — it lives inside `<RsvpSheet>`
 * (rsvp-sheet.tsx), which carries `id="your-details"` on the panel itself, so
 * the chip's fragment IS the panel rather than a marker beside it. Two
 * consequences this file now pins instead:
 *
 *   · the id lives on the SHEET, and the sheet is mounted under the same
 *     `plan.rsvpShouldRender` gate, so the phase rule is unchanged in substance;
 *   · the drawer's two labels moved into `rsvpSheetTrigger()` in
 *     rsvp-sheet-state.ts, where they are now resolved by a pure function that
 *     a test EXECUTES rather than greps.
 *
 * 🔑 The property has not changed one bit: a guest must be able to reach the
 * boxes holding their own contact details, from a control that says so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(HERE, '..', '_components', p), 'utf8');
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const BODY = strip(read('site-body.tsx'));
const CARD = strip(read('guest-hub-card.tsx'));
const SHEET = strip(read('rsvp-sheet.tsx'));
const SHEET_STATE = strip(read('rsvp-sheet-state.ts'));

test('the reply card has an anchor to point at', () => {
  assert.ok(SHEET.includes('id="your-details"'), 'no anchor exists on the reply sheet');
  // And nothing else may claim the same id, or the first one wins and the chip
  // scrolls to whichever happens to be earlier in the document.
  assert.ok(!BODY.includes('id="your-details"'), 'a second element now carries the anchor id');
});

test('a chip points at it', () => {
  assert.ok(CARD.includes('href="#your-details"'), 'nothing links to the reply card');
});

test('🔑 the chip is gated on the card actually being on the page', () => {
  // The failure this prevents: three of four phases render the summary card
  // without the reply card, so an ungated chip scrolls to nothing.
  assert.ok(
    /detailsCardOnPage \? \([\s\S]{0,400}?href="#your-details"/.test(CARD),
    'the chip is not gated on detailsCardOnPage — it will point at nothing outside the rsvp phase',
  );
  assert.ok(
    /detailsCardOnPage=\{plan\.rsvpShouldRender\}/.test(BODY),
    'the gate is not fed from the same value that decides whether the card renders',
  );
});

test('the anchor lives INSIDE the phase gate, not outside it', () => {
  // The id now rides on the <RsvpSheet> panel, so the question is whether THAT
  // is phase-gated. An ungated sheet survives into phases where the reply card
  // does not render, and the chip points at a real id attached to nothing.
  const m = /\{plan\.rsvpShouldRender \? \(\s*<RsvpSheet/.exec(BODY);
  assert.ok(m, 'the reply sheet is no longer mounted under plan.rsvpShouldRender');
  const gate = m!.index;
  const close = BODY.indexOf(') : null}', gate);
  const mount = BODY.indexOf('<RsvpSheet', gate);
  assert.ok(close > gate, 'the sheet gate is never closed — re-point this guard');
  assert.ok(mount > gate && mount < close, 'the sheet mount escaped its own gate');
});

test('🔑 both doors land in the SAME sheet', () => {
  // The brief's hard requirement. The hub card's chip and the arrival action
  // (lib/arrival-action.ts) send a guest to two different fragments; if the
  // sheet answers only one of them, the other control silently does nothing.
  // Executed, not grepped — see the-reply-is-a-sheet.test.ts for the parse.
  assert.ok(
    SHEET_STATE.includes("'your-details'"),
    "the hub card's chip anchor is not in the sheet's anchor list",
  );
  assert.ok(
    SHEET_STATE.includes('SITE_MENU_ANCHORS.me'),
    "the arrival action's RSVP anchor is not in the sheet's anchor list",
  );
});

test('the control names the details, not only the reply', () => {
  // The words moved from the <details> summary in site-body.tsx into
  // `rsvpSheetTrigger()`. Both arms must survive the move verbatim — this is
  // #4683, and shortening either to "Change" re-opens it.
  assert.ok(
    SHEET_STATE.includes('Need to change your reply or your details?'),
    'the open-list label still advertises only the reply',
  );
  // The closed-list arm already named the details and must keep doing so.
  assert.ok(
    SHEET_STATE.includes('Need to update your details?'),
    'the frozen-list label has been lost',
  );
  // …and site-body must actually render what the resolver returns, or the two
  // strings above are decoration in a file nothing reads.
  assert.ok(BODY.includes('rsvpSheetTrigger({'), 'the trigger label is never resolved');
});

test('the brittle mount guard is not disturbed', () => {
  // Its rule, restated here so a future edit sees the constraint at the place
  // it is easiest to break: each `<RsvpWidget` must still be immediately
  // preceded by `<div className="mt-4">` or `) : (`.
  const raw = read('site-body.tsx');
  const mounts = raw.split('<RsvpWidget').slice(0, -1);
  assert.equal(mounts.length, 1, 'expected exactly one mount');
  for (const [i, before] of mounts.entries()) {
    const tail = before.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trimEnd();
    assert.ok(
      tail.endsWith('<div data-rsvp-form>'),
      `mount #${i + 1} predecessor changed to "${tail.slice(-60)}" — see only-the-answer-freezes.test.ts`,
    );
  }
});
