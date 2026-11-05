/**
 * OPENING A SUPPLIER IN FIND'S SHEET RECORDS A PROFILE VIEW FOR THIS EVENT, with
 * Find's (sourced) source — the most common way a couple sees a shop, and so
 * the most common "Setnayan showed them first" fact for fee rule B (owner
 * 2026-10-12, "fix the problems").
 *
 * Held here: the sheet branch of `fetchInlineMoreRow` (the sheet's ONE request)
 *   · records through the shipped writer `recordVendorProfileView`, inside
 *     `after()` — after the answer is sent, never a second request;
 *   · passes THIS event and `FIND_SHEET_VIEW_SOURCE`;
 *   · only for an event the signed-in person can read (the membership read);
 * and `FIND_SHEET_VIEW_SOURCE` is a surface the fee rule counts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { FIND_SHEET_VIEW_SOURCE, bookingFeeAttribution } from '@/lib/booking-fee-gate';

const SRC = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '_actions', 'inline-more-row.ts'), 'utf8'),
);

test("Find's sheet records one profile view for this event, after the answer, with a sourced surface", () => {
  const start = SRC.indexOf('if (sheetFor) {');
  assert.ok(start > 0, 're-point: the sheet branch moved');
  const branch = SRC.slice(start, SRC.indexOf('return { ...EMPTY, sheet };', start));
  assert.match(branch, /after\(\(\) =>\s*recordVendorProfileView\(\{ vendorProfileId: sheetFor, eventId, source: FIND_SHEET_VIEW_SOURCE \}\)/,
    'the sheet no longer records its view (inside after(), for this event, with Find\'s source)');
  assert.match(branch, /from\('events'\)\.select\('event_id'\)\.eq\('event_id', eventId\)/, 'the view is written without the membership read');
  assert.equal(bookingFeeAttribution(FIND_SHEET_VIEW_SOURCE), 'sourced', "Find's view source is not a surface the fee counts");
});
