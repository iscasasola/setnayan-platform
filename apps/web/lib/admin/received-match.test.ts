import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_MATCH_ENABLED,
  candidatesFor,
  lastDropOf,
  ocrDigitFix,
  receivedFor,
  shortReference,
  readReceivedTime,
  readReceivedTranscript,
  referenceNamesTransfer,
  waitingWithoutReceived,
  type WaitingPayment,
} from '@/lib/admin/received-match';

// A received transfer as our BDO app shows it: the long InstaPay record that
// ENDS WITH the payer's invoice number (live shape, 2026-07-31).
const BDO_RECEIVED = [
  'Received',
  'PHP 2,499.00',
  'Reference No. GXCHPHM2XXXB000000006991560',
  'Nov 17, 2026 10:42 AM',
  'From JUAN DELA CRUZ',
].join('\n');

const pay = (over: Partial<WaitingPayment> = {}): WaitingPayment => ({
  payment_id: 'p1',
  amount_php: 2499,
  reference_number: '6991560',
  order_created_at: '2026-11-17T01:00:00.000Z', // 09:00 Manila
  label: 'buyer@example.com',
  ...over,
});

test('phase 1 matches nothing by itself', () => {
  assert.equal(AUTO_MATCH_ENABLED, false);
});

test('a BDO received screenshot becomes one row: long reference, one amount, Manila time', () => {
  const r = readReceivedTranscript(BDO_RECEIVED);
  assert.equal(r.readStatus, 'read');
  assert.equal(r.referenceNorm, 'GXCHPHM2XXXB000000006991560');
  assert.equal(r.amountPhp, 2499);
  assert.equal(r.receivedAt, '2026-11-17T02:42:00.000Z');
});

test('two peso figures is a guess we do not make', () => {
  const r = readReceivedTranscript(`${BDO_RECEIVED}\nAvailable balance PHP 40,120.55`);
  assert.equal(r.amountPhp, null);
  assert.equal(r.readStatus, 'read'); // the reference still read
});

test('the reader sentinels and empty text are unreadable rows, never dropped', () => {
  for (const t of ['NOT_A_RECEIPT', 'UNREADABLE', '', 'hello there']) {
    assert.equal(readReceivedTranscript(t).readStatus, 'unreadable', t);
  }
});

test('the date shapes BDO and phones print', () => {
  assert.equal(readReceivedTime('17 Nov 2026, 22:42'), '2026-11-17T14:42:00.000Z');
  assert.equal(readReceivedTime('11/17/2026 10:42 PM'), '2026-11-17T14:42:00.000Z');
  assert.equal(readReceivedTime('2026-11-17 00:05'), '2026-11-16T16:05:00.000Z');
  assert.equal(readReceivedTime('November 3, 2026 at 12:15 AM'), '2026-11-02T16:15:00.000Z');
  assert.equal(readReceivedTime('no date here 10:42'), null);
});

test('whole reference or the full invoice suffix names the transfer; a short tail does not', () => {
  const norm = 'GXCHPHM2XXXB000000006991560';
  assert.equal(referenceNamesTransfer(norm, '6991560'), true);
  assert.equal(referenceNamesTransfer(norm, norm), true);
  assert.equal(referenceNamesTransfer(norm, '1560'), false);
  assert.equal(referenceNamesTransfer(norm, '699156'), false); // not a suffix
  assert.equal(referenceNamesTransfer(null, '6991560'), false);
});

test('candidates: strong first, a centavo off is a different amount, reasons in plain words', () => {
  const row = readReceivedTranscript(BDO_RECEIVED);
  const rowLike = { reference_norm: row.referenceNorm, amount_php: row.amountPhp, received_at: row.receivedAt };
  const c = candidatesFor(rowLike, [
    pay({ payment_id: 'tail', reference_number: '1560' }),
    pay({ payment_id: 'other-amount', amount_php: 2499.01 }),
    pay({ payment_id: 'strong' }),
  ]);
  assert.deepEqual(c.map((x) => x.payment.payment_id), ['strong', 'other-amount', 'tail']);
  assert.deepEqual(c[1]!.reasons, ['Reference matches', '₱0.01 short']);
  assert.equal(c[1]!.strong, false);
  assert.equal(c[0]!.strong, true);
  assert.deepEqual(c[0]!.reasons, ['Same amount', 'Reference matches']);
  assert.deepEqual(c[2]!.reasons, ['Same amount', 'Ends in 1560']);
  assert.equal(c[2]!.strong, false);
});

test('money that arrived before the order existed is never strong, and says so', () => {
  const c = candidatesFor(
    { reference_norm: 'GXCHPHM2XXXB000000006991560', amount_php: 2499, received_at: '2026-11-16T00:00:00.000Z' },
    [pay()],
  );
  assert.equal(c[0]!.strong, false);
  assert.equal(c[0]!.receivedBeforeOrder, true);
  assert.ok(c[0]!.reasons.includes('Arrived before the order was placed'));
});

