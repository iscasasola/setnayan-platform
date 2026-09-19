/**
 * accepted-quote-terms.test.ts — the requested first payment is shown, is the
 * minimum, and the accepted quote is the one price (2026-09-19).
 *
 * Owner, live as testnayan4 on a booked Band/DJ card: "we have set how much is
 * the downpayment but it did not show. it should follow the amount requested
 * and that means that is the minimum." The quote S89J-EK6NWM69T1 (₱16,750)
 * asked for ₱3,350 on lock; nothing on the couple's card said so.
 *
 * Every property here is EXECUTED against the pure rule the surfaces render
 * from and the action enforces with. The two wiring checks at the end only pin
 * that the action consults that rule before it writes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  acceptedQuoteTerms,
  decideDepositAmount,
  firstPaymentSentence,
  lineItemsPanelLead,
  manualCostingEditorShown,
  paymentScheduleSource,
  supplierFirstPaymentStatus,
  type AcceptedQuoteRow,
} from './accepted-quote-terms';

/** The live quote, as prod holds it (read-only, 2026-09-19). */
const LIVE: AcceptedQuoteRow = {
  public_id: 'S89J-EK6NWM69T1',
  status: 'accepted',
  total_centavos: 1675000,
  line_items: [
    { label: 'Cover Songs', detail: null, amount_centavos: 1500000 },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175000 },
  ],
  payment_schedule: {
    version: 1,
    balances: true,
    installments: [
      { due: 'on_lock', seq: 0, kind: 'percent', label: 'First payment', offset_days: 0, percent_bps: 2000, raw_centavos: 335000, is_downpayment: true, amount_centavos: 335000, is_auto_balance: false, credit_applied_centavos: 0 },
      { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 14, percent_bps: null, raw_centavos: 1340000, is_downpayment: false, amount_centavos: 1340000, is_auto_balance: true, credit_applied_centavos: 0 },
    ],
    base_centavos: 1675000,
    total_centavos: 1675000,
    credit_centavos: 0,
    over_by_centavos: 0,
    credit_over_centavos: 0,
  },
};

test('the live quote yields ₱3,350 on lock, then ₱13,400 fourteen days before the event', () => {
  const t = acceptedQuoteTerms([LIVE], '2026-12-12');
  assert.ok(t);
  assert.equal(t.firstPaymentCentavos, 335000);
  assert.equal(firstPaymentSentence(t), 'First payment requested: ₱3,350 — due on lock');
  assert.equal(t.schedule.length, 2);
  assert.equal(t.schedule[1]!.amountCentavos, 1340000);
  assert.match(t.schedule[1]!.dueText, /^14 days before the event \(Nov 28, 2026\)$/);
  assert.deepEqual(
    t.lines.map((l) => [l.label, l.amountCentavos]),
    [['Cover Songs', 1500000], ['Crew meal', 175000]],
  );
});

test('only an ACCEPTED quote states terms — offers and history do not', () => {
  for (const status of ['draft', 'sent', 'viewed', 'declined', 'expired', 'superseded']) {
    assert.equal(acceptedQuoteTerms([{ ...LIVE, status }]), null, status);
  }
  assert.equal(acceptedQuoteTerms([]), null);
  assert.equal(acceptedQuoteTerms(null), null);
});

test('a quote with no schedule, or a malformed one, requests no minimum and never throws', () => {
  for (const payment_schedule of [{}, null, 'x', { installments: 'no' }, { installments: [] }]) {
    const t = acceptedQuoteTerms([{ ...LIVE, payment_schedule }]);
    assert.ok(t);
    assert.equal(t.firstPaymentCentavos, null);
    assert.equal(firstPaymentSentence(t), null);
  }
});

test('THE ACTION REFUSES A DEPOSIT BELOW THE REQUESTED FIRST PAYMENT', () => {
  const min = acceptedQuoteTerms([LIVE])!.firstPaymentCentavos;
  const below = decideDepositAmount({ amountPhp: 3349.99, minimumCentavos: min, vendorName: 'Saysay' });
  assert.equal(below.ok, false);
  assert.ok(!below.ok && below.message.includes('₱3,350'), 'the refusal names the amount asked for');
  assert.equal(decideDepositAmount({ amountPhp: 1000, minimumCentavos: min }).ok, false);
  // Exactly the minimum, and more, both stand.
  assert.deepEqual(decideDepositAmount({ amountPhp: 3350, minimumCentavos: min }), { ok: true, amountCentavos: 335000 });
  assert.equal(decideDepositAmount({ amountPhp: 16750, minimumCentavos: min }).ok, true);
});

test('no accepted quote keeps today’s rule: any positive amount', () => {
  assert.equal(decideDepositAmount({ amountPhp: 1, minimumCentavos: null }).ok, true);
  assert.equal(decideDepositAmount({ amountPhp: 0, minimumCentavos: null }).ok, false);
  assert.equal(decideDepositAmount({ amountPhp: null, minimumCentavos: null }).ok, false);
  assert.equal(decideDepositAmount({ amountPhp: -5, minimumCentavos: 335000 }).ok, false);
});

