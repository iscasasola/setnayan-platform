/**
 * get-in-choices-are-named-plainly.test.ts — the five "How guests get in"
 * choices carry exactly the owner's plain names and one-sentence hints
 * (2026-10-07, HOME_AND_GUESTS_CHECK G25: *"name it as simple as possible and
 * have the correct description as simple as possible"*), in `lib/who-can-reply.ts`
 * itself, so every door (Guests › Setup, the Maker, Event Details, onboarding)
 * reads the same words. Same five values, same stored keys.
 *
 * 🛡 Sabotage: put "Guests reply" back as the `list` label → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUESTS_GET_IN_CHOICES, guestsGetInLabel, guestsGetInPatch, readGuestsGetIn } from './who-can-reply';

const PLAIN = [
  ['list', 'Only my list', 'They reply', 'You list every guest. They answer yes or no.'],
  ['personal', 'Only my list', 'No reply', 'You list every guest. Their QR is their ticket.'],
  ['requests', 'My list + requests', 'They reply', 'Anyone with the link can ask to join. You say yes. Guests answer yes or no.'],
  ['one_qr_approve', 'My list + requests', 'No reply', 'Anyone with the link can ask to join. You say yes. No yes-or-no step.'],
  ['one_qr', 'Open', 'Anyone with the link', 'Whoever opens the link is in.'],
] as const;

test('the five choices are the plain names and hints, in order', () => {
  assert.deepEqual(
    GUESTS_GET_IN_CHOICES.map((c) => [c.value, c.group, c.label, c.hint]),
    PLAIN.map((r) => [...r]),
  );
});

test('the one phrase every door shows is heading · choice', () => {
  assert.equal(guestsGetInLabel('list'), 'Only my list · They reply');
  assert.equal(guestsGetInLabel('one_qr'), 'Open · Anyone with the link');
});

test('a copy change only — every value still round-trips through the stored keys', () => {
  for (const [value] of PLAIN) assert.equal(readGuestsGetIn(guestsGetInPatch(value)), value);
});

test('no old wording survives anywhere in the choices', () => {
  const words = JSON.stringify(GUESTS_GET_IN_CHOICES);
  for (const old of ['List only', 'Accept', 'Guests reply', 'One QR for everyone', 'I approve each']) {
    assert.ok(!words.includes(old), `"${old}" is back in GUESTS_GET_IN_CHOICES`);
  }
});
