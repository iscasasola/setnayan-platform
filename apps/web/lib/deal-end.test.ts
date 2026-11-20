/**
 * 🏁 THE DEAL'S END — the pure rules behind terms at Accept, the receipt, crew for the day, handover and the review
 * (Unichat part H2, 20 Nov 2026). The database side is held by tests/db/the-deals-end-is-said-in-the-chat.db.test.ts.
 * Run from apps/web: tsx --test lib/deal-end.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { dayCrewFromLine, handoverFromLine, receiptFromLine, reviewAskFromLine, streamLineKind, HANDOVER_KIND_WORD } from './chat-card-lines';
import { chatKindOf } from './chat-kinds';
import { paymentLineOf } from './chat-kinds';
import { dayCrew, handoverLink, quoteTermsFromCards, receiptFor, starWords, termsAtAccept, type PaymentRow } from './deal-end';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const policy = (over: Partial<{ cancellation_terms: string | null; downpayment_non_refundable: boolean; refund_window_days: number | null; no_show_forfeit: boolean }> = {}) => ({
  seq: 0,
  label: 'First payment',
  cancellation_terms: null,
  downpayment_non_refundable: false,
  refund_window_days: null,
  no_show_forfeit: false,
  ...over,
});

test('1 · terms: the card’s own words, said once, never invented', () => {
  assert.equal(quoteTermsFromCards([]), '');
  assert.equal(quoteTermsFromCards([{ title: 'Lights', rows: [] }]), '', 'a card with no schedule states no terms');
  assert.equal(quoteTermsFromCards([{ title: 'Lights', rows: [policy()] }]), '', 'a first payment with no policy states no terms');
  const a = policy({ cancellation_terms: '50% back if cancelled 30+ days before', downpayment_non_refundable: true });
  assert.equal(quoteTermsFromCards([{ title: 'Lights', rows: [a] }]), '50% back if cancelled 30+ days before · First payment non-refundable');
  // Two cards that say the same thing: once, with no card name in front.
  assert.equal(quoteTermsFromCards([{ title: 'Lights', rows: [a] }, { title: 'Sound', rows: [a] }]), '50% back if cancelled 30+ days before · First payment non-refundable');
  // Two that differ: each under its own card.
  assert.equal(
    quoteTermsFromCards([{ title: 'Lights', rows: [a] }, { title: 'Sound', rows: [policy({ no_show_forfeit: true })] }, { title: 'Truss', rows: [] }]),
    'Lights: 50% back if cancelled 30+ days before · First payment non-refundable\nSound: no-show forfeits the first payment',
  );
  assert.equal(termsAtAccept({ terms: '  ', supplierName: 'Lumina', status: 'sent' }), null, 'no terms → no line at all');
  assert.deepEqual(termsAtAccept({ terms: 'x', supplierName: 'Lumina', status: 'viewed' }), { agreed: false, words: 'You agree to Lumina’s terms' });
  assert.deepEqual(termsAtAccept({ terms: 'x', supplierName: 'Lumina', status: 'accepted' }), { agreed: true, words: 'You agreed to Lumina’s terms' });
});

test('2 · terms are frozen on the quote at send and drawn beside every Accept', () => {
  const send = src('lib/proposal-send.ts');
  assert.match(send, /rendered_terms: quoteTerms,/, 'a custom quote stores its cards’ terms');
  assert.doesNotMatch(send, /rendered_terms: '',/, 'a custom quote no longer drops its terms');
  assert.match(send, /if \(quoteTerms == null\) \{\s*return \{ ok: false/, 'unread terms stop the send — never sent as "no terms"');
  assert.match(send, /\.eq\('vendor_profile_id', vendorProfileId\)[\s\S]{0,80}\.in\('vendor_service_id', ids\)/, 'only the shop’s own cards are read');
  // The chat: under the hosts' live quote's lines, above its Accept.
  const door = src('app/_components/chat/cards/ask-change-card.tsx');
  assert.match(door, /<QuoteTermsLine proposalId=\{proposalId\} supplierName=\{supplierName\} \/>/);
  const line = src('app/_components/chat/cards/quote-terms-line.tsx');
  assert.match(line, /read\.at === 'failed'[\s\S]{0,200}role="alert"/, 'a refused read is said, never drawn as "no terms"');
  // The full quote page: the Terms section it always had, and the sentence beside Accept.
  const page = src('app/proposals/[publicId]/page.tsx');
  assert.match(page, /proposal\.rendered_terms\.trim\(\) \?[\s\S]{0,200}data-quote-terms-at-accept/);
});

const pay = (over: Partial<PaymentRow>): PaymentRow => ({
  payment_id: 'p',
  amount_php: 9000,
  paid_at: '2026-11-20',
  method: 'GCash',
  reference: null,
  is_deposit_record: false,
  vendor_confirmed_at: '2026-11-20T04:00:00Z',
  payment_refused_at: null,
  ...over,
});

test('3 · the receipt line is the ledger’s, and it finds ONE payment row', () => {
  assert.deepEqual(receiptFromLine('Payment confirmed · ₱9,000'), { first: false, amountWords: '₱9,000' });
  assert.deepEqual(receiptFromLine('First payment confirmed · ₱15,300.50'), { first: true, amountWords: '₱15,300.50' });
  assert.deepEqual(receiptFromLine('Payment recorded · ₱9,000 · GCash · confirmed'), { first: false, amountWords: '₱9,000' });
  assert.deepEqual(receiptFromLine('Payment recorded · ₱9,000 · confirmed'), { first: false, amountWords: '₱9,000' });
  for (const not of ['Payment logged · ₱9,000 · GCash · waiting for the supplier to confirm', 'Payment not received · ₱9,000', 'Payment asked · ₱5,000 · due 12 Dec 2026', 'Payment confirmed', 'Payment confirmed · 9000']) {
    assert.equal(receiptFromLine(not), null, not);
  }
  // Every receipt line is still a payment line to the Money chip.
  assert.equal(paymentLineOf('Payment confirmed · ₱9,000')?.verb, 'confirmed');
  assert.equal(chatKindOf({ sender_role: 'system', body: 'Payment confirmed · ₱9,000' } as Parameters<typeof chatKindOf>[0]), 'money');

  const rows = [
    pay({ payment_id: 'dep', amount_php: '9000.00', is_deposit_record: true, vendor_confirmed_at: '2026-11-18T04:00:00Z', paid_at: '2026-11-17' }),
    pay({ payment_id: 'second', amount_php: 9000, vendor_confirmed_at: '2026-11-20T04:00:00.400Z', reference: ' 7781 ' }),
    pay({ payment_id: 'refused', amount_php: 9000, vendor_confirmed_at: '2026-11-20T04:00:00Z', payment_refused_at: '2026-11-21T00:00:00Z' }),
    pay({ payment_id: 'later', amount_php: 4000, vendor_confirmed_at: '2026-11-25T04:00:00Z' }),
  ];
  const r = receiptFor({ payments: rows, lineAt: '2026-11-20T04:00:00Z', amountWords: '₱9,000', first: false, agreedCentavos: 5_100_000 })!;
  assert.equal(r.paymentId, 'second', 'the same amount as the deposit, but this line is a Payment');
  assert.equal(r.amountCentavos, 900_000);
  assert.equal(r.reference, '7781');
  assert.equal(r.paidCentavos, 1_800_000, 'the deposit and this payment — the refused one and the later one are not in it');
  assert.equal(r.leftCentavos, 3_300_000);
  const dep = receiptFor({ payments: rows, lineAt: '2026-11-18T04:00:00Z', amountWords: '₱9,000', first: true, agreedCentavos: 5_100_000 })!;
  assert.equal(dep.whatFor, 'First payment');
  assert.equal(dep.paidOn, '2026-11-17');
  assert.equal(dep.leftCentavos, 4_200_000, 'an older receipt keeps what was left THEN');
  // No accepted quote → what is left is unknown, never worked out from nothing and never ₱0.
  assert.equal(receiptFor({ payments: rows, lineAt: '2026-11-20T04:00:00Z', amountWords: '₱9,000', first: false, agreedCentavos: null })!.leftCentavos, null);
  assert.equal(receiptFor({ payments: rows, lineAt: '2026-11-20T04:00:00Z', amountWords: '₱9,000', first: false, agreedCentavos: 0 })!.leftCentavos, null);
  // Paid past the total reads as nothing left, never a negative.
  assert.equal(receiptFor({ payments: rows, lineAt: '2026-11-25T04:00:00Z', amountWords: '₱4,000', first: false, agreedCentavos: 1_000_000 })!.leftCentavos, 0);
  // Nothing matches: another amount, or more than a minute away.
  assert.equal(receiptFor({ payments: rows, lineAt: '2026-11-20T04:00:00Z', amountWords: '₱9,001', first: false, agreedCentavos: null }), null);
  assert.equal(receiptFor({ payments: rows, lineAt: '2026-11-20T04:05:00Z', amountWords: '₱9,000', first: false, agreedCentavos: null }), null);
});

test('4 · the receipt card says what it could not read', () => {
  const card = src('app/_components/chat/cards/receipt-card.tsx');
  assert.match(card, /read\.at === 'failed' \? \(\s*<CouldNotLoad what="this receipt"/);
  assert.match(card, /data-receipt-card="not-found"/, 'a payment that is not found is said — no other payment’s figures');
  assert.match(card, /data-receipt-left="unknown"/, 'no accepted quote → "what is left" is not printed as a number');
  assert.doesNotMatch(card, /toLocaleString|toFixed/, 'money goes through the one formatter');
  assert.match(card, /formatCentavosPhp\(r\.amountCentavos\)/, 'the amount shown is the ROW’s, not the line’s words');
  const calls = src('app/_components/chat/cards/deal-end-calls.ts');
  assert.match(calls, /if \(pay\.error \|\| quote\.error\) return refused/, 'a refused quote read is not "no quote"');
  assert.doesNotMatch(calls, /'use server'/, 'browser reads with the reader’s own session — no new route');
});

test('5 · crew for the day: one row per person, roles as written, the earliest call', () => {
  const crew = dayCrew([
    { crew: 'Paolo Cruz', what: 'Sound engineer', call_at: null, moment_start: '2026-12-18T13:00:00Z' },
    { crew: ' Jun Reyes ', what: 'Lights tech', call_at: '2026-12-18T12:00:00Z', moment_start: '2026-12-18T13:00:00Z' },
    { crew: 'jun reyes', what: 'Rigger', call_at: '2026-12-18T12:30:00Z', moment_start: null },
    { crew: 'Jun Reyes', what: 'lights tech', call_at: null, moment_start: '2026-12-18T15:30:00Z' },
    { crew: null, what: 'The shop itself', call_at: '2026-12-18T09:00:00Z', moment_start: null },
    { crew: 'Ben Tan', what: 'Rigger', call_at: null, moment_start: null },
  ]);
  assert.deepEqual(crew.members, [
    { name: 'Jun Reyes', roles: ['Lights tech', 'Rigger'], arriveAt: '2026-12-18T12:00:00Z' },
    { name: 'Paolo Cruz', roles: ['Sound engineer'], arriveAt: '2026-12-18T13:00:00Z' },
    { name: 'Ben Tan', roles: ['Rigger'], arriveAt: null },
  ]);
  assert.equal(crew.firstArrival, '2026-12-18T12:00:00Z');
  assert.deepEqual(dayCrew([]), { members: [], firstArrival: null });
  const card = src('app/_components/chat/cards/crew-day-card.tsx');
  assert.match(card, /read\.at === 'failed' \? \(\s*<CouldNotLoad what="the crew"/);
  assert.match(card, /'Time not set'/, 'a person with no time says so, never a made-up clock');
});

test('6 · handover and review lines, and what the cards may open', () => {
  for (const [kind, word] of Object.entries(HANDOVER_KIND_WORD)) {
    assert.deepEqual(handoverFromLine(`Handover · ${word}`), { kind, received: false });
    assert.deepEqual(handoverFromLine(`Handover · ${word} · Lighting photos · 24`), { kind, received: false });
    assert.deepEqual(handoverFromLine(`Handover received · ${word}`), { kind, received: true });
    assert.equal(streamLineKind(`Handover · ${word}`), 'handover');
  }
  assert.equal(handoverFromLine('Handover · Something else'), null);
  assert.equal(handoverFromLine('Handover'), null);
  assert.equal(reviewAskFromLine('Review asked · how did it go?'), true);
  assert.equal(reviewAskFromLine('Review asked'), false);
  assert.equal(dayCrewFromLine('Crew named for the day'), true);
  assert.equal(streamLineKind('Crew named for the day'), 'crew');
  assert.equal(chatKindOf({ sender_role: 'system', body: 'Handover · Album link' } as Parameters<typeof chatKindOf>[0]), 'files');
  assert.equal(chatKindOf({ sender_role: 'system', body: 'Crew named for the day' } as Parameters<typeof chatKindOf>[0]), 'dates');
  assert.equal(chatKindOf({ sender_role: 'system', body: 'Review asked · how did it go?' } as Parameters<typeof chatKindOf>[0]), 'decisions');

  assert.equal(handoverLink({ kind: 'gallery_link', payload: ' https://photos.example.com/a ' }), 'https://photos.example.com/a');
  assert.equal(handoverLink({ kind: 'gallery_link', payload: 'javascript:alert(1)' }), null, 'only http(s) is ever a link');
  assert.equal(handoverLink({ kind: 'note', payload: 'https://example.com' }), null, 'a note is words, not a door');
  assert.deepEqual(starWords(4), { on: '★★★★', off: '★', label: '4 of 5 stars' });
  assert.deepEqual(starWords(9), { on: '★★★★★', off: '', label: '5 of 5 stars' });

  // RULE 0: the hosts confirm through the shipped action; the review is written on the shipped page.
  const calls = src('app/_components/chat/cards/deal-end-calls.ts');
  assert.match(calls, /await acknowledgeHandover\(fd\)/);
  assert.match(calls, /`\/dashboard\/\$\{t\.event_id\}\/vendors\/\$\{id\}\/review`/);
  const lineCard = src('app/_components/chat/cards/stream-line-card.tsx');
  for (const c of ['<ReceiptCard', '<HandoverCard', '<ReviewAskCard', '<CrewDayCard']) assert.ok(lineCard.includes(c), `${c} is not drawn from its line`);
});

test('7 · the words the database writes are the words the app reads', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271354150744_the_deals_end_is_said_in_the_chat.sql'), 'utf8');
  for (const word of Object.values(HANDOVER_KIND_WORD)) assert.ok(sql.includes(`'${word}'`), `the migration never writes '${word}'`);
  assert.ok(sql.includes("'Review asked · how did it go?'"));
  assert.ok(sql.includes("'Crew named for the day'"));
  assert.ok(sql.includes("'Handover received · '"));
  assert.doesNotMatch(sql, /CREATE TABLE|ADD COLUMN|CREATE POLICY|GRANT /, 'lines only: no table, column, policy or grant');
});
