/**
 * COPY GUARD — the vendor booking fee is never described as a FLAT rate.
 *
 * OWNER RULING 2026-07-27, verbatim: "we have the 5% +1% beyond 100,000 document
 * this. i don't want you asking again. remove all older information."
 *
 * So the fee is **5%, then 1% beyond ₱100,000** (₱50 floor, no cap — see
 * lib/booking-fee.ts, which is the arithmetic and is NOT under test here). Every
 * vendor-facing surface that still said "a flat 5%" was OLDER INFORMATION and was
 * swept on 2026-07-27.
 *
 * WHY A SOURCE-TEXT GUARD. The rate claim in these files is not reachable from a
 * unit test — it is a metadata string, a schema.org Offer blurb, a marketing
 * paragraph and a page docblock. Nothing type-checks them and nothing renders
 * them in CI. That is exactly how "(5%)" survived the 2026-07-25 taper and then
 * propagated into a MONEY DOCUMENT (the vendor's booking-fee order description,
 * fixed in #3805/#3809). This suite reads the files as text so a future edit that
 * re-types "flat 5%" fails loudly instead of shipping a fee claim we do not honour.
 *
 * DELIBERATELY NARROW. It scans ONLY the files swept on 2026-07-27. It must NOT
 * become a repo-wide regex: lib/booking-fee.ts, lib/booking-fee.test.ts and
 * lib/booking-fee-schedule-summary.test.ts all quote the old flat 5% ON PURPOSE —
 * to narrate what the taper superseded and to assert the taper never charges more
 * than the rate it replaced. That lineage is load-bearing; deleting it would
 * destroy the record of WHY the taper exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Swept 2026-07-27 — every file that carried a vendor-facing booking-fee rate claim. */
const SWEPT_FILES = [
  '../app/_components/home/vendor-benefits.ts',
  '../app/vendor-dashboard/booking-fees/page.tsx',
  '../app/vendors/_components/vendor-grow-sections.tsx',
  '../app/vendors/_components/vendor-tier-matrix.tsx',
  '../app/vendors/page.tsx',
  './booking-fee-lock.ts',
] as const;

function read(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

/**
 * The banned shapes. Each one asserts a FLAT rate, i.e. that the fee is 5% all
 * the way up — which is false at every peso above ₱100,000 and is precisely the
 * "older information" the owner ordered removed.
 */
const FLAT_RATE_CLAIMS: readonly RegExp[] = [
  /flat\s+5\s*%/i, // "a flat 5%", "flat 5 %"
  /5\s*%\s+(?:booking\s+)?(?:fee|commission)\b(?!\s*,?\s*(?:then|and|\+))/i, // "a 5% booking fee" with no tail
];

for (const rel of SWEPT_FILES) {
  test(`no flat-5% booking-fee claim in ${rel}`, () => {
    const src = read(rel);
    for (const re of FLAT_RATE_CLAIMS) {
      assert.doesNotMatch(
        src,
        re,
        `${rel} states the booking fee as a FLAT rate (matched ${re}). ` +
          'Owner ruling 2026-07-27: the fee is "5%, then 1% beyond ₱100,000". ' +
          'Never re-introduce a flat-rate claim on a vendor-facing surface.',
      );
    }
  });

  test(`the taper is actually stated in ${rel}`, () => {
    // Absence of the wrong claim is not the same as presence of the right one —
    // a sweep that simply DELETED the rate would pass the check above while
    // leaving the vendor with no fee statement at all.
    const src = read(rel);
    assert.match(
      src,
      /1\s*%[^\n]*₱100,000/,
      `${rel} must still name the 1% tail beyond ₱100,000 — the taper is half the claim.`,
    );
  });
}

/**
 * The vendor's booking-fee EXPLAINER sits next to their real bills, so it is the
 * one surface where the ₱50 minimum belongs (it is noise in a pitch, but it is
 * part of the actual charge and dominates below ₱1,000). Marketing copy is
 * deliberately NOT held to this.
 */
test('the booking-fee explainer states the ₱50 minimum', () => {
  const src = read('../app/vendor-dashboard/booking-fees/page.tsx');
  assert.match(
    src,
    /₱50/,
    'the vendor booking-fee page is a fee explainer read beside real bills — it must state the ₱50 minimum.',
  );
});

/**
 * Anti-erasure guard. lib/booking-fee.ts narrates what the taper SUPERSEDED, and
 * the two fee suites assert against the superseded rate on purpose. If a future
 * "remove every flat 5%" sweep is run with a repo-wide regex, it will strip that
 * lineage and this fails — the history is meant to survive.
 */
test('the superseded flat 5% survives in the files that document it', () => {
  for (const rel of [
    './booking-fee.ts',
    './booking-fee.test.ts',
    './booking-fee-schedule-summary.test.ts',
  ]) {
    assert.match(
      read(rel),
      /flat 5%|\(5%\)/,
      `${rel} must keep its reference to the superseded flat 5% — it is why the taper exists.`,
    );
  }
});
