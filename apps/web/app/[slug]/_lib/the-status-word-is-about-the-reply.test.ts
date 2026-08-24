/**
 * The one status word a guest sees describes their ANSWER, not their membership.
 *
 * 🚨 THE DEFECT. A guest who joins IS on the list — the row exists, the seat is
 * theirs, `rsvp_status` is `NOT NULL DEFAULT 'pending'` and is set at row
 * creation, not by anything the guest failed to do. But the only status-shaped
 * element on the page they land on said **"PENDING"**, in muted grey mono
 * uppercase, which reads as *you have not finished*. The product already tells
 * them they are in, in five other places; this one word contradicted all of
 * them.
 *
 * 🔑 AND IT WAS TWO SURFACES, NOT ONE — which is the part a single-file fix
 * misses. `RsvpPill` said "Pending" and `guest-hub-card`'s `rsvpMeta` default
 * arm said "RSVP pending", with NO shared constant between them: they had
 * already drifted apart, agreeing only by coincidence. Both are rendered to the
 * same guest on the same page.
 *
 * ⚖ WHAT WAS DELIBERATELY NOT TOUCHED — each of these is a decision, not a
 * defect, and changing any of them would be a reversal:
 *   · "Your place is reserved" (attending) — owner-locked, DECISION_LOG
 *     2026-06-14 "RSVP path purpose LOCKED".
 *   · the tone map, the chip classes, the three radio labels.
 *   · the enum value `pending` itself — this is a word problem, not a data one.
 *
 * The 2026-06-14 lock was read before changing anything: it governs the RSVP
 * path's PURPOSE and the attending line. It says nothing about this word.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(HERE, '..', '_components', p), 'utf8');
/** Comments stripped — a guard must never pass on the prose explaining it. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const WIDGET = strip(read('rsvp-widget.tsx'));
const HUBCARD = strip(read('guest-hub-card.tsx'));

/** The exact label both surfaces must show for an unanswered invitation. */
const LABEL = 'No reply yet';

test('neither surface tells a guest they are "pending"', () => {
  // The word the defect was made of. Not the enum value — a quoted LABEL.
  for (const [name, src] of [['rsvp-widget', WIDGET], ['guest-hub-card', HUBCARD]] as const) {
    assert.ok(
      !/'Pending'|"Pending"|'RSVP pending'|"RSVP pending"/.test(src),
      `${name} still labels the guest "pending" — it reads as "you are not finished"`,
    );
  }
});

test('both surfaces show the SAME words, because one guest sees both', () => {
  assert.ok(WIDGET.includes(`'${LABEL}'`), `rsvp-widget must render "${LABEL}"`);
  assert.ok(HUBCARD.includes(`'${LABEL}'`), `guest-hub-card must render "${LABEL}"`);
});

test('the word is about the REPLY, never about being on the list', () => {
  // A future edit that reaches for membership language here re-creates the
  // defect from the other direction: a guest reading "not a guest yet" on the
  // page that already greeted them by name.
  const FORBIDDEN = /not (yet )?(a guest|on the list|confirmed as)|awaiting approval|unconfirmed guest/i;
  for (const [name, src] of [['rsvp-widget', WIDGET], ['guest-hub-card', HUBCARD]] as const) {
    assert.ok(!FORBIDDEN.test(src), `${name} describes their MEMBERSHIP as incomplete`);
  }
});

test('the owner-locked attending line is untouched', () => {
  // DECISION_LOG 2026-06-14. If this ever fails, the change that broke it is a
  // reversal of an owner decision, not a copy fix.
  assert.ok(
    read('rsvp-widget.tsx').includes('Your place is reserved'),
    'the owner-locked reservation line has been removed or reworded',
  );
});

test('the enum value itself is untouched — this is a word fix, not a data change', () => {
  // `pending` must still be the state the code branches on; only the rendered
  // string moved. Renaming the value would be a migration wearing a copy fix.
  assert.ok(
    /status === 'pending'/.test(WIDGET),
    'the pending branch is gone — the label change has turned into a data change',
  );
});
