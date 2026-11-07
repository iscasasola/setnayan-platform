/**
 * "ALREADY PAID" ON THE ADD SHEET IS A LOGGED PAYMENT ON ITS OWN INSTALMENT. (owner 2026-11-07)
 *
 * Owner, verbatim: *"they will list their inclusions and price and payment plan and a check box if something is
 * already paid prior with a screen shot of their payment proof. (optional)."* — and the approved prototype's RULE 0:
 * nothing new is stored; a ticked line is the same `event_vendor_payments` row a later "log a payment" writes.
 *
 * Two halves, both executed:
 *   1. `paidAtAddPayments` — the pure answer to "which instalment, for how much": the rows are numbered exactly as
 *      the saved plan numbers them, and the amount is the SAVED instalment's (a percent resolved by the plan).
 *   2. `addManualSupplier` logs those rows in the workspace's shape — the four columns the prototype names, and no
 *      column `event_vendor_payments` does not already have.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLAN_PAID_FIELD,
  buildCouplePaymentPlan,
  paidAtAddPayments,
  planProofField,
  type CouplePlanRowInput,
} from './self-added-payment-plan';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS = path.resolve(HERE, '..', 'app', 'dashboard', '[eventId]', 'vendors', 'actions.ts');
const ROWS = path.resolve(HERE, '..', 'app', 'dashboard', '[eventId]', '_components', 'payment-plan-rows.tsx');

const plan = (rows: CouplePlanRowInput[], total = 80_000) => {
  const built = buildCouplePaymentPlan({ rows, totalPhp: total, lockDateIso: '2026-11-07', eventDateIso: '2026-12-18' });
  assert.ok(built.ok, 'the sample plan builds');
  return built.instances;
};
const r = (label: string, value: string, amount_kind: 'percent' | 'fixed' = 'fixed'): CouplePlanRowInput => ({
  label,
  amount_kind,
  value,
  due_anchor: 'on_lock',
  due_offset_days: '0',
});

describe('paidAtAddPayments — the ticked lines, as payments on their own instalments', () => {
  it('a ticked line is logged for its saved amount, on its own seq', () => {
    const instances = plan([r('Reservation', '20000'), r('Balance', '60000')]);
    const out = paidAtAddPayments({
      labels: ['Reservation', 'Balance'],
      values: ['20000', '60000'],
      seqs: ['', ''],
      paid: ['1', ''],
      instances,
    });
    assert.deepEqual(out, [{ index: 0, seq: 0, label: 'Reservation', amountPhp: 20_000 }]);
  });

  it('the amount is the plan’s, not the typed figure — a percent resolves against the price', () => {
    const instances = plan([r('Reservation', '25', 'percent'), r('Balance', '75', 'percent')]);
    const out = paidAtAddPayments({ labels: ['Reservation', 'Balance'], values: ['25', '75'], seqs: ['', ''], paid: ['', '1'], instances });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.seq, 1);
    assert.equal(out[0]!.amountPhp, 60_000);
  });

  it('a blank row above does not shift the instalment a ticked line lands on', () => {
    const instances = plan([r('Reservation', '20000'), r('Balance', '60000')]);
    const out = paidAtAddPayments({
      labels: ['', 'Reservation', 'Balance'],
      values: ['', '20000', '60000'],
      seqs: ['', '', ''],
      paid: ['', '', '1'],
      instances,
    });
    assert.deepEqual(out.map((p) => [p.index, p.seq, p.amountPhp]), [[2, 1, 60_000]]);
  });

  it('nothing ticked, or no saved plan → nothing is logged', () => {
    const instances = plan([r('Reservation', '20000'), r('Balance', '60000')]);
    assert.deepEqual(paidAtAddPayments({ labels: ['Reservation'], values: ['20000'], seqs: [''], paid: [''], instances }), []);
    assert.deepEqual(paidAtAddPayments({ labels: ['Reservation'], values: ['20000'], seqs: [''], paid: ['1'], instances: null }), []);
    assert.deepEqual(paidAtAddPayments({ labels: ['Reservation'], values: ['20000'], seqs: [''], paid: ['1'], instances: [] }), []);
  });

  it('the proof field is named by the row’s posted position', () => {
    assert.equal(PLAN_PAID_FIELD, 'plan_paid');
    assert.equal(planProofField(2), 'plan_proof_2');
  });
});

describe('the add logs it the way the workspace logs a payment — no new column', () => {
  const src = readFileSync(ACTIONS, 'utf8');
  const start = src.indexOf('export async function addManualSupplier(');
  const body = src.slice(start, src.indexOf('\nexport ', start + 10));

  it('found addManualSupplier', () => {
    assert.ok(start > 0 && body.length > 1000, 're-point this guard');
  });

  it('reads the ticked lines through paidAtAddPayments and inserts event_vendor_payments rows', () => {
    assert.match(body, /paidAtAddPayments\(/);
    assert.match(body, /from\('event_vendor_payments'\)\s*\.insert\(/);
  });

  it('writes only columns the workspace already writes', () => {
    const i = body.indexOf("from('event_vendor_payments')");
    const insert = body.slice(i, body.indexOf('});', i));
    for (const col of ['amount_php', 'paid_at', 'proof_r2_key', 'schedule_instance_seq']) {
      assert.match(insert, new RegExp(`\\b${col}:`), `${col} is not written`);
    }
    const cols = [...insert.matchAll(/\n\s*([a-z_]+):/g)].map((m) => m[1]);
    const known = new Set(['event_id', 'vendor_id', 'line_item_id', 'amount_php', 'paid_at', 'method', 'reference', 'notes', 'proof_r2_key', 'schedule_instance_seq']);
    assert.deepEqual(cols.filter((c) => !known.has(c!)), [], 'the add writes a column logPayment does not');
  });

  it('the proof goes to the private payment-proof folder, read back under the budget policy', () => {
    assert.match(body, /uploadDepositProof\(/);
    assert.match(body, /budgetPaymentProofPolicy\(/);
  });
});

describe('the plan rows post the tick and its proof', () => {
  const src = readFileSync(ROWS, 'utf8');
  it('posts plan_paid per row and mounts the shipped proof field', () => {
    assert.match(src, /name=\{PLAN_PAID_FIELD\}/);
    assert.match(src, /<ChosenProofField\b[^>]*name=\{planProofField\(/);
    assert.match(src, /Proof of payment \(optional — screenshot\/receipt\)/);
  });
});
