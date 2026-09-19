/**
 * THE CUSTOMER PAGE SHOWS THE MONEY RECEIVED — AREA-VENDOR, 2026-09-19.
 *
 * 🔴 The supplier Saysay, on Rosa & Ben's customer page, after confirming a
 * ₱2,000 deposit on a ₱10,170 booking: Payments said "No payments to confirm
 * yet. When Rosa & Ben logs a payment, confirm it here." and Quote said "No
 * formal payment schedule on this booking yet." Both tabs read only the frozen
 * installment plan, and production has never held one.
 *
 * Three sections, each able to fail on its own:
 *   1. the CUT — `bookingMoney` keeps this event and this booking row only;
 *   2. the RENDER — the owner's case, drawn, says ₱2,000 received of ₱10,170;
 *   3. the WIRING — the page feeds the summary from the timeline and mounts it
 *      in BOTH tabs that used to say "nothing" (counted at the tag, and the
 *      Quote mount is found inside QuoteTab's own body).
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bookingMoney, type PaydayInstallmentRow } from '@/lib/vendor-cashflow';

(globalThis as unknown as { React: unknown }).React = React;

const row = (over: Partial<PaydayInstallmentRow>): PaydayInstallmentRow => ({
  event_vendor_id: 'ev-rosa',
  event_id: 'e-rosa',
  event_name: 'Rosa & Ben',
  event_date: '2026-10-30',
  seq: 1001,
  label: 'Deposit',
  amount_php: 2000,
  due_date: '2026-09-18',
  confirmed: true,
  ...over,
});

const OWNER_CASE: PaydayInstallmentRow[] = [
  row({ seq: 9999, label: 'Balance', amount_php: 8170, due_date: null, confirmed: false }),
  row({}),
  // Another couple's booking with the same shop — must never appear here.
  row({ event_vendor_id: 'ev-other', event_id: 'e-other', amount_php: 50000 }),
];

/* ── 1 · the cut ─────────────────────────────────────────────────────── */

test('one booking’s money: this event, this booking row, in order', () => {
  const m = bookingMoney(OWNER_CASE, 'e-rosa', 'ev-rosa');
  assert.deepEqual(m.rows.map((r) => r.label), ['Deposit', 'Balance']);
  assert.equal(m.receivedPhp, 2000);
  assert.equal(m.expectedPhp, 10170);
});

/* ── 2 · the render ──────────────────────────────────────────────────── */

test('the owner’s case, drawn: ₱2,000 received of ₱10,170', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BookingMoneySummary } = await import('./_components/booking-money-summary');
  const html = renderToStaticMarkup(
    React.createElement(BookingMoneySummary, { money: bookingMoney(OWNER_CASE, 'e-rosa', 'ev-rosa') }),
  );
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /₱2,000 received of ₱10,170/);
  assert.match(text, /Deposit · ₱2,000 Received/);
  assert.match(text, /Balance · ₱8,170 Not yet/);
  assert.doesNotMatch(text, /₱50,000/, 'another booking leaked into this customer page');
});

/* ── 3 · the wiring ──────────────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the page feeds the summary from the timeline and mounts it in both tabs', () => {
  assert.match(page, /ledgerMoney = bookingMoney\(/, 'ledgerMoney is never computed from the timeline');
  const mounts = page.match(/<BookingMoneySummary\s+money=\{ledgerMoney\}/g) ?? [];
  assert.equal(mounts.length, 2, `expected 2 mounts (Payments + Quote), found ${mounts.length}`);
  const quoteStart = page.indexOf('function QuoteTab(');
  assert.ok(quoteStart > 0, 'QuoteTab not found');
  const quoteEnd = page.indexOf('\nfunction ', quoteStart + 1);
  const quoteBody = page.slice(quoteStart, quoteEnd > 0 ? quoteEnd : undefined);
  assert.match(quoteBody, /<BookingMoneySummary\s+money=\{ledgerMoney\}/, 'the Quote tab does not mount it');
  assert.match(page, /ledgerMoney=\{ledgerMoney\}/, 'QuoteTab is never handed the money');
});
