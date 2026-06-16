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

// ---- failproof edge cases (adversarial review hardening) -------------------

test('null / undefined never throws — returns null (action contract: never throws)', () => {
  assert.equal(parsePapicTagScan(null as unknown as string), null);
  assert.equal(parsePapicTagScan(undefined as unknown as string), null);
  assert.equal(parseTableQrPayload(null as unknown as string), null);
});

test('dual-param URL resolves to GUEST, order-independent (locked precedence)', () => {
  // No real printed QR carries two params; this pins the guest-first precedence
  // so a future refactor can't silently flip it. Still event-scoped server-side.
  assert.deepEqual(
    parsePapicTagScan(`https://www.setnayan.com/x?g=${GUEST}&t=${TABLE_PUBLIC}`),
    { kind: 'guest', token: GUEST },
  );
  assert.deepEqual(
    parsePapicTagScan(`https://www.setnayan.com/x?t=${TABLE_PUBLIC}&g=${GUEST}`),
    { kind: 'guest', token: GUEST },
  );
});

test('a guest token smuggled into ?t= stays a table REF (server fails closed)', () => {
  // It classifies as a table ref but resolves to no table in the seat's event,
  // so the RPC returns table_not_found — documented, fail-closed behavior.
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?t=${GUEST}`), {
    kind: 'table',
    ref: GUEST,
  });
});

test('query-in-fragment (#?t= / #?g=) is ignored — never a tag', () => {
  assert.equal(parsePapicTagScan(`https://www.setnayan.com/x#?t=${TABLE_PUBLIC}`), null);
  assert.equal(parsePapicTagScan(`https://www.setnayan.com/x#?g=${GUEST}`), null);
});

test('a scanner-appended newline on a URL still parses', () => {
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?t=${TABLE_PUBLIC}\n`), {
    kind: 'table',
    ref: TABLE_PUBLIC,
  });
  assert.deepEqual(parsePapicTagScan(`https://www.setnayan.com/x?g=${GUEST}\r\n`), {
    kind: 'guest',
    token: GUEST,
  });
});

test('lowercase table public_id inside ?t= normalizes to upper', () => {
  assert.equal(
    parseTableQrPayload(`https://www.setnayan.com/x?t=${TABLE_PUBLIC.toLowerCase()}`),
    TABLE_PUBLIC,
  );
});

test('Crockford length boundaries — no off-by-one', () => {
  assert.equal(parseTableQrPayload('S89T-7H2K9MNP3'), null); // 9 chars
  assert.equal(parseTableQrPayload('S89T-7H2K9MNP3QQ'), null); // 11 chars
});

test('?invite= present-but-invalid does NOT fall through to ?g= (fails closed)', () => {
  // Pre-existing parseGuestQrPayload behavior (?? only falls through on absent
  // invite). Pinned so the fail-closed outcome is intentional, not accidental.
  assert.equal(parsePapicTagScan(`https://www.setnayan.com/x?invite=junk&g=${GUEST}`), null);
});