test('an unread amount offers reference matches only', () => {
  assert.deepEqual(candidatesFor({ reference_norm: 'X', amount_php: null, received_at: null }, [pay()]), []);
  const c = candidatesFor({ reference_norm: 'GXCHPHM2XXXB000000006991560', amount_php: null, received_at: null }, [pay()]);
  assert.deepEqual(c[0]!.reasons, ['Reference matches']);
  assert.equal(c[0]!.strong, false);
});

test('a reference match with a different amount is listed with what is short, and is never strong', () => {
  const c = candidatesFor(
    { reference_norm: 'GXCHPHM2XXXB000000004880047', amount_php: 2450, received_at: null },
    [
      pay({ payment_id: 'carlo', amount_php: 2500, reference_number: '4880047' }),
      pay({ payment_id: 'ana', amount_php: 2450, reference_number: '7712044' }),
      pay({ payment_id: 'over', amount_php: 2400, reference_number: '4880047' }),
      pay({ payment_id: 'nothing', amount_php: 999, reference_number: '1111111' }),
    ],
  );
  assert.deepEqual(c.map((x) => x.payment.payment_id).sort(), ['ana', 'carlo', 'over']);
  const carlo = c.find((x) => x.payment.payment_id === 'carlo')!;
  assert.deepEqual(carlo.reasons, ['Reference matches', '₱50 short']);
  assert.equal(carlo.diffPhp, -50);
  assert.equal(carlo.strong, false);
  assert.deepEqual(c.find((x) => x.payment.payment_id === 'over')!.reasons, ['Reference matches', '₱50 over']);
  assert.deepEqual(c.find((x) => x.payment.payment_id === 'ana')!.reasons, ['Same amount']);
});

test('the short reference reads as the drawing prints it', () => {
  assert.equal(shortReference('GXCHPHM2XXXB000000006991560'), '…XXXB 000000006991560');
  assert.equal(shortReference('BDO12345'), 'BDO12345');
  assert.equal(shortReference(null), null);
});

test('the last drop is the rows stamped with the newest time', () => {
  assert.deepEqual(
    lastDropOf([{ created_at: '2026-11-17T07:12:00Z' }, { created_at: '2026-11-17T07:12:00Z' }, { created_at: '2026-11-16T01:00:00Z' }]),
    { count: 2, at: '2026-11-17T07:12:00Z' },
  );
  assert.equal(lastDropOf([]), null);
});

test('from the buyer side: same-amount received rows first', () => {
  const rows = [
    { id: 1, reference_norm: 'ZZZ', amount_php: 2499, received_at: null },
    { id: 2, reference_norm: 'GXCHPHM2XXXB000000006991560', amount_php: 2000, received_at: null },
    { id: 3, reference_norm: 'Q', amount_php: 5, received_at: null },
  ];
  assert.deepEqual(receivedFor(pay(), rows).map((x) => x.row.id), [1, 2]);
});

test('buyers who say paid with no received row of their amount', () => {
  const left = waitingWithoutReceived(
    [pay({ payment_id: 'a' }), pay({ payment_id: 'b', amount_php: 147 })],
    [{ reference_norm: null, amount_php: 2499, received_at: null }],
  );
  assert.deepEqual(left.map((p) => p.payment_id), ['b']);
});

test('nothing in this phase writes an automatic match', async () => {
  const { readFileSync } = await import('node:fs');
  const { stripComments } = await import('@/lib/strip-comments');
  const src = stripComments(readFileSync(new URL('../../app/admin/payments/received.ts', import.meta.url), 'utf8'));
  assert.match(src, /match_kind: 'manual'/);
  assert.doesNotMatch(src, /'auto'/, 'an automatic match is written before the BDO pay flow and its hold ship');
  assert.doesNotMatch(src, /\bstrong\b/, 'the save path reads the strong-candidate flag — that is auto-match');
});

test('what the on-phone reader really returned for a drawn BDO screen (2026-11-17)', () => {
  // Tesseract output, verbatim: no space after the comma, one 0 read as O, one digit inserted.
  const r = readReceivedTranscript(
    'BDO Online\nReceived\nPHP 2,499.00\nReference No.\nGXCHPHM2XXXB0O00000006991560\nDate and time\nNov 17,2026 10:42 AM\nFrom\nJUAN DELA CRUZ\n',
  );
  assert.equal(r.amountPhp, 2499);
  assert.equal(r.receivedAt, '2026-11-17T02:42:00.000Z');
  assert.ok(r.referenceNorm!.endsWith('6991560'));
  assert.equal(referenceNamesTransfer(r.referenceNorm, '6991560'), true);
});

test('an O touching a digit is a zero; letters elsewhere stay', () => {
  assert.equal(ocrDigitFix('GXCHB0O0O1'), 'GXCHB00001');
  assert.equal(ocrDigitFix('BOOKING'), 'BOOKING');
});
