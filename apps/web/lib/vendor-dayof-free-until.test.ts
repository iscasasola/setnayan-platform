import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vendorDayOfFreeUntilIso,
  isVendorDayOfStillFree,
  vendorDayOfFreeUntilLabel,
  vendorDayOfFreeUntilEndedLabel,
} from './vendor-dayof-free-until';

const END = '2027-03-01T23:59:59+08:00';
const BEFORE = Date.parse('2027-01-01T00:00:00+08:00');
const AFTER = Date.parse('2027-03-02T00:00:00+08:00');

// ── vendorDayOfFreeUntilIso (env read) ──────────────────────────────────────

test('env: unset env → null (no invented date)', () => {
  const prev = process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  delete process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  try {
    assert.equal(vendorDayOfFreeUntilIso(), null);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
    else process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = prev;
  }
});

test('env: blank/whitespace env → null', () => {
  const prev = process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = '   ';
  try {
    assert.equal(vendorDayOfFreeUntilIso(), null);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
    else process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = prev;
  }
});

test('env: unparseable env → null (fails open, never throws)', () => {
  const prev = process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = 'not-a-date';
  try {
    assert.equal(vendorDayOfFreeUntilIso(), null);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
    else process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = prev;
  }
});

test('env: a valid ISO date passes through verbatim', () => {
  const prev = process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = END;
  try {
    assert.equal(vendorDayOfFreeUntilIso(), END);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
    else process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL = prev;
  }
});

// ── isVendorDayOfStillFree ───────────────────────────────────────────────────

test('still-free: unset (null) → always free, regardless of clock', () => {
  assert.equal(isVendorDayOfStillFree(null, BEFORE), true);
  assert.equal(isVendorDayOfStillFree(null, AFTER), true);
});

test('still-free: free before the end, not free after', () => {
  assert.equal(isVendorDayOfStillFree(END, BEFORE), true);
  assert.equal(isVendorDayOfStillFree(END, AFTER), false);
});

test('still-free: the end instant itself is still free (inclusive)', () => {
  const endMs = Date.parse(END);
  assert.equal(isVendorDayOfStillFree(END, endMs), true);
  assert.equal(isVendorDayOfStillFree(END, endMs + 1), false);
});

test('still-free: an unparseable configured date fails open (still free)', () => {
  assert.equal(isVendorDayOfStillFree('garbage', BEFORE), true);
});

test('still-free: a non-finite now fails open (still free, never a false refusal)', () => {
  assert.equal(isVendorDayOfStillFree(END, Number.NaN), true);
});

// ── copy ──────────────────────────────────────────────────────────────────

test('label: unset → no copy at all', () => {
  assert.equal(vendorDayOfFreeUntilLabel(null), null);
  assert.equal(vendorDayOfFreeUntilEndedLabel(null), null);
});

test('label: set → mentions "Free until" and the ended copy is past-tense', () => {
  const label = vendorDayOfFreeUntilLabel(END);
  assert.ok(label && label.startsWith('Free until '), `got: ${label}`);
  const ended = vendorDayOfFreeUntilEndedLabel(END);
  assert.ok(ended && ended.includes('ended'), `got: ${ended}`);
});
