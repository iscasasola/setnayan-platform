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
 * predecessor to one of exactly two strings, and calls itself deliberately
 * brittle. Adding `id=` to the `<div className="mt-4">` above one mount, or
 * wrapping either mount, breaks it. The anchor is a zero-height sibling INSIDE
 * the phase gate instead — which changes neither predecessor. That guard is
 * untouched and still passes.
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

test('the reply card has an anchor to point at', () => {
  assert.ok(BODY.includes('id="your-details"'), 'no anchor exists on the reply card');
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
  // An anchor outside the gate survives into phases where the card does not
  // render — the chip would then be pointing at a real id attached to nothing.
  const gate = BODY.indexOf('plan.rsvpShouldRender ? (');
  const anchor = BODY.indexOf('id="your-details"');
  const close = BODY.indexOf(') : null}', gate);
  assert.ok(gate > -1 && anchor > gate && anchor < close, 'the anchor is not inside the rsvp gate');
});

test('the drawer names the details, not only the reply', () => {
  assert.ok(
    BODY.includes('Need to change your reply or your details?'),
    'the open-list label still advertises only the reply',
  );
  // The closed-list arm already named the details and must keep doing so.
  assert.ok(
    BODY.includes('Need to update your details?'),
    'the frozen-list label has been lost',
  );
});

test('the brittle mount guard is not disturbed', () => {
  // Its rule, restated here so a future edit sees the constraint at the place
  // it is easiest to break: each `<RsvpWidget` must still be immediately
  // preceded by `<div className="mt-4">` or `) : (`.
  const raw = read('site-body.tsx');
  const mounts = raw.split('<RsvpWidget').slice(0, -1);
  assert.ok(mounts.length > 1, 'expected at least two mounts');
  for (const [i, before] of mounts.entries()) {
    const tail = before.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trimEnd();
    assert.ok(
      tail.endsWith('<div className="mt-4">') || tail.endsWith(') : ('),
      `mount #${i + 1} predecessor changed to "${tail.slice(-60)}" — see only-the-answer-freezes.test.ts`,
    );
  }
});
