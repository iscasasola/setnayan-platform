/**
 * 🚶 ROUND 5 — the end-to-end fee walk, 13 Nov 2026 (RW-22 · RW-24 · RW-26 · RW-30). Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { quoteSentKey, QUOTE_SENT_NOTICES } from './quote-card-return';
import { offerDayWords } from './personal-invite-offer';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('RW-22 · the supplier record an inquiry writes carries the thread’s source', () => {
  const src = code('app/v/[slug]/inquiry-actions.ts');
  assert.match(src, /\.from\('chat_threads'\)\s*\.select\('inquiry_source'\)\s*\.eq\('thread_id', threadId\)/);
  assert.match(src, /\.\.\.\(threadSource \? \{ source: threadSource \} : \{\}\)/, 'the insert carries it');
  assert.match(src, /if \(!\(evRow as \{ source\?: string \| null \}\)\.source && threadSource\) patch\.source = threadSource;/, 'an existing row only while empty');
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /SUPPLIER_BROUGHT_SOURCES\.has\(completion\.source\)\) \|\| completion\?\.source === 'website'/, 'the badge reads the same sets as the fee');
});

test('RW-24 · a refused quote says why on a pending inquiry, and the built quote is kept', () => {
  const page = code('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /data-proposal-notice="pending"/);
  assert.match(page, /Say yes to this inquiry first — a quote goes on an open conversation\. Nothing was sent; your quote is kept on this device\./);
  const maker = code('app/_components/proposal-maker.tsx');
  assert.match(maker, /onSubmit=\{keepQuoteOnSend\}/);
  assert.match(maker, /if \(restoreQuoteAfterRefusal\(\)\) return;/);
  assert.equal(quoteSentKey('t1'), 'sn-quote-sent:t1');
  assert.deepEqual([...QUOTE_SENT_NOTICES].sort(), ['proposal_sent', 'proposal_sent_no_card']);
});

test('RW-26 · the couple’s booking button reads the live switch before the press', () => {
  const stream = code('app/_components/chat-message-stream.tsx');
  assert.match(stream, /quoteState\.offerLock && lockTarget && !bookingsOpen \?/);
  assert.match(stream, /\{BOOKINGS_OPEN_SOON\}/);
  assert.match(code('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /bookingsOpen=\{quoteLockTarget \? await areBookingsOpen\(\) : true\}/);
});

test('RW-30 · the Plan page says every date one way, the Manila day', () => {
  const screen = code('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(screen, /timeZone: 'Asia\/Manila'/);
  assert.match(screen, /return offerDayWords\(manilaDay\);/);
  assert.equal(offerDayWords('2026-12-12'), '12 Dec 2026');
});

test('RW-37 · a bill’s own placeholder payment row (no reference, no screenshot) is not a payment', async () => {
  const { paymentWasLogged } = await import('./payment-logged');
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: null, screenshot_url: null }), false);
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: '  ', screenshot_url: null }), false);
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: 'GC123', screenshot_url: null }), true);
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: null, screenshot_url: 'r2://x' }), true);
  assert.equal(paymentWasLogged({ status: 'matched', reference_number: null, screenshot_url: null }), true, 'money an admin matched is received');
  const { computeOrderTotals } = await import('./orders');
  const order = { requested_total_php: 1337.5, confirmed_total_php: null } as never;
  const t = computeOrderTotals(order, [{ status: 'pending', amount_php: 1337.5, reference_number: null, screenshot_url: null }] as never, 0);
  assert.equal(t.pending, 0, 'the placeholder is not "pending review"');
  assert.match(code('app/vendor-dashboard/booking-fees/[orderId]/page.tsx'), /const loggedPayments = payments\.filter\(paymentWasLogged\);/);
  assert.match(code('app/admin/payments/page.tsx'), /paymentWasLogged\(p\) \? p\.paid_at : 'Nothing logged yet'/);
});

test('RW-38 · the supplier is told the booking stands for the couple; a gate is named only when it is on', async () => {
  const { lockAgreeNotice } = await import('./lock-answer-notice');
  const off = lockAgreeNotice('ok', { feeHeld: true })!.text;
  assert.doesNotMatch(off, /tell the couple/);
  assert.match(off, /it stands for the couple whatever happens/);
  assert.doesNotMatch(off, /open this event/, 'no gate claimed while the gate is off');
  assert.match(lockAgreeNotice('ok', { feeHeld: true, feeLocksEvent: true })!.text, /Pay it to open this event’s details and day-of tools\./);
});

test('RW-39 · a Setnayan-sourced booking’s chip reads From Setnayan, never In-house', () => {
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /bookingFeeAttribution\(completion\.source\) === 'sourced' \|\| SETNAYAN_SAVE_SOURCES\.has\(completion\.source\)/);
  assert.match(page, /isFromSetnayan \?/);
  assert.match(page, /\/> From Setnayan/);
});

/* ── ROUND 6, folded in (same cause as RW-37: the bill's placeholder payment row) ───────────────────────────── */

