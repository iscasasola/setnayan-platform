/**
 * 🧾 The lines above a booked client's quote (owner 18 Nov 2026): "Paid N of M · Next due" counts installments, a
 * refused plan read is SAID, and the page draws them above the quote from reads it already made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { paidOfWords, quotePlanLine } from './quote-top-lines';

const HERE = dirname(fileURLToPath(import.meta.url));

test('Paid N of M counts installments; the next due goes once all are paid', () => {
  const steps = [
    { state: 'paid' as const, due_date: '2026-11-01' },
    { state: 'pending' as const, due_date: '2026-12-09' },
    { state: 'due' as const, due_date: '2027-01-09' },
  ];
  assert.deepEqual(quotePlanLine(true, steps, '2026-12-09'), { paid: 1, total: 3, nextDue: '2026-12-09' });
  assert.equal(paidOfWords({ paid: 1, total: 3 }), 'Paid 1 of 3');
  const all = steps.map((s) => ({ ...s, state: 'paid' as const }));
  assert.deepEqual(quotePlanLine(true, all, '2026-12-09'), { paid: 3, total: 3, nextDue: null });
  assert.equal(paidOfWords({ paid: 3, total: 3 }), 'Paid in full · 3 of 3');
});

test('a refused plan read is said, never "Paid 0 of 0"; no plan draws no line', () => {
  assert.equal(quotePlanLine(false, [], null), 'unread');
  assert.equal(quotePlanLine(true, [], null), null);
});

test('the client page hands the lines to Quotation, booked only, from reads it already made', () => {
  const page = stripComments(readFileSync(join(HERE, '../app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));
  assert.match(page, /quoteTop: isBooked \? \(\s*<QuoteTopLines/, 'the lines are not booked-only');
  const at = page.indexOf('<QuoteTopLines');
  const body = page.slice(at, page.indexOf(') : null,', at));
  assert.doesNotMatch(body, /\.from\('|\.rpc\(|await /, 'the lines read on their own');
  const switcher = stripComments(readFileSync(join(HERE, '../app/vendor-dashboard/clients/[eventId]/_pages/switch.tsx'), 'utf8'));
  assert.match(switcher, /<QuotationPage ctx=\{ctx\} shipped=\{shipped\.quote\} top=\{i\.quoteTop\} \/>/);
});
