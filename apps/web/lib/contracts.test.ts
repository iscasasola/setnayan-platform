import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveBookingContractState,
  bookingContractStateLabel,
  type ContractStatus,
} from './contracts';

// Booking↔contract derived indicator (2026-06-22). deriveBookingContractState
// collapses a booking's linked contracts into one state for the couple's
// booking surface. Precedence: signed > awaiting > draft > none; 'cancelled'
// contributes nothing.

test('no contracts → none', () => {
  assert.equal(deriveBookingContractState([]), 'none');
});

test('only cancelled contracts → none', () => {
  assert.equal(
    deriveBookingContractState(['cancelled', 'cancelled'] as ContractStatus[]),
    'none',
  );
});

test('a draft (vendor-private) → draft', () => {
  assert.equal(deriveBookingContractState(['draft'] as ContractStatus[]), 'draft');
});

test('sent_for_signature → awaiting (beats draft)', () => {
  assert.equal(
    deriveBookingContractState(['draft', 'sent_for_signature'] as ContractStatus[]),
    'awaiting',
  );
});

test('fully_signed wins over everything', () => {
  assert.equal(
    deriveBookingContractState(
      ['draft', 'sent_for_signature', 'fully_signed', 'cancelled'] as ContractStatus[],
    ),
    'signed',
  );
});

test('order-independence: signed short-circuits regardless of position', () => {
  assert.equal(
    deriveBookingContractState(['fully_signed', 'draft'] as ContractStatus[]),
    'signed',
  );
});

test('every state has a human label', () => {
  for (const s of ['none', 'draft', 'awaiting', 'signed'] as const) {
    assert.ok(bookingContractStateLabel(s).length > 0);
  }
});
