/**
 * Unit suite for the vendor-quote detection helpers. The load-bearing
 * invariants (money-safety): the detector is advisory + low-noise (it only
 * surfaces plausible peso figures with a currency cue, never tiny noise), it
 * never proposes logging an amount the couple has already stored, and the
 * proposal split keeps service + transport + food === total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectAmountsInText,
  detectAmountsFromVendorMessages,
  shouldOfferQuoteLog,
  splitProposalToCosting,
} from './quote-detection';

// ── detectAmountsInText — tolerant on input, conservative on output ──────────

test('detectAmountsInText: peso symbol + thousands separator', () => {
  assert.deepEqual(detectAmountsInText('Our package is ₱12,500 all-in'), [12500]);
});

test('detectAmountsInText: PHP / Php / P prefixes + decimals', () => {
  assert.deepEqual(detectAmountsInText('PHP 8,000'), [8000]);
  assert.deepEqual(detectAmountsInText('Php8000.50'), [8000.5]);
  assert.deepEqual(detectAmountsInText('P 15,000'), [15000]);
});

test('detectAmountsInText: trailing pesos cue', () => {
  assert.deepEqual(detectAmountsInText('that comes to 25,000 pesos'), [25000]);
});

test('detectAmountsInText: space-grouped + multiple distinct amounts in order', () => {
  assert.deepEqual(
    detectAmountsInText('₱18 000 for the package, plus ₱2,500 transport'),
    [18000, 2500],
  );
});

test('detectAmountsInText: de-duplicates repeated amounts', () => {
  assert.deepEqual(detectAmountsInText('₱5,000 — yes ₱5,000 confirmed'), [5000]);
});

test('detectAmountsInText: ignores tiny noise + bare numbers without a cue', () => {
  // "table 5" / "P5" / bare "12" are below the floor or have no currency cue.
  assert.deepEqual(detectAmountsInText('see you at table 5, party of 12'), []);
  assert.deepEqual(detectAmountsInText('P5'), []);
  assert.deepEqual(detectAmountsInText('we have 250 guests'), []);
});

test('detectAmountsInText: fail-soft on null / blank', () => {
  assert.deepEqual(detectAmountsInText(null), []);
  assert.deepEqual(detectAmountsInText(undefined), []);
  assert.deepEqual(detectAmountsInText('   '), []);
});

// ── detectAmountsFromVendorMessages — vendor-only, newest-first ──────────────

test('detectAmountsFromVendorMessages: only scans vendor messages', () => {
  const msgs = [
    { sender_role: 'couple', body: 'what is your rate? ₱99,999', created_at: '2026-06-10T10:00:00Z' },
    { sender_role: 'vendor', body: 'Our rate is ₱45,000', created_at: '2026-06-10T11:00:00Z' },
  ];
  assert.deepEqual(detectAmountsFromVendorMessages(msgs), [45000]);
});

test('detectAmountsFromVendorMessages: newest vendor quote leads', () => {
  const msgs = [
    { sender_role: 'vendor', body: 'starting at ₱30,000', created_at: '2026-06-10T09:00:00Z' },
    { sender_role: 'vendor', body: 'updated quote ₱42,000', created_at: '2026-06-12T09:00:00Z' },
  ];
  assert.deepEqual(detectAmountsFromVendorMessages(msgs), [42000, 30000]);
});

test('detectAmountsFromVendorMessages: fail-soft on empty / null', () => {
  assert.deepEqual(detectAmountsFromVendorMessages(null), []);
  assert.deepEqual(detectAmountsFromVendorMessages([]), []);
  assert.deepEqual(
    detectAmountsFromVendorMessages([{ sender_role: 'vendor', body: null, created_at: null }]),
    [],
  );
});

// ── shouldOfferQuoteLog — never nags once matched ────────────────────────────

test('shouldOfferQuoteLog: offer when nothing logged yet', () => {
  assert.equal(shouldOfferQuoteLog([45000], null), true);
  assert.equal(shouldOfferQuoteLog([45000], 0), true);
});

test('shouldOfferQuoteLog: hidden once stored cost matches a detected amount', () => {
  assert.equal(shouldOfferQuoteLog([45000], 45000), false);
});

test('shouldOfferQuoteLog: offer when stored cost differs from the quote', () => {
  assert.equal(shouldOfferQuoteLog([45000], 30000), true);
});

test('shouldOfferQuoteLog: hidden when no amounts detected', () => {
  assert.equal(shouldOfferQuoteLog([], 0), false);
});

// ── splitProposalToCosting — service + transport + food === total ────────────

test('splitProposalToCosting: no granular lines → whole total to service', () => {
  const split = splitProposalToCosting(5000000, [{ label: 'Package', amount_centavos: 5000000 }]);
  assert.deepEqual(split, { servicePesos: 50000, transportPesos: 0, foodPesos: 0 });
});

test('splitProposalToCosting: buckets transport + food, service = remainder', () => {
  const split = splitProposalToCosting(5000000, [
    { label: 'Photography package', amount_centavos: 4000000 },
    { label: 'Transport fee', amount_centavos: 700000 },
    { label: 'Crew meal', amount_centavos: 300000 },
  ]);
  assert.equal(split.transportPesos, 7000);
  assert.equal(split.foodPesos, 3000);
  // service = total(50000) - transport(7000) - food(3000)
  assert.equal(split.servicePesos, 40000);
  assert.equal(
    split.servicePesos + split.transportPesos + split.foodPesos,
    50000,
  );
});

test('splitProposalToCosting: fail-soft on null total / items', () => {
  assert.deepEqual(splitProposalToCosting(null, null), {
    servicePesos: 0,
    transportPesos: 0,
    foodPesos: 0,
  });
});
