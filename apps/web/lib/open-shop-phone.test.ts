/**
 * GUARD — the "Open your shop" number box (owner, 2026-11-06 gate walk): fixed +63, a mobile starts with 9 and is
 * exactly 10 digits, anything else is a landline with its area code, capped, spaced as typed, the error said under
 * the box while typing, and E.164 saved. The numbering plan itself stays `parsePhPhone`'s (lib/ph-phone.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PH_PHONE_PLACEHOLDER,
  PHONE_BOX_COPY,
  formatPhoneDigits,
  phoneBoxState,
  phoneDigitsFromTyped,
  phonePostValue,
} from './open-shop-phone';
import { parsePhPhone } from './ph-phone';

test('a leading 0, 63 or +63 is stripped — the +63 is already on the left', () => {
  assert.equal(phoneDigitsFromTyped('09178888889'), '9178888889');
  assert.equal(phoneDigitsFromTyped('+63 917 888 8889'), '9178888889');
  assert.equal(phoneDigitsFromTyped('639178888889'), '9178888889');
  assert.equal(phoneDigitsFromTyped('(02) 8123-4567'), '281234567');
  assert.equal(phoneDigitsFromTyped('abc917'), '917', 'digits only');
});

test('the box caps the length: a mobile at 10, Manila at 9 (2 + 8), elsewhere at 10', () => {
  assert.equal(phoneDigitsFromTyped('917888888912345'), '9178888889');
  assert.equal(phoneDigitsFromTyped('2812345678999'), '281234567');
  assert.equal(phoneDigitsFromTyped('3212345678999'), '3212345678');
});

test('formatted as typed', () => {
  assert.equal(formatPhoneDigits('917'), '917');
  assert.equal(formatPhoneDigits('9178'), '917 8');
  assert.equal(formatPhoneDigits('9178888889'), '917 888 8889');
  assert.equal(formatPhoneDigits('281234567'), '2 8123 4567');
  assert.equal(formatPhoneDigits('321234567'), '32 123 4567');
});

test('mobile: starts with 9, exactly 10 digits → ok, saved as E.164', () => {
  assert.deepEqual(phoneBoxState('9178888889'), { state: 'ok', kind: 'mobile', e164: '+639178888889' });
  assert.equal(phonePostValue('9178888889'), '+639178888889');
});

test('a short mobile is a hint while typing, an error once the box is left', () => {
  assert.deepEqual(phoneBoxState('917888'), { state: 'typing', message: PHONE_BOX_COPY.mobileShort(4) });
  assert.deepEqual(phoneBoxState('917888', true), { state: 'error', message: PHONE_BOX_COPY.mobileShort(4) });
});

test('landlines are allowed (owner: "Let us allow landlines too") — area code + number', () => {
  const manila = phoneBoxState('281234567');
  assert.equal(manila.state, 'ok');
  assert.equal(manila.state === 'ok' && manila.kind, 'landline');
  const cebu = phoneBoxState('322345678');
  assert.equal(cebu.state, 'ok');
  assert.equal(phonePostValue('281234567'), '+63281234567');
});

test('a start no Philippine number has is an error at once', () => {
  assert.deepEqual(phoneBoxState('1234'), { state: 'error', message: PHONE_BOX_COPY.badStart });
  // 41 is not an assigned area code: said while typing, not after ten digits.
  assert.equal(phoneBoxState('41').state, 'error');
});

test('every "ok" here is a number the server rule accepts — and the reverse for mobiles', () => {
  for (const d of ['9178888889', '281234567', '322345678', '8951234567']) {
    const s = phoneBoxState(d);
    assert.equal(s.state === 'ok', parsePhPhone(`+63${d}`).ok, d);
  }
});

test('the placeholder is a number the box accepts (never a format it refuses)', () => {
  const digits = phoneDigitsFromTyped(PH_PHONE_PLACEHOLDER);
  assert.equal(formatPhoneDigits(digits), PH_PHONE_PLACEHOLDER);
  assert.equal(phoneBoxState(digits).state, 'ok');
});

test('the wizard renders this box — +63 fixed on the left, the error under it', () => {
  const field = readFileSync(join(__dirname, '../app/open-shop/_components/phone-field.tsx'), 'utf8');
  assert.match(field, /PH_PREFIX/);
  assert.match(field, /phoneBoxState\(/);
  assert.match(field, /role="alert"|aria-live/);
  const wizard = readFileSync(join(__dirname, '../app/open-shop/_components/open-shop-wizard.tsx'), 'utf8');
  assert.match(wizard, /<PhoneField\b/);
  assert.doesNotMatch(wizard, /placeholder="\+63 917 …"/, 'the old free-text box is gone');
});
