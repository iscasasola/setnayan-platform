/**
 * 🧾 BEFORE A QUOTE, THE SUPPLIER'S (+) SENDS ONE (walk 13 Nov 2026). With no quote in the chat the (+) offered
 * "Change quote · A new version" and "See every version"; Change quote dropped a card saying "No quote in this chat
 * yet — send one from your service card first." with no way forward, and pinned an empty "Running topic · Quote". The
 * (+) now reads the composer's own rung (`threadHasQuote`): "Send a quote" is a DOOR to the shipped builder
 * (`#build-quote`), never a card, and "See every version" waits for a quote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEND_A_QUOTE_LABEL, supplierPlusRows } from '@/lib/chat-plus';
import { VENDOR_THREAD_TOOLS } from '@/lib/vendor-thread-tools';
import { stripComments } from '@/lib/strip-comments';

test('no quote yet → "Send a quote", a door to #build-quote, and no "See every version"', () => {
  const rows = supplierPlusRows({ paid: false, hasQuote: false });
  const quote = rows.find((r) => r.key === 'quote')!;
  assert.equal(quote.label, SEND_A_QUOTE_LABEL);
  assert.equal(quote.card, null, 'a card here pins an empty Running topic');
  assert.equal(quote.door, 'build-quote');
  assert.equal(VENDOR_THREAD_TOOLS.find((t) => t.key === 'build-quote')?.label, SEND_A_QUOTE_LABEL, 'the row and the builder name two things');
  assert.equal(rows.some((r) => r.key === 'versions'), false);
});

test('a quote out → "Change quote" and "See every version", as before (also when the rung is not handed in)', () => {
  for (const rows of [supplierPlusRows({ paid: false, hasQuote: true }), supplierPlusRows({ paid: false })]) {
    assert.equal(rows.find((r) => r.key === 'quote')?.label, 'Change quote');
    assert.equal(rows.find((r) => r.key === 'quote')?.card, 'quote');
    assert.ok(rows.some((r) => r.key === 'versions'));
  }
});

test('the thread page hands the (+) the same rung the composer reads', () => {
  const page = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8'));
  // `dealEntry.offerDeal` IS `threadHasQuote(…)` (lib/deal-entry.ts) — the page derives it once (deal-waits-for-a-quote).
  assert.match(page, /<ThreadToolsSheet [^>]*hasQuote=\{dealEntry\.offerDeal\}/);
});
