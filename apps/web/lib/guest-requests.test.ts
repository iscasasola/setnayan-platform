/**
 * The ask-to-join REQUEST's pure rules (lib/guest-requests.ts) — guest pathway,
 * owner 2026-09-26: "NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE LINKS OR
 * ACCEPTS THEM", and "a name is not a secret".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emailMayBindRow,
  keepLineFor,
  maskMobile,
  readRequestAnswers,
  readRequestedSeats,
  requestedSeatsNote,
  suggestRequestMatch,
} from '@/lib/guest-requests';

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const OK = { name: 'Carla Dizon', rsvp_status: 'attending', contact_email: 'Carla@Example.com', terms: 'on' };

test('a complete request reads: name, answer, contact — email lower-cased', () => {
  const r = readRequestAnswers(form(OK), {});
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.name, 'Carla Dizon');
  assert.equal(r.value.rsvp_status, 'attending');
  assert.equal(r.value.email, 'carla@example.com');
});

test('each missing piece is refused with its own reason', () => {
  const cases: Array<[Record<string, string>, string]> = [
    [{ ...OK, name: ' ' }, 'missing_name'],
    [{ ...OK, rsvp_status: 'pending' }, 'missing_answer'],
    [{ ...OK, contact_email: '' }, 'missing_contact'],
    [{ ...OK, contact_email: 'not-an-email' }, 'bad_email'],
    [{ ...OK, terms: '' }, 'missing_terms'],
  ];
  for (const [input, error] of cases) {
    const r = readRequestAnswers(form(input), {});
    assert.deepEqual(r, { ok: false, error }, `${JSON.stringify(input)} → ${error}`);
  }
});

test('a signed-in account’s email is the contact when none is typed', () => {
  const r = readRequestAnswers(form({ ...OK, contact_email: '' }), {}, 'me@acct.test');
  assert.equal(r.ok && r.value.email, 'me@acct.test');
});

test('only the questions the couple still asks are read', () => {
  const posted = form({ ...OK, meal_preference: 'fish', dietary_restrictions: 'nuts', guest_note: 'hi', seats: '3', contact_mobile: '+639171234421' });
  const on = readRequestAnswers(posted, {});
  assert.ok(on.ok);
  if (!on.ok) return;
  assert.deepEqual([on.value.meal_preference, on.value.dietary_restrictions, on.value.guest_note, on.value.seats, on.value.mobile], ['fish', 'nuts', 'hi', 3, '+639171234421']);
  const off = readRequestAnswers(posted, { meal: false, dietary: false, note: false, plus_ones: false, mobile: false });
  assert.ok(off.ok);
  if (!off.ok) return;
  assert.deepEqual([off.value.meal_preference, off.value.dietary_restrictions, off.value.guest_note, off.value.seats, off.value.mobile], ['no_preference', null, null, 1, null]);
});

test('seats ride in the couple’s note, never in plus_one_count — and read back for Keep', () => {
  assert.equal(requestedSeatsNote(1), null);
  assert.equal(requestedSeatsNote(3), 'Asked for 3 seats.');
  assert.equal(readRequestedSeats('Asked for 3 seats.'), 3);
  assert.equal(readRequestedSeats(null), 1);
  assert.equal(keepLineFor('Carla Dizon', 'Asked for 3 seats.'), 'Carla Dizon +2');
  assert.equal(keepLineFor('Carla Dizon', null), 'Carla Dizon');
  // A declined asker asks for no seats at all.
  const r = readRequestAnswers(form({ ...OK, rsvp_status: 'declined', seats: '4' }), {});
  assert.equal(r.ok && r.value.seats, 1);
});

test('🛂 only a row the couple put on the list may be bound by email — never a request', () => {
  assert.equal(emailMayBindRow('host_seeded'), true);
  assert.equal(emailMayBindRow('self_added_unlisted'), false);
  assert.equal(emailMayBindRow(null), false);
  assert.equal(emailMayBindRow(undefined), false);
});

test('the suggested match is a suggestion: confident only, never ambiguous', () => {
  const list = [
    { guestId: 'a', name: 'Carla Dizon', email: null },
    { guestId: 'b', name: 'Ben Reyes', email: null },
  ];
  assert.equal(suggestRequestMatch('Carla Dizon', list)?.guestId, 'a');
  assert.equal(suggestRequestMatch('Jomar Villanueva', list), null);
  const twins = [
    { guestId: 'a', name: 'Maria Santos', email: null },
    { guestId: 'b', name: 'Maria Santos', email: null },
  ];
  assert.equal(suggestRequestMatch('Maria Santos', twins), null, 'two look-alikes must not pick one');
});

test('a mobile is masked for the list', () => {
  assert.equal(maskMobile('+63 917 123 4421'), '+63917 ··· 4421');
  assert.equal(maskMobile('123'), null);
});