test('an accepted marketplace quote removes the manual Costing editor; manual suppliers keep it', () => {
  const t = acceptedQuoteTerms([LIVE]);
  assert.equal(manualCostingEditorShown({ isMarketplaceVendor: true, acceptedQuote: t }), false);
  assert.equal(manualCostingEditorShown({ isMarketplaceVendor: true, acceptedQuote: null }), true);
  assert.equal(manualCostingEditorShown({ isMarketplaceVendor: false, acceptedQuote: null }), true);
});

test('the LINE ITEMS panel never says "hasn’t shared pricing" beside an accepted quote', () => {
  const lines = acceptedQuoteTerms([LIVE])!.lines;
  assert.equal(lineItemsPanelLead({ priceSource: 'pending', hasVendorControlled: false, quoteLines: lines }), 'quote');
  assert.equal(lineItemsPanelLead({ priceSource: 'service', hasVendorControlled: true, quoteLines: lines }), 'quote');
  assert.equal(lineItemsPanelLead({ priceSource: 'pending', hasVendorControlled: false, quoteLines: null }), 'pending');
  assert.equal(lineItemsPanelLead({ priceSource: 'pending', hasVendorControlled: false, quoteLines: [] }), 'pending');
  assert.equal(lineItemsPanelLead({ priceSource: 'package', hasVendorControlled: true, quoteLines: null }), 'catalogue');
  assert.equal(lineItemsPanelLead({ priceSource: 'manual', hasVendorControlled: false, quoteLines: null }), 'none');
});

test('one schedule on screen: a real plan wins, the quote beats nothing and beats an estimate', () => {
  const t = acceptedQuoteTerms([LIVE]);
  assert.equal(paymentScheduleSource({ planStepCount: null, planIsEstimate: false, acceptedQuote: t }), 'quote');
  assert.equal(paymentScheduleSource({ planStepCount: 2, planIsEstimate: true, acceptedQuote: t }), 'quote');
  assert.equal(paymentScheduleSource({ planStepCount: 3, planIsEstimate: false, acceptedQuote: t }), 'plan');
  assert.equal(paymentScheduleSource({ planStepCount: 2, planIsEstimate: true, acceptedQuote: null }), 'plan');
  assert.equal(paymentScheduleSource({ planStepCount: null, planIsEstimate: false, acceptedQuote: null }), 'none');
});

test('the supplier sees the same request, and whether it has been recorded', () => {
  const terms = acceptedQuoteTerms([LIVE]);
  const base = { terms, recordedPhp: null, recordedAt: null, acknowledgedAt: null, declinedAt: null };
  assert.equal(supplierFirstPaymentStatus(base)?.state, 'not_recorded');
  assert.match(supplierFirstPaymentStatus(base)!.line, /₱3,350.*Not recorded/);
  const rec = { ...base, recordedPhp: 3350, recordedAt: '2026-09-19T00:00:00Z' };
  assert.equal(supplierFirstPaymentStatus(rec)?.state, 'recorded');
  assert.equal(supplierFirstPaymentStatus({ ...rec, recordedPhp: 2000 })?.state, 'recorded_short');
  assert.equal(supplierFirstPaymentStatus({ ...rec, acknowledgedAt: '2026-09-20T00:00:00Z' })?.state, 'confirmed');
  assert.equal(supplierFirstPaymentStatus({ ...rec, declinedAt: '2026-09-20T00:00:00Z' })?.state, 'refused');
  // An unreadable ledger never prints ₱0.
  assert.doesNotMatch(supplierFirstPaymentStatus({ ...rec, recordedPhp: null })!.line, /₱0\b/);
  assert.equal(supplierFirstPaymentStatus({ ...base, terms: null }), null);
});

// ── WIRING: the action consults the rule BEFORE it writes ──────────────────
const ACTIONS = stripComments(
  readFileSync(path.join(__dirname, '../app/dashboard/[eventId]/vendors/actions.ts'), 'utf8'),
);

function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = src.indexOf('\nexport ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

test('recordDeposit decides the amount against the quote minimum before any write', () => {
  const body = bodyOf(ACTIONS, 'recordDeposit');
  const decide = body.indexOf('decideDepositAmount(');
  assert.ok(decide > 0, 'recordDeposit must call decideDepositAmount');
  assert.match(body.slice(decide, decide + 200), /minimumCentavos:\s*depositMinimumCentavos/);
  assert.match(body, /depositMinimumCentavos\s*=\s*acceptedQuoteTerms\(/);
  for (const write of ['.update(update)', "from('event_vendor_payments').insert", 'uploadDepositProof(']) {
    const at = body.indexOf(write);
    assert.ok(at > decide, `${write} must come after the amount decision (at ${at}, decision at ${decide})`);
  }
});

test('updateVendorCosts leaves the price columns alone when the quote settles the price', () => {
  const body = bodyOf(ACTIONS, 'updateVendorCosts');
  assert.match(body, /quoteSettlesPrice\s*=\s*!manualCostingEditorShown\(/);
  const payload = body.slice(body.indexOf('const updatePayload'));
  const settledArm = payload.slice(payload.indexOf('quoteSettlesPrice'), payload.indexOf(':', payload.indexOf('}')));
  assert.doesNotMatch(settledArm, /total_cost_php|transport_php|food_allowance_php/);
});
