/**
 * Unit suite for the day-of check-in QR-payload parser. The parser must accept
 * every format a printed Setnayan guest QR actually encodes (invitation
 * `?invite=` URLs, seating print-pack `?g=` URLs, bare tokens) and reject
 * everything else — a wrong match at the venue door checks in the wrong guest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseGuestQrPayload, guestInitials } from './checkin';

// Synthetic 32-hex fixture in the shape of guests.qr_token — not a credential.
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // gitleaks:allow

test('parses the invitation URL format (?invite=)', () => {
  assert.equal(
    parseGuestQrPayload(`https://www.setnayan.com/maria-jose?invite=${TOKEN}`),
    TOKEN,
  );
});

test('parses the seating print-pack format (?g=)', () => {
  assert.equal(parseGuestQrPayload(`https://www.setnayan.com/maria-jose?g=${TOKEN}`), TOKEN);
});

test('parses a bare 32-hex token, normalizing case', () => {
  assert.equal(parseGuestQrPayload(TOKEN.toUpperCase()), TOKEN);
  assert.equal(parseGuestQrPayload(`  ${TOKEN}  `), TOKEN);
});

test('prefers ?invite= when both params are present', () => {
  const other = 'ffffffffffffffffffffffffffffffff';
  assert.equal(
    parseGuestQrPayload(`https://www.setnayan.com/x?invite=${TOKEN}&g=${other}`),
    TOKEN,
  );
});

test('rejects non-guest payloads', () => {
  assert.equal(parseGuestQrPayload(''), null);
  assert.equal(parseGuestQrPayload('hello world'), null);
  assert.equal(parseGuestQrPayload('https://www.setnayan.com/maria-jose'), null);
  // table QR (?t=) is NOT a guest token
  assert.equal(parseGuestQrPayload(`https://www.setnayan.com/x?t=${TOKEN}`), null);
  // wrong token shape inside the right param
  assert.equal(parseGuestQrPayload('https://www.setnayan.com/x?invite=tooshort'), null);
  assert.equal(
    parseGuestQrPayload(`https://www.setnayan.com/x?invite=${TOKEN}zz`),
    null,
  );
  // a different site carrying the right-shaped token still parses — the desk
  // then fails closed because the token won't match any guest on THIS event.
});

test('guestInitials covers the avatar fallback shapes', () => {
  assert.equal(guestInitials('Elena Santos'), 'ES');
  assert.equal(guestInitials('Cher'), 'C');
  assert.equal(guestInitials('Maria Clara dela Cruz'), 'MC');
  assert.equal(guestInitials('   '), '?');
});
