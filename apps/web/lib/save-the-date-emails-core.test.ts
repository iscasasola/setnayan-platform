/**
 * Unit suite for the guest-row helpers the guest reminder emails share (the
 * Save-the-Date email builder and its fan-out are removed — owner 2026-10-02).
 * Pinned: the greeting name, the junk-recipient check, the date line, and the
 * couple-name fallback chain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatWeddingDate,
  isSendableEmail,
  resolveCoupleName,
  stdGuestGreetingName,
  type StdGuestRow,
} from './save-the-date-emails-core';

function guest(overrides: Partial<StdGuestRow> = {}): StdGuestRow {
  return {
    guest_id: 'g1',
    first_name: 'Ana',
    last_name: 'Santos',
    display_name: null,
    email: 'ana@example.com',
    ...overrides,
  };
}

test('isSendableEmail accepts well-formed and rejects junk/blank', () => {
  assert.equal(isSendableEmail('ana@example.com'), true);
  assert.equal(isSendableEmail('  ana@example.com  '), true);
  assert.equal(isSendableEmail('not-an-email'), false);
  assert.equal(isSendableEmail('ana@localhost'), false); // no dotted domain
  assert.equal(isSendableEmail(''), false);
  assert.equal(isSendableEmail(null), false);
  assert.equal(isSendableEmail(undefined), false);
});

test('stdGuestGreetingName prefers display first-name, then first_name, else empty', () => {
  assert.equal(stdGuestGreetingName(guest({ display_name: 'Tita Ana Reyes' })), 'Tita');
  assert.equal(stdGuestGreetingName(guest({ display_name: null, first_name: 'Ana' })), 'Ana');
  assert.equal(stdGuestGreetingName(guest({ display_name: '', first_name: '' })), '');
});

test('formatWeddingDate formats a YYYY-MM-DD and returns null for junk/missing', () => {
  assert.equal(formatWeddingDate('2026-12-12'), 'Saturday, December 12, 2026');
  assert.equal(formatWeddingDate(null), null);
  assert.equal(formatWeddingDate('not-a-date'), null);
});

test('resolveCoupleName fallback chain: display → bride & groom → default', () => {
  assert.equal(
    resolveCoupleName({ display_name: 'Maria & Jose', bride_name: 'Maria', groom_name: 'Jose' }),
    'Maria & Jose',
  );
  assert.equal(
    resolveCoupleName({ display_name: null, bride_name: 'Maria', groom_name: 'Jose' }),
    'Maria & Jose',
  );
  assert.equal(
    resolveCoupleName({ display_name: '  ', bride_name: 'Maria', groom_name: null }),
    'Maria',
  );
  assert.equal(
    resolveCoupleName({ display_name: null, bride_name: null, groom_name: null }),
    'Our wedding',
  );
});
