/**
 * Guard suite for the vendor-verification FEE presentation helpers
 * (Entity Map & Hardcode Audit 2026-07-04, Violation #1).
 *
 * These pin the pure "0 means Free" rule and the "<name> — <fee>" label
 * builder so a repricing (verification went free via the 20260702 migration)
 * can never re-introduce a hardcoded ₱1,500 / ₱2,500 fee in a label. The fee
 * itself is resolved from `service_catalog` at runtime — not tested here (it's
 * an async DB read), but the SKU key space it reads is locked below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLICATION_TYPES,
  APPLICATION_TYPE_NAME,
  APPLICATION_TYPE_SKU,
  applicationTypeLabel,
  feeLabelForCentavos,
} from './vendor-verification';

test('feeLabelForCentavos renders ₱0 (and anything ≤ 0) as "Free"', () => {
  assert.equal(feeLabelForCentavos(0), 'Free');
  assert.equal(feeLabelForCentavos(-1), 'Free');
  assert.equal(feeLabelForCentavos(-150000), 'Free');
});

test('feeLabelForCentavos renders a positive fee as the peso string', () => {
  assert.equal(feeLabelForCentavos(150000), '₱1,500');
  assert.equal(feeLabelForCentavos(250000), '₱2,500');
  assert.equal(feeLabelForCentavos(99), '₱0.99');
});

test('feeLabelForCentavos treats non-finite input as Free', () => {
  assert.equal(feeLabelForCentavos(Number.NaN), 'Free');
  assert.equal(feeLabelForCentavos(Number.POSITIVE_INFINITY), 'Free');
});

test('applicationTypeLabel builds "<name> — Free" when the resolved fee is 0', () => {
  // This is the post-retirement state: verification is free, so every type
  // labels as "… — Free" — no stale ₱ amount anywhere.
  assert.equal(applicationTypeLabel('initial', 0), 'Initial — Free');
  assert.equal(applicationTypeLabel('annual_renewal', 0), 'Annual renewal — Free');
  assert.equal(applicationTypeLabel('post_demotion', 0), 'Post-demotion — Free');
});

test('applicationTypeLabel reflects a non-zero resolved fee (repricing-safe)', () => {
  // If the catalog were ever re-priced to charge again, the label follows it —
  // the point of resolving the fee from the DB instead of hardcoding it.
  assert.equal(
    applicationTypeLabel('annual_renewal', 150000),
    'Annual renewal — ₱1,500',
  );
  assert.equal(
    applicationTypeLabel('post_demotion', 250000),
    'Post-demotion — ₱2,500',
  );
});

test('every application type has a name and a catalog SKU (lock-step key space)', () => {
  for (const t of APPLICATION_TYPES) {
    assert.equal(
      typeof APPLICATION_TYPE_NAME[t],
      'string',
      `${t} must have a display name`,
    );
    assert.ok(
      APPLICATION_TYPE_NAME[t].length > 0,
      `${t} name must be non-empty`,
    );
    assert.equal(
      typeof APPLICATION_TYPE_SKU[t],
      'string',
      `${t} must map to a service_catalog SKU`,
    );
  }
});

test('APPLICATION_TYPE_SKU maps to the canonical seeded sku_codes', () => {
  // Locked to 20260516000000 + 20260516050000 seeds. Changing these is a
  // migration, so this guards against a silent drift of the key space the fee
  // resolver reads.
  assert.equal(APPLICATION_TYPE_SKU.initial, 'vendor_verification_initial');
  assert.equal(
    APPLICATION_TYPE_SKU.annual_renewal,
    'verification_annual_renewal',
  );
  assert.equal(
    APPLICATION_TYPE_SKU.post_demotion,
    'verification_reverification',
  );
});
