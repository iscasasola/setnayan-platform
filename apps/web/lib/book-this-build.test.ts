/**
 * book-this-build.test.ts — what "Book this build" does with each answer the
 * ONE booking path (`finalizeVendor`) can give (Suppliers PR3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookFields, bookOutcomeOf, bookedToast } from './book-this-build';
import { stripComments } from './strip-comments';
import type { FinalizeVendorResult } from '@/app/dashboard/[eventId]/vendors/actions';

const NAME = 'Hiraya Table';
const of = (r: Partial<FinalizeVendorResult> & { status: FinalizeVendorResult['status'] }) => bookOutcomeOf(r as FinalizeVendorResult, NAME);

test('an ask, a direct booking and a proposal are each DONE, and say which', () => {
  assert.deepEqual(of({ status: 'lock_requested' }), { kind: 'done', how: 'asked' });
  assert.deepEqual(of({ status: 'ok' }), { kind: 'done', how: 'booked' });
  assert.deepEqual(of({ status: 'already_locked' }), { kind: 'done', how: 'booked' });
  assert.deepEqual(of({ status: 'proposed' }), { kind: 'done', how: 'proposed' });
});

test('a booking that makes the date official is a question, answered with BOTH consents', () => {
  const o = bookOutcomeOf(
    { status: 'date_will_lock', vendorId: 'v', vendorName: NAME, resultingDate: '2026-12-12', dateLabel: 'Saturday, December 12, 2026', impact: null },
    NAME,
  );
  assert.equal(o.kind, 'confirm');
  if (o.kind !== 'confirm') return;
  assert.deepEqual(o.flags, ['confirm_date_lock', 'confirm_lock_impact']);
  assert.equal(o.headline, 'This books your date.');
  assert.match(o.lines[0]!, /Booking Hiraya Table leaves only one of your candidate dates open\. Continuing will finally set your date to Saturday, December 12, 2026\./);
});

test('a slot, reservation terms, a first payment and a booked category keep their own step — never answered here', () => {
  for (const status of ['slot_required', 'reservation_terms_required', 'downpayment_required'] as const) {
    assert.equal(of({ status }).kind, 'own_step', status);
  }
  const conflict = bookOutcomeOf(
    { status: 'hard_single_conflict', groupId: 'reception_venue', groupLabel: 'Reception', existingVendorId: 'x', existingVendorName: 'Seda Vertis North' },
    NAME,
  );
  assert.deepEqual(conflict, { kind: 'own_step', why: 'You already booked Seda Vertis North for Reception.' });
});

test('a refusal carries its reason, and an unknown answer never reads as nothing', () => {
  assert.equal(of({ status: 'vendor_not_verified' }).kind, 'refused');
  assert.deepEqual(bookOutcomeOf({ status: 'error', message: 'No.' }, NAME), { kind: 'refused', why: 'No.' });
  const strange = bookOutcomeOf({ status: 'something_new' } as unknown as FinalizeVendorResult, NAME);
  assert.equal(strange.kind, 'refused');
  assert.match((strange as { why: string }).why, /We couldn’t confirm the booking \(something_new\)/);
});

test('GOLDEN: one pick posts the fields its own Book button posts — and nothing that would skip a consent', () => {
  assert.deepEqual(bookFields('e', 'v', []), [['event_id', 'e'], ['vendor_id', 'v']]);
  assert.deepEqual(bookFields('e', 'v', ['confirm_date_lock', 'confirm_lock_impact']), [
    ['event_id', 'e'],
    ['vendor_id', 'v'],
    ['confirm_date_lock', '1'],
    ['confirm_lock_impact', '1'],
  ]);
  // The loop can never tick the reservation terms, override a booked category,
  // pick a slot or send a payment on the couple's behalf.
  const src = stripComments(readFileSync(join(__dirname, 'book-this-build.ts'), 'utf8')) +
    stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/vendors/_components/book-this-build.tsx'), 'utf8'));
  for (const never of ['acknowledge_reservation_terms', 'override_existing', 'service_time_slot_id', 'deposit_method_id', 'deposit_php']) {
    assert.ok(!src.includes(never), `Book this build posts ${never}`);
  }
  // …and the one booking path is the shipped action — no status is written here.
  assert.match(src, /import \{ finalizeVendor, type FinalizeVendorResult \} from '\.\.\/actions';/);
  assert.doesNotMatch(src, /supabase|\.update\(|\.insert\(|updateVendorStatus/);
});

test('the toast is the prototype’s, and counts what happened', () => {
  assert.equal(bookedToast(['asked']), 'Asked 1 supplier to book — each opens when they say yes');
  assert.equal(bookedToast(['asked', 'asked']), 'Asked 2 suppliers to book — each opens when they say yes');
  assert.equal(bookedToast(['booked']), 'Booked 1 supplier ✓');
  assert.equal(bookedToast(['asked', 'booked']), 'Asked 1 supplier to book — each opens when they say yes · booked 1 supplier ✓');
  assert.equal(bookedToast([]), null);
});
