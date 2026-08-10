import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pinConfirmCopy } from './pin-confirm-copy';

test('a named city is asked about by name, with the street to check it against', () => {
  const c = pinConfirmCopy(
    { city: 'Quezon City', address: '12 Banawe St, Quezon City' },
    '',
  );
  assert.equal(c.city, 'Quezon City');
  assert.equal(c.question, null);
  assert.equal(c.detail, '12 Banawe St, Quezon City');
});

test('a street with no city still gives something to check', () => {
  const c = pinConfirmCopy({ city: '', address: '12 Banawe St' }, '');
  assert.equal(c.city, null);
  assert.equal(c.question, 'Is this the right spot?');
  assert.equal(c.detail, '12 Banawe St');
});

test('when the lookup finds nothing, what the vendor typed is shown instead', () => {
  // 🔑 THE CASE THIS FILE EXISTS FOR. Their own words were sitting in the box
  // directly above and the card ignored them, so it asked a question with
  // nothing in it.
  const c = pinConfirmCopy(null, '76 Sampaguita Ave, Novaliches');
  assert.equal(c.question, 'Is this the right spot?');
  assert.equal(c.detail, '76 Sampaguita Ave, Novaliches');
});

test('same when the lookup came back empty rather than null', () => {
  const c = pinConfirmCopy({ city: '', address: '   ' }, '76 Sampaguita Ave');
  assert.equal(c.detail, '76 Sampaguita Ave');
  assert.equal(c.question, 'Is this the right spot?');
});

test('with nothing at all, it says so and points at the map', () => {
  // Never a bare "Is this the right spot?" with an empty card underneath — a
  // confirmation with no information in it just trains people to tap yes.
  const c = pinConfirmCopy(null, '');
  assert.equal(c.detail, null);
  assert.match(c.question ?? '', /couldn’t name that spot/);
  assert.match(c.question ?? '', /where your business is/);
});

test('the matched street beats the typed one — a wrong pin has to be able to disagree', () => {
  const c = pinConfirmCopy(
    { city: '', address: '9 Kalayaan Ave' },
    '76 Sampaguita Ave',
  );
  // Showing what they typed here would echo their input back at them and
  // agree with any pin at all.
  assert.equal(c.detail, '9 Kalayaan Ave');
});

test('whitespace is never mistaken for an answer', () => {
  const c = pinConfirmCopy({ city: '  ', address: '' }, '   ');
  assert.equal(c.city, null);
  assert.equal(c.detail, null);
  assert.match(c.question ?? '', /couldn’t name that spot/);
});

test('every branch asks exactly one question', () => {
  // Rendering both a city line and a question would put two questions on one
  // card with one Yes button between them.
  for (const c of [
    pinConfirmCopy({ city: 'Cebu City', address: 'A St' }, ''),
    pinConfirmCopy({ city: '', address: 'A St' }, ''),
    pinConfirmCopy(null, 'B St'),
    pinConfirmCopy(null, ''),
  ]) {
    assert.notEqual(
      c.city === null,
      c.question === null,
      'exactly one of city / question must be set',
    );
  }
});
