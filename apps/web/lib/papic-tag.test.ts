/**
 * Unit suite for the Papic scan-to-tag payload parsers. A wrong classification
 * tags the wrong person (or a person onto the wrong table), so the parser must
 * accept exactly the formats the printed Setnayan QRs encode and reject the rest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTableQrPayload, parsePapicTagScan } from './papic-tag';

// Synthetic fixtures — shapes only, not credentials.
const GUEST = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // gitleaks:allow  32-hex guests.qr_token
const TABLE_PUBLIC = 'S89T-7H2K9MNP3Q'; // event_tables.public_id (Crockford)
const TABLE_TOKEN = '0f1e2d3c4b5a69788796a5b4c3d2e1f0'; // gitleaks:allow  event_tables.qr_token

// ---- parseTableQrPayload --------------------------------------------------

test('parses the seating-sign URL format (?t=<public_id>)', () => {
  assert.equal(
    parseTableQrPayload(`https://www.setnayan.com/maria-jose?t=${TABLE_PUBLIC}`),
    TABLE_PUBLIC,
  );
});

test('accepts a table qr_token inside ?t= (normalized lower)', () => {
  assert.equal(
    parseTableQrPayload(`https://www.setnayan.com/x?t=${TABLE_TOKEN.toUpperCase()}`),
    TABLE_TOKEN,
  );
});

test('parses a bare table public_id, normalizing case', () => {
  assert.equal(parseTableQrPayload(TABLE_PUBLIC.toLowerCase()), TABLE_PUBLIC);
  assert.equal(parseTableQrPayload(`  ${TABLE_PUBLIC}  `), TABLE_PUBLIC);
});

test('a bare 32-hex token is NOT a table (that shape is a guest token)', () => {
  assert.equal(parseTableQrPayload(GUEST), null);
});

test('rejects non-table payloads', () => {
  assert.equal(parseTableQrPayload(''), null);
  assert.equal(parseTableQrPayload('hello'), null);
  assert.equal(parseTableQrPayload('https://www.setnayan.com/x'), null);
  assert.equal(parseTableQrPayload(`https://www.setnayan.com/x?g=${GUEST}`), null);
  // I/L/O/U are not in Crockford base32 — a public_id can never contain them.
  assert.equal(parseTableQrPayload('S89T-ILOU000000'), null);
});

// ---- parsePapicTagScan ----------------------------------------------------

test('classifies guest QR formats', () => {
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?invite=${GUEST}`), {
    kind: 'guest',
    token: GUEST,
  });
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?g=${GUEST}`), {
    kind: 'guest',
    token: GUEST,
  });
  assert.deepEqual(parsePapicTagScan(GUEST.toUpperCase()), {
    kind: 'guest',
    token: GUEST,
  });
});

test('classifies table QR formats', () => {
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?t=${TABLE_PUBLIC}`), {
    kind: 'table',
    ref: TABLE_PUBLIC,
  });
  assert.deepEqual(parsePapicTagScan(TABLE_PUBLIC), { kind: 'table', ref: TABLE_PUBLIC });
});

test('returns null for codes that are neither a guest nor a table', () => {
  // master event QR (no token) / claim link / junk → not a tag target
  assert.equal(parsePapicTagScan('https://www.setnayan.com/maria-jose'), null);
  assert.equal(parsePapicTagScan('https://www.setnayan.com/papic/claim/abc'), null);
  assert.equal(parsePapicTagScan(''), null);
  assert.equal(parsePapicTagScan('not a url and not a token'), null);
});
