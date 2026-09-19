/**
 * THE NEXT MOVE IS EXECUTED, NOT GREPPED.
 *
 * Owner, 2026-09-18, on the client page: "Quote sent — follow up while you
 * wait" beside a couple who had accepted the quote and asked to book, and a
 * strip still reading "Quoted". Every rung below is the function run on the
 * facts of that screen — including the two that were missing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { pipelineCurrentLabel, supplierNextMove } from '@/lib/supplier-next-move';

const base = {
  inquiryStatus: 'accepted',
  lockRequested: false,
  awaitingPaymentCount: 0,
  isDelivered: false,
  hasReview: false,
  isBooked: false,
  isAccepted: false,
  isQuoted: false,
};

test('the state the owner saw: accepted + asked to book → answer the request, never "follow up"', () => {
  const move = supplierNextMove({ ...base, isQuoted: true, isAccepted: true, lockRequested: true }, 'Rosa & Ben');
  assert.equal(move.title, 'Answer their request to book');
  assert.doesNotMatch(move.body, /follow up/i);
  assert.equal(
    pipelineCurrentLabel({ isBooked: false, lockRequested: true, isAccepted: true }),
    'Asked to book',
  );
});

test('accepted but not yet asked → "Quote accepted", and the strip says so', () => {
  const move = supplierNextMove({ ...base, isQuoted: true, isAccepted: true }, 'Rosa & Ben');
  assert.equal(move.title, 'Quote accepted');
  assert.equal(pipelineCurrentLabel({ isBooked: false, lockRequested: false, isAccepted: true }), 'Quote accepted');
});

test('merely sent → "Quote sent"; nothing sent → "Send a quote"; the strip keeps its word', () => {
  assert.equal(supplierNextMove({ ...base, isQuoted: true }, 'R').title, 'Quote sent');
  assert.equal(supplierNextMove(base, 'R').title, 'Send a quote');
  assert.equal(pipelineCurrentLabel({ isBooked: false, lockRequested: false, isAccepted: false }), null);
});

test('the ladder: pending inquiry > request to book > payments > delivered > booked', () => {
  const all = { ...base, lockRequested: true, awaitingPaymentCount: 2, isDelivered: true, isBooked: true, isAccepted: true, isQuoted: true };
  assert.equal(supplierNextMove({ ...all, inquiryStatus: 'pending' }, 'R').title, 'Respond to the inquiry');
  assert.equal(supplierNextMove(all, 'R').title, 'Answer their request to book');
  assert.equal(supplierNextMove({ ...all, lockRequested: false }, 'R').title, 'Confirm 2 payments');
  assert.equal(supplierNextMove({ ...all, lockRequested: false, awaitingPaymentCount: 0 }, 'R').title, 'Awaiting confirmation');
  assert.equal(
    supplierNextMove({ ...all, lockRequested: false, awaitingPaymentCount: 0, hasReview: true }, 'R').title,
    'All wrapped up',
  );
  assert.equal(
    supplierNextMove({ ...all, lockRequested: false, awaitingPaymentCount: 0, isDelivered: false }, 'R').title,
    'You’re booked',
  );
  // Booked beats every quote word on the strip.
  assert.equal(pipelineCurrentLabel({ isBooked: true, lockRequested: true, isAccepted: true }), null);
});

test('the client page renders THIS function, and feeds it the lock request', () => {
  const page = stripComments(
    readFileSync(join(import.meta.dirname, '..', 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'),
  );
  assert.equal((page.match(/supplierNextMove\(/g) ?? []).length, 1, 'the page must call supplierNextMove exactly once');
  assert.equal((page.match(/pipelineCurrentLabel\(/g) ?? []).length, 1, 'the strip must take its current label from pipelineCurrentLabel');
  assert.match(page, /lockRequested:\s*Boolean\(lockRequest\)/, 'the lock request must reach the resolver');
  assert.match(page, /isAccepted:\s*isAccepted/, 'the accepted quote must reach the resolver');
  // The old inline chain is gone — one derivation, not two that can disagree.
  assert.equal((page.match(/vRailTitle = 'Quote sent'/g) ?? []).length, 0, 'the inline next-move chain is still in the page');
});
