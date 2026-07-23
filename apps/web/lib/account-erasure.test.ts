import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distinctGuestIds,
  distinctPersonIds,
  serializeTempPasswordFlash,
  parseTempPasswordFlash,
} from './account-erasure';

test('distinctGuestIds keeps non-null ids, dedupes, drops empties/nulls', () => {
  assert.deepEqual(
    distinctGuestIds([
      { guest_id: 'g1' },
      { guest_id: null },
      { guest_id: 'g2' },
      { guest_id: 'g1' }, // duplicate
      { guest_id: '' }, // empty
      {}, // missing
    ]),
    ['g1', 'g2'],
  );
});

test('distinctGuestIds returns [] when no member row is a guest', () => {
  assert.deepEqual(distinctGuestIds([{ guest_id: null }, {}]), []);
});

test('distinctPersonIds keeps non-null ids, dedupes, drops empties/nulls', () => {
  assert.deepEqual(
    distinctPersonIds([
      { person_id: 'p1' },
      { person_id: null },
      { person_id: 'p1' }, // duplicate
      { person_id: '' }, // empty
      {}, // missing
    ]),
    ['p1'],
  );
});

test('biometric-purge resolution unions event-member + person-linked guests', () => {
  // The purge feeds BOTH user→guest links into distinctGuestIds: the guest a
  // signed-in account is bound to (event_members.guest_id) AND guest rows linked
  // via the person spine (guests.person_id → people.claimed_by_user_id). This
  // asserts the union covers a guest reachable ONLY through the person spine —
  // a public-page selfie RSVP the subject never joined the event for — which
  // the old event_members-only resolution missed (RA 10173 erasure gap).
  const fromMembers = [{ guest_id: 'gm1' }, { guest_id: null }];
  const fromPersonSpine = [
    { guest_id: 'gp-orphan' }, // never in event_members
    { guest_id: 'gm1' }, // also a member — must not double-target
  ];
  assert.deepEqual(
    distinctGuestIds([...fromMembers, ...fromPersonSpine]),
    ['gm1', 'gp-orphan'],
  );
});

test('temp-password flash round-trips through serialize/parse', () => {
  const flash = { password: 'temp-pw-fixture', email: 'user@example.com' };
  const parsed = parseTempPasswordFlash(serializeTempPasswordFlash(flash));
  assert.deepEqual(parsed, flash);
});

test('parseTempPasswordFlash rejects malformed / partial / non-string cookies', () => {
  assert.equal(parseTempPasswordFlash(null), null);
  assert.equal(parseTempPasswordFlash(''), null);
  assert.equal(parseTempPasswordFlash('not-json'), null);
  assert.equal(parseTempPasswordFlash('123'), null); // JSON number, not object
  assert.equal(parseTempPasswordFlash('null'), null);
  assert.equal(parseTempPasswordFlash(JSON.stringify({ password: 'x' })), null); // no email
  assert.equal(parseTempPasswordFlash(JSON.stringify({ email: 'a@b.co' })), null); // no password
  assert.equal(
    parseTempPasswordFlash(JSON.stringify({ password: '', email: 'a@b.co' })),
    null,
  ); // empty password
  assert.equal(
    parseTempPasswordFlash(JSON.stringify({ password: 5, email: 'a@b.co' })),
    null,
  ); // non-string password
});
