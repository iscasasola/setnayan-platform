/**
 * vendor-booking-fee-reference.test.ts — the reference a vendor must give when
 * they pay us (owner, 2026-08-06).
 *
 * Required on THIS form only. The three customer-facing payment forms stay
 * optional on purpose: a guest blocked at the last step of buying photos does
 * not go and find their reference, they leave.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requireBookingFeeReference,
  bookingFeeErrorCopy,
  BOOKING_FEE_ERRORS,
  BOOKING_FEE_REFERENCE_MAX,
} from './vendor-booking-fees';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/**
 * Source with comments stripped — `//`, `/* *\/` and JSX `{/* *\/}`.
 *
 * ⚠ THIS IS NOT TIDINESS. A guard that greps source will happily match the
 * explanatory comment sitting directly above the code it is checking, and then
 * pass while the code says the opposite. That happened FIVE separate times in
 * one day on this codebase — including on this very file's first run, where the
 * comment describing the vulnerability satisfied the test looking for it.
 * Scan the code, never the story about the code.
 */
function codeOf(path: string): string {
  return read(path)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}
const ACTION = 'app/vendor-dashboard/booking-fees/actions.ts';
const PAGE = 'app/vendor-dashboard/booking-fees/[orderId]/page.tsx';

test('empty, blank and non-string are all refused', () => {
  for (const bad of ['', '   ', '\t\n ', undefined, null, 42, {}]) {
    const r = requireBookingFeeReference(bad as unknown);
    assert.equal(r.ok, false, `accepted ${JSON.stringify(bad)}`);
  }
  // A single space is the case that matters: the browser's own `required`
  // accepts it, so a check that did not trim would let it straight through.
});

test('a real bank reference passes, trimmed', () => {
  for (const good of ['0091234567890', '  GC-8842-KKQ ', 'INSTAPAY/2026/00119', 'A1']) {
    const r = requireBookingFeeReference(good);
    assert.equal(r.ok, true, `refused ${JSON.stringify(good)}`);
    if (r.ok) assert.equal(r.reference, good.trim());
  }
  // 'A1' is deliberately in that list: NO minimum length. Six characters is a
  // downstream MATCHING heuristic — a short id is harder to match, not invalid,
  // and refusing it would block a vendor whose bank really gave them one.
});

test('no format is imposed', () => {
  // Our own 8-character code is what WE mint for the vendor to quote. What they
  // type here is their BANK'S id, and those share no shape. A regex would
  // reject real payments.
  assert.equal(requireBookingFeeReference('!!! 8842 //').ok, true);
});

test('over-long input is capped, not refused', () => {
  const r = requireBookingFeeReference('X'.repeat(500));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.reference.length, BOOKING_FEE_REFERENCE_MAX);
});

// ── the rule is REACHABLE, and enforced where it counts ─────────────────────

test('the server action enforces it, before the write and after the ownership guard', () => {
  const src = codeOf(ACTION);
  const call = src.indexOf('requireBookingFeeReference(');
  const insert = src.indexOf(".from('payments').insert(");
  const guard = src.indexOf('isVendorBookingFeeServiceKey');
  assert.ok(call > 0, 'the action never calls the rule — the page attribute would be the only check');
  assert.ok(call < insert, 'the refusal comes AFTER the insert, so a blank reference is already stored');
  assert.ok(
    guard > 0 && guard < call,
    'the reference check runs BEFORE the ownership guard, so probing a stranger’s ' +
      'order id would reveal whether it exists',
  );
  assert.ok(
    /redirect\(`\$\{vendorBookingFeePayPath\(orderId\)\}\?error=\$\{ref\.code\}`\)/.test(src),
    'the refusal throws instead of redirecting — production redacts the message ' +
      'and the vendor gets a blank console error on the screen where they pay us',
  );
});

test('the action stores the VALIDATED reference, not the raw field', () => {
  // Reverting this to `nullIfBlank(formData.get(...))` does not break the rule —
  // the refusal above still blocks a blank — so nothing user-visible fails and
  // the mutation went unnoticed on the first pass. What it silently loses is the
  // TRIM: "  GC-8842  " would be stored with its spaces, and the admin's
  // reference matcher compares strings.
  const src = codeOf(ACTION);
  assert.ok(
    /reference_number:\s*ref\.reference/.test(src),
    'The insert re-reads the raw form field instead of the validated value, so ' +
      'the reference is stored untrimmed and may not match what the bank shows.',
  );
  assert.ok(
    !/reference_number:\s*nullIfBlank\(/.test(src),
    'The old nullIfBlank read is back on reference_number.',
  );
});

test('every refusal the action can emit has copy to show', () => {
  const src = codeOf(ACTION);
  const codes = [...src.matchAll(/\?error=\$\{ref\.code\}/g)].length;
  assert.ok(codes > 0, 'no refusal is surfaced to the vendor at all');
  for (const code of Object.keys(BOOKING_FEE_ERRORS)) {
    assert.ok(bookingFeeErrorCopy(code), `no copy for "${code}" — the vendor would see an empty box`);
  }
});

test('the page cannot be made to display an attacker’s sentence', () => {
  const src = codeOf(PAGE);
  assert.ok(
    !/decodeURIComponent\(\s*search\.error\s*\)/.test(src),
    'The page renders the URL parameter straight into an alert again. It was ' +
      'harmless only while nothing wrote that parameter; now that it has a ' +
      'writer, a link could show a vendor any sentence at all inside our own ' +
      'red warning styling, on the page where they are about to send us money.',
  );
  assert.ok(/bookingFeeErrorCopy\(search\.error\)/.test(src), 'the fixed-copy lookup is gone');
  assert.equal(bookingFeeErrorCopy('anything-made-up'), null, 'an unknown code must render nothing');
});

test('the three customer-facing forms are untouched', () => {
  // The decision was explicit that only the vendor pays this price. If any of
  // these starts refusing a blank reference, a guest gets blocked at the last
  // step of buying photos.
  for (const f of [
    'app/papic/buy/actions.ts',
    'app/dashboard/[eventId]/checkout/actions.ts',
    'app/dashboard/[eventId]/orders/actions.ts',
  ]) {
    let src: string;
    try {
      src = codeOf(f);
    } catch {
      continue; // renamed or absent — not this test's business
    }
    assert.ok(
      !/requireBookingFeeReference/.test(src),
      `${f} now requires a reference. Only the vendor booking-fee form should.`,
    );
  }
});
