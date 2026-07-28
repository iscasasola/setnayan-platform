/**
 * vendor-discount-rows.test.ts — the multi-discount repeater parser, and in
 * particular the early-booking LADDER round-trip (owner-locked 2026-07-27).
 *
 * The parser is fed a REAL `FormData` shaped exactly the way `DiscountsEditor`
 * submits: parallel, index-aligned entries, one per row per field. Index
 * alignment is the contract that makes a ladder possible at all — if the
 * lead-time months of row 2 could land on row 1, a vendor's 6+/−10% rung would
 * silently become a 12+/−10% rung. Several tests below exist only to hold that
 * line.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiscountRows, parseMinLeadMonths } from './vendor-discount-rows';

type Row = {
  type: string;
  rate: string;
  unit?: string;
  months?: string;
  expires?: string;
  conditions?: string;
};

/** Build the FormData `DiscountsEditor` would submit for these rows. */
function form(rows: Row[]): FormData {
  const fd = new FormData();
  for (const r of rows) {
    fd.append('discount_type', r.type);
    fd.append('discount_rate', r.rate);
    fd.append('discount_unit', r.unit ?? 'pct');
    // The editor ALWAYS emits this hidden input, one per row, even when blank.
    fd.append('discount_min_lead_months', r.months ?? '');
    fd.append('discount_expires_at', r.expires ?? '');
    fd.append('discount_conditions_md', r.conditions ?? '');
  }
  return fd;
}

// ── The ladder round-trip ───────────────────────────────────────────────────

test('round-trip: a two-rung ladder survives the parser with both thresholds', () => {
  const rows = parseDiscountRows(
    form([
      { type: 'early_booking', rate: '15', months: '12' },
      { type: 'early_booking', rate: '10', months: '6' },
    ]),
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => [r.discount_type, r.rate, r.min_lead_months]),
    [
      ['early_booking', 15, 12],
      ['early_booking', 10, 6],
    ],
  );
});

test('index alignment: a mixed list keeps every months value on its OWN row', () => {
  const rows = parseDiscountRows(
    form([
      { type: 'off_peak', rate: '5' },
      { type: 'early_booking', rate: '15', months: '12' },
      { type: 'bundle', rate: '2000', unit: 'php' },
      { type: 'early_booking', rate: '10', months: '6' },
    ]),
  );
  assert.deepEqual(
    rows.map((r) => [r.discount_type, r.min_lead_months]),
    [
      ['off_peak', null],
      ['early_booking', 12],
      ['bundle', null],
      ['early_booking', 6],
    ],
  );
});

test('a skipped blank row does not shift later rows’ months', () => {
  // A fully-blank row is dropped; the rows after it must keep their own values.
  const rows = parseDiscountRows(
    form([
      { type: '', rate: '' },
      { type: 'early_booking', rate: '15', months: '12' },
      { type: 'early_booking', rate: '10', months: '6' },
    ]),
  );
  assert.deepEqual(
    rows.map((r) => r.min_lead_months),
    [12, 6],
  );
});

// ── Missing / garbage months values ─────────────────────────────────────────

test('a MISSING months array (legacy form post) parses to null, not a crash', () => {
  // Simulates a surface that submits the old field set with no months input at
  // all — the pre-ladder behaviour must survive untouched.
  const fd = new FormData();
  fd.append('discount_type', 'early_booking');
  fd.append('discount_rate', '10');
  fd.append('discount_unit', 'pct');
  fd.append('discount_expires_at', '');
  fd.append('discount_conditions_md', '');
  const rows = parseDiscountRows(fd);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.min_lead_months, null);
});

test('garbage months values degrade to null instead of bouncing the save', () => {
  const junk = ['abc', '', '   ', '0', '-6', '6.5', 'NaN', 'Infinity', '1e999', '99999'];
  for (const months of junk) {
    const rows = parseDiscountRows(form([{ type: 'early_booking', rate: '10', months }]));
    assert.equal(rows.length, 1, `row survived for ${JSON.stringify(months)}`);
    assert.equal(
      rows[0]!.min_lead_months,
      null,
      `${JSON.stringify(months)} must degrade to null, got ${rows[0]!.min_lead_months}`,
    );
  }
});

test('a months value on a NON-early_booking row is forced to null', () => {
  for (const type of ['off_peak', 'bundle', 'returning'] as const) {
    const rows = parseDiscountRows(form([{ type, rate: '10', months: '12' }]));
    assert.equal(
      rows[0]!.min_lead_months,
      null,
      `${type} must never carry a lead-time threshold`,
    );
  }
});

test('boundary months values: 1 and 600 are accepted, 0 and 601 are not', () => {
  const pick = (months: string) =>
    parseDiscountRows(form([{ type: 'early_booking', rate: '10', months }]))[0]!
      .min_lead_months;
  assert.equal(pick('1'), 1);
  assert.equal(pick('600'), 600);
  assert.equal(pick('0'), null);
  assert.equal(pick('601'), null);
});

test('parseMinLeadMonths is the same rule in isolation', () => {
  assert.equal(parseMinLeadMonths('12', 'early_booking'), 12);
  assert.equal(parseMinLeadMonths(' 12 ', 'early_booking'), 12);
  assert.equal(parseMinLeadMonths('12', 'off_peak'), null);
  assert.equal(parseMinLeadMonths(undefined, 'early_booking'), null);
  assert.equal(parseMinLeadMonths(12, 'early_booking'), null, 'non-string input is not trusted');
});

// ── Everything that already worked must keep working ────────────────────────

test('unchanged: promo without an expiry still bounces with the same message', () => {
  assert.throws(
    () => parseDiscountRows(form([{ type: 'promo', rate: '10' }])),
    /Limited-Time Promo discounts require an expiry date\./,
  );
});

test('unchanged: a non-positive rate still bounces', () => {
  assert.throws(
    () => parseDiscountRows(form([{ type: 'early_booking', rate: '0', months: '12' }])),
    /Each discount needs a positive amount\./,
  );
});

test('unchanged: an unknown discount type still bounces', () => {
  assert.throws(
    () => parseDiscountRows(form([{ type: 'mystery', rate: '10' }])),
    /Pick a discount type for each discount you add\./,
  );
});

test('unchanged: an empty repeater clears the list', () => {
  assert.deepEqual(parseDiscountRows(form([])), []);
  assert.deepEqual(parseDiscountRows(form([{ type: '', rate: '' }])), []);
});

test('unchanged: php unit and expiry/conditions still round-trip', () => {
  const rows = parseDiscountRows(
    form([
      {
        type: 'promo',
        rate: '2500',
        unit: 'php',
        expires: '2027-12-31',
        conditions: 'Weekdays only',
      },
    ]),
  );
  assert.equal(rows[0]!.unit, 'php');
  assert.equal(rows[0]!.rate, 2500);
  assert.equal(rows[0]!.conditions_md, 'Weekdays only');
  assert.ok(rows[0]!.expires_at?.startsWith('2027-12-31'));
  assert.equal(rows[0]!.min_lead_months, null);
});
