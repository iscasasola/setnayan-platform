import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePhPhone, isPhPhone } from './ph-phone';

test('every way a Filipino writes their own mobile number is accepted', () => {
  // 🔑 THE COST OF STRICTNESS IS ASYMMETRIC. Refusing a real business its own
  // number, on the screen where it is signing up, with no way around it, is
  // worse than accepting a slightly odd spelling.
  for (const raw of [
    '09178807163',
    '0917 880 7163',
    '0917-880-7163',
    '+639178807163',
    '+63 917 880 7163',
    '63 917 880 7163',
    '(0917) 880-7163',
    '9178807163',
  ]) {
    const r = parsePhPhone(raw);
    assert.ok(r.ok, `rejected a real mobile: ${raw}`);
    assert.equal(r.e164, '+639178807163', `wrong normalisation for ${raw}`);
    assert.equal(r.kind, 'mobile');
  }
});

test('landlines are accepted too — not every business is a mobile', () => {
  for (const raw of ['(02) 8123 4567', '02-81234567', '+63 2 8123 4567', '032 123 4567']) {
    assert.ok(parsePhPhone(raw).ok, `rejected a real landline: ${raw}`);
  }
});

test('a foreign number is refused — the point of the rule', () => {
  // Owner: the number must belong to where the shop is. The map is
  // Philippines-only, so a US or UK number cannot be this shop's.
  for (const raw of [
    '+1 415 555 2671',   // US
    '+44 20 7946 0958',  // UK
    '+81 3 1234 5678',   // JP
    '+65 6123 4567',     // SG
  ]) {
    const r = parsePhPhone(raw);
    assert.equal(r.ok, false, `accepted a foreign number: ${raw}`);
    if (!r.ok) assert.equal(r.reason, 'not_ph');
  }
});

test('nonsense of the right length is still refused', () => {
  assert.equal(isPhPhone('1234567890'), false, 'a PH number never starts with 1');
  assert.equal(isPhPhone('0000000000'), false);
  assert.equal(isPhPhone('12345'), false, 'too short to be anything');
  assert.equal(isPhPhone('091788071634444'), false, 'too long to be a mobile');
});

test('a mobile one digit short is refused rather than rounded up', () => {
  // The most likely real typo, and the one a loose check waves through.
  assert.equal(isPhPhone('0917880716'), false);
  assert.equal(isPhPhone('091788071633'), false);
});

test('empty is its own answer, not "invalid"', () => {
  // The step already has a "you left this blank" message; conflating the two
  // would tell someone their number is wrong when they simply have not typed
  // one yet.
  const r = parsePhPhone('   ');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'empty');
});

test('the stored form is canonical, so two vendors typing it differently match', () => {
  // Narrowed rather than cast: an `as string` here would have compiled happily
  // even if the parse had failed, which is the one thing this asserts against.
  for (const raw of ['0917 880 7163', '+63.917.880.7163']) {
    const r = parsePhPhone(raw);
    assert.ok(r.ok, raw);
    assert.equal(r.e164, '+639178807163');
  }
});

test('63 at the front is only a country code when the rest is a real number', () => {
  // A bare "632..." typed without a plus is a local Manila number, not
  // country-code-plus-2. Length is what tells them apart.
  assert.ok(parsePhPhone('+639178807163').ok);
  assert.equal(parsePhPhone('639178807163').ok, true);
});
