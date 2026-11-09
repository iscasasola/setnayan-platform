/**
 * 📌 The pins' real facts — each kind pins for the right side, in that side's words; money is masked for a reader who
 * may not see it; the blocker is the oldest answerable one. Pure (`lib/chat-pin-facts.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPinFacts, firstBlocker, HOSTS_ONLY, maskPesos, type PinFactInputs } from './chat-pin-facts';
import type { MoneyStep } from './accepted-quote-terms';

const NOW = Date.parse('2026-11-09T10:00:00+08:00');
const base = (over: Partial<PinFactInputs> = {}): PinFactInputs => ({
  side: 'couple',
  themName: 'Lumina',
  supplierName: 'Lumina',
  nowMs: NOW,
  todayPh: '2026-11-09',
  mayReadMoney: true,
  money: null,
  callTime: null,
  accessAsks: null,
  feeBills: null,
  coordinatorAgree: null,
  quote: null,
  decisions: null,
  ...over,
});
const firstDue: MoneyStep = {
  kind: 'first_payment_due',
  action: 'record_deposit',
  label: 'Deposit · books the date',
  amountCentavos: 1_000_000,
  minimumCentavos: null,
  resend: false,
};
const sent: MoneyStep = { kind: 'first_payment_sent', recordedCentavos: 1_000_000 };

test('nothing read → no pins (an empty chat draws no pin)', () => {
  assert.deepEqual(buildPinFacts(base()), []);
});

test('payment due: the host pays (you), the supplier waits (them); the amount is in the line', () => {
  const host = buildPinFacts(base({ money: { step: firstDue, schedule: [] } }));
  assert.equal(host[0]!.kind, 'payment_due');
  assert.equal(host[0]!.answerer, 'you');
  assert.match(host[0]!.title, /₱10,000/);
  const supplier = buildPinFacts(base({ side: 'vendor', money: { step: firstDue, schedule: [] } }));
  assert.equal(supplier[0]!.answerer, 'them');
});

test('🔒 a coordinator without Budget & payments reads "₱ — hosts only", never the figure', () => {
  const masked = buildPinFacts(base({ mayReadMoney: false, money: { step: firstDue, schedule: [] } }));
  assert.ok(!/₱\s?\d/.test(masked[0]!.title), masked[0]!.title);
  assert.ok(masked[0]!.title.includes(HOSTS_ONLY));
  assert.equal(maskPesos('₱1,234.50 and ₱9'), `${HOSTS_ONLY} and ${HOSTS_ONLY}`);
});

test('quote expired: the supplier must act (a blocker); the host reads "Lumina is sending a new one" and waits', () => {
  const q = { proposalId: 'p1', status: 'expired', title: 'Wedding', validUntil: '2026-11-06', updatedAt: null };
  const s = buildPinFacts(base({ side: 'vendor', quote: q }));
  assert.equal(s[0]!.answerer, 'you');
  assert.match(s[0]!.title, /Your quotation expired · valid until Nov 6, 2026/);
  assert.equal(firstBlocker(s, { nowMs: NOW }, ['quote_expired'])?.key, 'quote_expired:p1');
  const h = buildPinFacts(base({ quote: q }));
  assert.equal(h[0]!.title, 'Quotation expired · Lumina is sending a new one');
  assert.equal(h[0]!.answerer, 'them');
  assert.equal(buildPinFacts(base({ quote: { ...q, status: 'accepted' } })).length, 0, 'accepted never expires');
});

test('call time unset: only when booked and none set; a blocker within 7 days, due before that', () => {
  assert.equal(buildPinFacts(base({ side: 'vendor', callTime: { at: '2027-02-14T08:00:00Z' } })).length, 0);
  const f = buildPinFacts(base({ side: 'vendor', callTime: { at: null } }));
  assert.equal(f[0]!.kind, 'call_time');
  assert.equal(firstBlocker(f, { nowMs: NOW, eventDate: '2026-11-14' }, ['call_time'])?.kind, 'call_time');
  assert.equal(firstBlocker(f, { nowMs: NOW, eventDate: '2027-02-14' }, ['call_time']), null, 'far off: due, not blocking');
});

test('booking fee: the supplier only, and only once overdue', () => {
  const bills = [
    { orderId: 'o1', amountPhp: 500, dueOn: '2026-11-08' },
    { orderId: 'o2', amountPhp: 500, dueOn: '2026-11-12' },
  ];
  const s = buildPinFacts(base({ side: 'vendor', feeBills: bills }));
  assert.deepEqual(s.map((x) => x.key), ['booking_fee:o1']);
  assert.match(s[0]!.title, /₱500/);
  assert.equal(buildPinFacts(base({ feeBills: bills })).length, 0, 'never on the host side');
});

test('coordinator Agree pins only once a payment is on record without it ("Agree at proof")', () => {
  assert.equal(buildPinFacts(base({ coordinatorAgree: { since: null }, money: { step: firstDue, schedule: [] } })).filter((f) => f.kind === 'coordinator_agree').length, 0);
  const h = buildPinFacts(base({ coordinatorAgree: { since: null }, money: { step: sent, schedule: [] } }));
  const agree = h.find((f) => f.kind === 'coordinator_agree')!;
  assert.equal(agree.answerer, 'you');
  assert.equal(firstBlocker(h, { nowMs: NOW }, ['coordinator_agree'])?.kind, 'coordinator_agree');
  assert.equal(buildPinFacts(base({ side: 'vendor', coordinatorAgree: { since: null }, money: { step: sent, schedule: [] } })).find((f) => f.kind === 'coordinator_agree')!.answerer, 'them');
});

test('access ask: the host answers, the supplier waits; an open decision pins for both', () => {
  const a = [{ requestId: 'r1', createdAt: '2026-11-08T00:00:00Z' }];
  assert.equal(buildPinFacts(base({ accessAsks: a }))[0]!.answerer, 'you');
  assert.equal(buildPinFacts(base({ side: 'vendor', accessAsks: a }))[0]!.answerer, 'them');
  const d = buildPinFacts(base({ decisions: [{ topicId: 't1', title: 'Venue', openedAt: '2026-11-07T00:00:00Z' }] }));
  assert.deepEqual([d[0]!.kind, d[0]!.key, d[0]!.title], ['decision', 'decision:t1', 'Venue']);
});

test('firstBlocker only names a kind the page can answer', () => {
  const q = { proposalId: 'p1', status: 'expired', title: 'W', validUntil: null, updatedAt: null };
  const s = buildPinFacts(base({ side: 'vendor', quote: q }));
  assert.equal(firstBlocker(s, { nowMs: NOW }, ['booking_fee']), null);
});

test('✋ a change the other side asked for pins for THIS reader to answer, keyed adjustment:<id> (the server-side count key)', () => {
  const changes = [{ amendmentId: 'a1', createdAt: '2026-11-08T00:00:00Z', deltaPhp: 4500 }];
  const host = buildPinFacts(base({ changes }));
  assert.deepEqual([host[0]!.kind, host[0]!.key, host[0]!.answerer], ['change_approval', 'adjustment:a1', 'you']);
  assert.match(host[0]!.title, /^Lumina asked for a change · \+₱4,500$/);
  const shop = buildPinFacts(base({ side: 'vendor', changes: [{ ...changes[0]!, deltaPhp: -1000 }] }));
  assert.match(shop[0]!.title, /^They asked for a change · −₱1,000$/);
  assert.equal(buildPinFacts(base({ changes: [{ ...changes[0]!, deltaPhp: null }] }))[0]!.title, 'Lumina asked for a change');
  // 🔒 the coordinator reads the change, never its figure.
  const masked = buildPinFacts(base({ mayReadMoney: false, changes }));
  assert.ok(!/₱\s?\d/.test(masked[0]!.title) && masked[0]!.title.includes(HOSTS_ONLY), masked[0]!.title);
  assert.equal(firstBlocker(host, { nowMs: NOW, eventDate: '2026-11-12' }, ['change_approval'])?.key, 'adjustment:a1');
});

test('maskPesos also masks a "PHP" figure, and is idempotent', () => {
  assert.equal(maskPesos('PHP 12,500.50 or php-300'), `${HOSTS_ONLY} or ${HOSTS_ONLY}`);
  assert.equal(maskPesos(maskPesos('₱5,000')), HOSTS_ONLY);
  assert.equal(maskPesos('Room 1,200 sqm'), 'Room 1,200 sqm');
});
