/**
 * the-payment-page-reads-like-the-budget.test.ts — 💸 THE PAYMENT PAGE (THE ONE BUILD B2 §2.3, v113), rendered.
 *
 *   1 · Agreed · Paid · To collect through the couple's own `BudgetFigures` (one drawing, two pages), the meter,
 *       "₱X left to collect", and Next with Check › when the couple logged it;
 *   2 · the plan rows are the shipped kind 26 (`PriceSummary`), the couple's logged payment is answered with the shipped
 *       `PendingPaymentAnswer` (Confirm received · Not received), the asks panel is handed in, the reservation line and
 *       the footer are said;
 *   3 · a refused ledger says "part of this couldn't load" and Next "couldn't check" — no ₱0;
 *   4 · booked with no plan and nothing logged: no figures, no "all paid" (spec §4);
 *   5 · before L2's switch hands `money` in, the shipped node is drawn unchanged (nothing lost in between).
 *
 * SABOTAGE (seen red once): Paid fed `collectPhp` → 1 red; the "Check" branch removed → 1 red; the ledger door pointed
 * at `/vendor-dashboard/customers` (Build 2, 8 Nov) → 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { customerLandingHref } from '../../../customers/anchors';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');
const CTX = { eventId: 'e1', vendorProfileId: 'v1', viewerUserId: 'u1', threadId: 't1', eventName: 'Reyes & Santos wedding', stage: 'booked' as const, isBooked: true, feeUnlocked: true, eventVendorId: 'ev1', eventDate: '2026-11-08' };
const step = (seq: number, label: string, amount: number, due: string, state: 'paid' | 'pending' | 'due') => ({ seq, label, amount_php: amount, due_date: due, amount_kind: 'fixed', percent_bps: null, state });
const PENDING = { paymentId: 'p1', eventVendorId: 'ev1', amountPhp: 30000, paidAt: '2026-11-07T02:00:00Z', method: 'GCash', reference: null, notes: null, installmentLabel: 'Balance', proofUrl: 'https://x/proof.jpg', isDepositRecord: false, dispute: null };

async function draw(money: unknown, extra: Record<string, unknown> = {}) {
  const { PaymentPage } = await import('./payment');
  return renderToStaticMarkup(
    React.createElement(PaymentPage, {
      ctx: CTX,
      shipped: React.createElement('div', { 'data-shipped-money': '' }, 'SHIPPED'),
      reservationAcknowledgedAt: '2026-10-14T00:00:00Z',
      money: money as never,
      asks: React.createElement('div', { 'data-asks-panel': '' }, 'Take it back'),
      ...extra,
    }),
  );
}

test('1 · Agreed · Paid · To collect through BudgetFigures, the meter, "left to collect", Next → Check ›', async () => {
  const html = await draw({ steps: [step(1, 'Down', 8000, '2026-10-01', 'paid'), step(2, 'Balance', 30000, '2026-11-01', 'pending')], clearedAt: null, pending: [PENDING], ledgerMoney: { rows: [], receivedPhp: 0, expectedPhp: 0 }, ledgerUnreadable: false });
  const t = text(html);
  assert.match(html, /data-client-payment-figures=""/, 'the figures are not the shared BudgetFigures');
  assert.deepEqual([...html.matchAll(/data-budget-cell="(\w+)"/g)].map((m) => m[1]), ['agreed', 'paid', 'collect']);
  assert.match(t, /Agreed ₱38,000 Paid ₱8,000 To collect ₱30,000/, `the three figures are not the plan's: ${t.slice(0, 300)}`);
  assert.match(t, /₱30,000 left to collect/);
  assert.match(t, /Next ₱30,000 · Balance · Nov 1 Check ›/);
  assert.match(html, /href="#payment-logged"[^>]*data-budget-next-go="check"|data-budget-next-go="check"[^>]*href="#payment-logged"/);
  const src = readFileSync(join(import.meta.dirname, 'payment.tsx'), 'utf8');
  assert.match(src, /from '@\/app\/dashboard\/\[eventId\]\/budget\/_components\/budget-figures'/, 'not the couple’s own figures');
});

test('2 · the shipped parts: kind-26 rows, Confirm received · Not received, the asks, the reservation line, the footer', async () => {
  const html = await draw({ steps: [step(1, 'Down', 8000, '2026-10-01', 'paid'), step(2, 'Balance', 30000, '2026-11-01', 'pending')], clearedAt: null, pending: [PENDING], ledgerMoney: { rows: [], receivedPhp: 0, expectedPhp: 0 }, ledgerUnreadable: false });
  const t = text(html);
  assert.match(html, /data-price-summary=""/, 'the plan rows are not the shipped kind 26');
  assert.match(t, /Payment plan · frozen on booking · 2/);
  assert.match(html, /data-client-payment-pending="p1"/);
  assert.match(t, /Payments the couple logged ₱30,000 · Balance · logged Nov 7/);
  assert.match(t, /Their receipt/);
  const src = readFileSync(join(import.meta.dirname, 'payment.tsx'), 'utf8');
  assert.match(src, /<PendingPaymentAnswer payment=\{p\} threadId=\{ctx\.threadId \?\? ''\} returnTo=\{cardPath\} \/>/, 'the logged payment is not answered with the shipped answer');
  assert.match(html, /data-asks-panel=""/, 'the asks panel is not drawn');
  assert.match(t, /Protected by your reservation policy · acknowledged Oct 14, 2026\./);
  assert.match(t, /Their budget shows only your lines\. What you confirm here is what they see as paid\./);
  // 💸 Build 2 parity: the money ledger has a tap path from Payment — Today's Money door, never a second ledger.
  const ledger = /<a (?=[^>]*data-client-payment-ledger="")[^>]*href="([^"]+)"/.exec(html);
  assert.ok(ledger, 'Payment lost its door to the money ledger');
  assert.equal(ledger[1].replace(/&amp;/g, '&'), customerLandingHref('payday'), 'the ledger door is not the money ledger');
});

test('3 · a refused ledger: "part of this couldn’t load", Next "couldn’t check" — never ₱0', async () => {
  const html = await draw({ steps: null, clearedAt: null, pending: [], ledgerMoney: { rows: [], receivedPhp: 0, expectedPhp: 0 }, ledgerUnreadable: true, unreadableNote: React.createElement('p', null, 'NOTE') });
  const t = text(html);
  assert.match(t, /part of this couldn’t load/);
  assert.match(t, /Next couldn’t check/);
  assert.doesNotMatch(t, /₱0\b/);
  assert.match(t, /NOTE/, 'the card’s own unread note is not drawn');
});

test('4 · booked with no plan and nothing logged: no figures, never "all paid"', async () => {
  const html = await draw({ steps: null, clearedAt: null, pending: [], ledgerMoney: { rows: [], receivedPhp: 0, expectedPhp: 0 }, ledgerUnreadable: false });
  assert.doesNotMatch(html, /data-client-payment-figures/);
  assert.doesNotMatch(text(html), /all paid|₱0/i);
  assert.match(html, /data-client-payment-empty=""/);
});

test('5 · before the switch hands `money` in, the shipped node is drawn unchanged', async () => {
  const html = await draw(undefined);
  assert.match(html, /data-shipped-money=""/);
  assert.match(text(html), /Protected by your reservation policy/);
});
