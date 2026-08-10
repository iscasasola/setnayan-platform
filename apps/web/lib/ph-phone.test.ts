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

// ── the numbering plan, not just the shape ──────────────────────────────────

test('DITO mobile numbers are mobile, not landlines', () => {
  // 🔴 THE DEFECT THIS CLOSES. 0895–0899 are real Philippine mobile numbers.
  // The first rule matched only numbers starting 9, so every DITO number fell
  // through to the landline branch and was ACCEPTED there — right answer on
  // ok/not-ok, wrong KIND, and nothing anywhere would have reported it.
  for (const raw of ['09951234567', '08951234567', '08991234567', '+639961234567']) {
    const r = parsePhPhone(raw);
    assert.ok(r.ok, `rejected a real mobile: ${raw}`);
    assert.equal(r.kind, 'mobile', `${raw} was classified as ${r.ok ? r.kind : '?'}`);
  }
});

test('a landline needs an area code that actually exists', () => {
  // The earlier rule took any 8–10 digits starting 2–8, so codes the plan never
  // assigned passed as landlines. Obeying the plan means checking the plan.
  // ⚠ `(021) 234 5678` was in this list and should NOT have been: strip the
  // trunk zero and the digits are `2` + an 8-digit subscriber, which is exactly
  // Metro Manila. The brackets are a person's punctuation, not part of the
  // number — my test was wrong, the code was right, and pinning the bad
  // expectation would have taught the parser to refuse a real Manila line.
  for (const raw of ['0391234567', '0691234567', '0891234567']) {
    assert.equal(isPhPhone(raw), false, `accepted a non-existent area code: ${raw}`);
  }
});

test('real landlines from around the country are accepted', () => {
  // Deliberately spread: an omission in the area-code list refuses a real
  // business its own number, and they will not tell us — they will just leave.
  const real: Array<[string, string]> = [
    ['(02) 8123 4567', '2'],    // Metro Manila, 8-digit subscriber since 2019
    ['(032) 234 5678', '32'],   // Cebu
    ['(033) 336 1234', '33'],   // Iloilo
    ['(034) 434 5678', '34'],   // Bacolod
    ['(045) 961 2345', '45'],   // Angeles / Pampanga
    ['(046) 471 2345', '46'],   // Cavite
    ['(049) 502 1234', '49'],   // Laguna
    ['(054) 473 1234', '54'],   // Naga
    ['(063) 221 2345', '63'],   // Iligan
    ['(074) 442 1234', '74'],   // Baguio
    ['(082) 224 1234', '82'],   // Davao
    ['(088) 856 1234', '88'],   // Cagayan de Oro
  ];
  for (const [raw, area] of real) {
    const r = parsePhPhone(raw);
    assert.ok(r.ok, `rejected a real landline: ${raw}`);
    assert.equal(r.kind, 'landline');
    assert.ok(r.display.startsWith(`+63 ${area} `), `${raw} → ${r.display}`);
  }
});

test('a two-digit area code wins over Metro Manila plus a stray digit', () => {
  // `32…` is Cebu, not `2` with something in front. Getting this backwards
  // would mis-split every provincial number in the country.
  const r = parsePhPhone('(032) 234 5678');
  assert.ok(r.ok);
  assert.equal(r.display, '+63 32 2345678');
});

test('a subscriber number of the wrong length is refused', () => {
  // Metro Manila is EXACTLY eight since the 2019 migration — a seven- or
  // six-digit Manila number is one somebody has not finished updating, and it
  // no longer rings.
  assert.equal(isPhPhone('(02) 812 345'), false, 'too short for Metro Manila');
  assert.equal(isPhPhone('(02) 8123 456'), false, 'seven digits is the pre-2019 form');
  assert.equal(isPhPhone('(02) 8123 456789'), false, 'too long for any exchange');
});
