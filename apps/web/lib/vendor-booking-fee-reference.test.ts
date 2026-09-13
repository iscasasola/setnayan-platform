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
/**
 * ⚖ THE RULE MOVED LANES; THIS GUARD FOLLOWED IT (2026-09-03).
 *
 * These source checks used to read `app/vendor-dashboard/booking-fees/actions.ts`
 * and assert that `logBookingFeePayment` enforced the reference before its
 * INSERT. That action was deleted as superseded — and it had had ZERO CALLERS
 * since the owner moved sending the money to the one payment page on
 * 2026-08-21, so for that whole window this guard was green about a rule
 * nothing could reach. Passing tests over a dead call path is worse than no
 * tests: it reports the rule as enforced.
 *
 * The rule itself is untouched and still the owner's, dated 2026-08-06 in both
 * places. It lives on `/pay/[reference]` now, where the vendor actually pays:
 * `payable.requiresReference && !bankReference` refuses, and the booking-fees
 * page comment says so outright — "`requiresReference` makes the field
 * mandatory there and nowhere else."
 *
 * 🔑 SO THIS IS A REPOINT, NOT A RELAXATION. If you are here because the
 * capability moved again, move these with it; do not delete them to go green.
 */
const ACTION = 'app/pay/[reference]/actions.ts';
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

test('the pay lane enforces it, and refuses BEFORE the write', () => {
  const src = codeOf(ACTION);
  const check = src.search(/payable\.requiresReference\s*&&\s*!\s*bankReference/);
  const insert = src.indexOf(".from('payments')");
  assert.ok(
    check > 0,
    'the pay action no longer refuses a booking fee with no reference — the field ' +
      'being marked required in the form would be the only check, and a form ' +
      'attribute is not a rule',
  );
  assert.ok(insert > 0, 'the pay action no longer inserts a payment — repoint this guard');
  assert.ok(
    check < insert,
    'the refusal comes AFTER the insert, so a blank reference is already stored',
  );
});

test('the pay lane stores the NORMALISED reference, not the raw field', () => {
  // Same defect, same silence as on the old lane: swapping the normalised value
  // back for a raw `formData.get(...)` breaks nothing a human would notice — the
  // refusal above still blocks a blank — while quietly losing the cleanup.
  // `normaliseReference` strips punctuation and upper-cases, so "gc-8842 " is
  // stored as "GC8842"; the admin's matcher compares strings against a bank
  // message, and a stray space or dash is a payment that never reconciles.
  const src = codeOf(ACTION);
  assert.ok(
    /const\s+bankReference\s*=\s*normaliseReference\(/.test(src),
    'the reference is no longer normalised before it is stored',
  );
  assert.ok(
    !/reference_number:\s*formData\.get\(/.test(src),
    'the insert re-reads the raw form field instead of the normalised value',
  );
});

test('every refusal the pay lane can emit is shown to the vendor', () => {
  const src = codeOf(ACTION);
  // `back(reference, 'error', '…')` is how this lane surfaces a refusal — a
  // literal sentence, not a code the page has to own copy for. A refusal that
  // only throws would give the vendor a redacted console error on the screen
  // where they pay us, which is the failure the old lane's version of this test
  // existed to prevent.
  const refusals = [...src.matchAll(/back\(\s*reference\s*,\s*'error'\s*,/g)].length;
  assert.ok(refusals > 0, 'no refusal is surfaced to the vendor at all');
  assert.ok(
    !/throw new Error\([^)]*reference/i.test(src),
    'a reference refusal throws instead of showing a sentence',
  );

  // The pure rule keeps its own copy contract regardless of which lane calls it.
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