test('RW-46/47 · the admin queue never shows the placeholder beside a logged payment; logging one removes it', async () => {
  const { hidePlaceholdersBesideLogged } = await import('./payment-logged');
  const rows = [
    { payment_id: 'ph', order_id: 'o1', status: 'pending', reference_number: null, screenshot_url: null },
    { payment_id: 'real', order_id: 'o1', status: 'pending', reference_number: 'GC1', screenshot_url: 'r2://p' },
    { payment_id: 'alone', order_id: 'o2', status: 'pending', reference_number: null, screenshot_url: null },
    { payment_id: 'ph3', order_id: 'o3', status: 'pending', reference_number: null, screenshot_url: null },
    { payment_id: 'ok3', order_id: 'o3', status: 'matched', reference_number: 'GC9', screenshot_url: null },
  ];
  assert.deepEqual(hidePlaceholdersBesideLogged(rows).map((r) => r.payment_id), ['real', 'alone', 'ok3']);
  assert.match(code('app/admin/payments/page.tsx'), /payments = hidePlaceholdersBesideLogged\(/);
  const pay = code('app/pay/[reference]/actions.ts');
  assert.match(pay, /\.delete\(\)\s*\.eq\('order_id', payable\.orderId\)\s*\.eq\('status', 'pending'\)\s*\.is\('reference_number', null\)\s*\.is\('screenshot_url', null\)/);
  assert.match(pay, /if \(newId\) sweep = sweep\.neq\('payment_id', newId\);/);
});

test('RW-45 · the admin owed figure is the bill — fee plus gift — never the fee alone', () => {
  const page = code('app/admin/booking-fees/page.tsx');
  assert.match(page, /select\('order_id, public_id, service_key, requested_total_php, confirmed_total_php'\)/);
  assert.match(page, /const owedTotal = charges\.reduce\(\(s, c\) => s \+ owedOf\(c\), 0\);/);
  assert.match(page, /hasProof: loggedOrders\.has\(o\.order_id\)/, 'proof is any logged row, never the last one read');
});

test('RW-48 · a bill that is no longer due drops its "up for verification" clause on screen', async () => {
  const { feeOrderDescriptionNow } = await import('./vendor-booking-fees');
  const d = 'Setnayan booking fee (5% to ₱100,000) — up for verification, confirmation within 24 hrs';
  assert.equal(feeOrderDescriptionNow(d, 'paid'), 'Setnayan booking fee (5% to ₱100,000)');
  assert.equal(feeOrderDescriptionNow(d, 'submitted'), d, 'still due: the waiting words are true');
});

test('RW-43 · before Agree, a quote carrying the Setnayan gift says fee + gift = the bill', async () => {
  const { withGiftOnTheBill } = await import('./booking-fee-disclosure');
  const f = withGiftOnTheBill({ tone: 'info', headline: 'Booking fee ₱1,337.50 — payable when they book.', detail: 'Your 2nd booking.' }, 133_750, 48_140);
  assert.match(f.detail, /agreeing bills you ₱1,337\.50 booking fee \+ ₱481\.40 gift = ₱1,818\.90\./);
  const srv = code('lib/booking-fee-disclosure.server.ts');
  assert.match(srv, /standing\.kind === 'billable' &&\s*!standing\.badgeReward/, 'only where a fee is billed');
  assert.match(srv, /quoteSetnayanGift\(admin, \{[\s\S]*?quoteSwitch: null,/, 'the accepted quote’s own switch, priced like the quote screen');
});
