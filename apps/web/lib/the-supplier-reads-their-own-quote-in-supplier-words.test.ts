/**
 * 🔒 THE SUPPLIER READS THEIR OWN QUOTE IN SUPPLIER WORDS (supplier walk on production, 13 Nov 2026). The supplier's own
 * view of a sent quote said "Accepting shortlists them at this price so you can compare — nothing is booked or paid
 * until you Book." — the couple's sentence, about the supplier, to the supplier. `quoteNoteShown` now takes the
 * viewer; the page passes the role check it already uses everywhere (`isVendorSide`). The couple's view is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { DEFAULT_QUOTE_NOTE_TAIL, DEFAULT_QUOTE_NOTE_TAIL_SUPPLIER, quoteNoteShown } from './accepted-quote-terms';

const BODY = `Quote from SetnaProd. Review the line items below. ${DEFAULT_QUOTE_NOTE_TAIL}`;

test('the supplier never reads the couple’s "Accepting shortlists them…"', () => {
  const supplier = quoteNoteShown(BODY, false, 'supplier');
  assert.doesNotMatch(supplier, /Accepting shortlists them/);
  assert.ok(supplier.endsWith(DEFAULT_QUOTE_NOTE_TAIL_SUPPLIER), supplier);
  assert.match(DEFAULT_QUOTE_NOTE_TAIL_SUPPLIER, /^When the couple accepts/);
});

test('the couple’s view is unchanged — before and after booking', () => {
  assert.equal(quoteNoteShown(BODY, false), BODY);
  assert.equal(quoteNoteShown(BODY, false, 'couple'), BODY);
  assert.equal(quoteNoteShown(BODY, true, 'couple'), 'Quote from SetnaProd. Review the line items below.');
  assert.equal(quoteNoteShown(BODY, true, 'supplier'), 'Quote from SetnaProd. Review the line items below.');
});

test('a supplier’s own typed note is always shown as typed', () => {
  assert.equal(quoteNoteShown('Includes two bartenders.', false, 'supplier'), 'Includes two bartenders.');
});

test('the quote page passes its own role check as the viewer', () => {
  const page = stripComments(readFileSync(join(__dirname, '..', 'app', 'proposals', '[publicId]', 'page.tsx'), 'utf8'));
  assert.match(page, /quoteNoteShown\(proposal\.rendered_body, bookedMoney !== null, isVendorSide \? 'supplier' : 'couple'\)/);
});
