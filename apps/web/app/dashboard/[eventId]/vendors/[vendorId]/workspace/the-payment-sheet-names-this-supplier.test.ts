/**
 * R9 (walk 18 Nov 2026) · ONE SUPPLIER PER PAYMENT SHEET.
 *
 * On the couple's workspace for "Liwanag Lights & Sound" › Payment, every line named Liwanag except one:
 * "Payments to TEST W1 per-guest supplier are recorded under Amount to pay…". The workspace names a supplier by
 * `displayName` (the shop's `business_name`, falling back to the row's `vendor_name`); the embedded
 * VendorItemizationCard named it by `summary.vendor.vendor_name` — the free-text label stored on the
 * `event_vendors` row, which can be stale or another supplier's. Same sheet, two sources for one fact.
 *
 * The card now takes the caller's name, and the workspace hands it `displayName`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(path.join(HERE, 'page.tsx'), 'utf8'));
const CARD = stripComments(
  readFileSync(path.join(HERE, '..', '..', '..', '_components', 'vendor-itemization-card.tsx'), 'utf8'),
);

describe('the payment sheet names the supplier of THIS workspace', () => {
  it('the workspace hands the embedded card its own displayName', () => {
    const block = PAGE.match(/<VendorItemizationCard\b[\s\S]*?\/>/);
    assert.ok(block, 'the workspace no longer renders VendorItemizationCard');
    assert.match(block[0], /vendorName=\{displayName\}/, 'the card is not given the name the rest of the sheet uses');
  });

  it('the card takes a vendorName from its caller', () => {
    assert.match(CARD, /export type VendorItemizationCardProps = \{[\s\S]*?\bvendorName\?: string;/);
  });

  it('the card no longer hands its sections the row snapshot directly', () => {
    const direct = CARD.match(/vendorName=\{vendor\.vendor_name\}/g) ?? [];
    assert.equal(direct.length, 0, `${direct.length} section(s) still name the supplier from event_vendors.vendor_name`);
  });
});
