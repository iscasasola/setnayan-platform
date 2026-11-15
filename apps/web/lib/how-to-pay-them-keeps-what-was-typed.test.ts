/**
 * "HOW TO PAY THEM" KEEPS WHAT WAS TYPED — OR SAYS WHY NOT. (2026-10-29, Booked prototype v4)
 *
 * The record card posts each way as `pay_way_method` / `pay_way_details` / `pay_way_qr`, in order. The save keeps a
 * way exactly as typed, leaves out a row left blank, and REFUSES (with a sentence) a way it cannot keep — a QR that is
 * not this event's own private picture is never silently dropped, or the couple would lose the photo they just added.
 * The older free-text note opens as one "Other" way until the couple replaces it (lose nothing).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  methodForProvider,
  parsePostedPayWays,
  payWaysAsDirectPay,
  payWaysNeeded,
  payWaysSummary,
  planPostsPayments,
  readStoredPayWays,
  waysOrNote,
} from './self-added-pay-ways';

const fd = (rows: Array<[string, string, string]>) => {
  const f = new FormData();
  for (const [m, d, q] of rows) {
    f.append('pay_way_method', m);
    f.append('pay_way_details', d);
    f.append('pay_way_qr', q);
  }
  return f;
};
const ours = (ref: string) => ref.startsWith('r2://setnayan-thread-files/payment-proof/events/E1/');

describe('the save', () => {
  it('keeps every way as typed, in order, and leaves out a blank row', () => {
    const r = parsePostedPayWays(
      fd([
        ['gcash', ' Maria · 0917 555 1234 ', ''],
        ['bank', '', ''],
        ['qrph', '', 'r2://setnayan-thread-files/payment-proof/events/E1/supplier-pay-qr/a.png'],
      ]),
      ours,
    );
    assert.deepEqual(r, {
      ok: true,
      ways: [
        { method: 'gcash', details: 'Maria · 0917 555 1234', qr: null },
        { method: 'qrph', details: null, qr: 'r2://setnayan-thread-files/payment-proof/events/E1/supplier-pay-qr/a.png' },
      ],
    });
  });
  it("refuses a QR that is not this event's own picture — never drops it quietly", () => {
    const r = parsePostedPayWays(fd([['gcash', '', 'r2://setnayan-thread-files/payment-proof/events/OTHER/x.png']]), ours);
    assert.equal(r.ok, false);
  });
  it('refuses a method nobody offered', () => {
    assert.equal(parsePostedPayWays(fd([['bitcoin', 'x', '']]), ours).ok, false);
  });
  it('an emptied list saves as empty', () => {
    assert.deepEqual(parsePostedPayWays(fd([]), ours), { ok: true, ways: [] });
  });
});

describe('the read', () => {
  it('a malformed stored entry is left out, never guessed at', () => {
    assert.deepEqual(readStoredPayWays([{ method: 'gcash', details: 'x' }, { method: 'nope', details: 'y' }, 'junk', { method: 'cash' }]), [
      { method: 'gcash', details: 'x', qr: null },
    ]);
  });
  it('the older note opens as one Other way — only while there are no ways', () => {
    assert.deepEqual(waysOrNote([], 'GCash 0917 555 1234'), [{ method: 'other', details: 'GCash 0917 555 1234', qr: null }]);
    assert.deepEqual(waysOrNote([{ method: 'cash', details: 'on the day', qr: null }], 'old note'), [{ method: 'cash', details: 'on the day', qr: null }]);
    assert.deepEqual(waysOrNote([], '  '), []);
  });
  it('the closed fold names the methods', () => {
    assert.equal(payWaysSummary([{ method: 'gcash' }, { method: 'bank' }]), 'GCash · Bank transfer');
    assert.equal(payWaysSummary([]), null);
  });
});

/**
 * 🏦 THE SUPPLIER'S OWN SHAPE (owner 2026-11-13: "either QR or account type, account name and account number or both").
 * The same field names as `vendor_payment_methods`; a plan with payments needs at least one way. Test values only.
 */
describe('account type · account name · account number', () => {
  const acct = (rows: Array<{ m: string; prov?: string; name?: string; num?: string; q?: string; d?: string }>) => {
    const f = new FormData();
    for (const r of rows) {
      f.append('pay_way_method', r.m);
      f.append('pay_way_details', r.d ?? '');
      f.append('pay_way_qr', r.q ?? '');
      f.append('pay_way_provider', r.prov ?? '');
      f.append('pay_way_account_name', r.name ?? '');
      f.append('pay_way_account_number', r.num ?? '');
    }
    return f;
  };
  it('keeps an account under the supplier’s own field names, a QR alone, and both together', () => {
    const qr = 'r2://setnayan-thread-files/payment-proof/events/E1/supplier-pay-qr/b.png';
    const r = parsePostedPayWays(
      acct([
        { m: 'gcash', prov: 'GCash', name: ' Rosa Dizon ', num: ' 0900 000 0000 ' },
        { m: 'qrph', q: qr },
        { m: 'bank', prov: 'BPI', name: 'Rosa Dizon', num: '0000-0000-00', q: qr },
      ]),
      ours,
    );
    assert.deepEqual(r, {
      ok: true,
      ways: [
        { method: 'gcash', details: null, qr: null, provider: 'GCash', account_name: 'Rosa Dizon', account_number: '0900 000 0000' },
        { method: 'qrph', details: null, qr },
        { method: 'bank', details: null, qr, provider: 'BPI', account_name: 'Rosa Dizon', account_number: '0000-0000-00' },
      ],
    });
    // …and reads back exactly so.
    assert.deepEqual(readStoredPayWays(r.ok ? r.ways : []), r.ok ? r.ways : []);
  });
  it('an account name with no number (and no QR) is refused, never saved as a way to pay', () => {
    const r = parsePostedPayWays(acct([{ m: 'bank', prov: 'BDO', name: 'Rosa Dizon' }]), ours);
    assert.equal(r.ok, false);
  });
  it('an account type nobody offers is not kept', () => {
    const r = parsePostedPayWays(acct([{ m: 'bank', prov: 'Bank of Nowhere', num: '0000' }]), ours);
    assert.deepEqual(r.ok && r.ways[0]?.provider, null);
  });
  it('the method follows the account type', () => {
    assert.equal(methodForProvider('GCash', false), 'gcash');
    assert.equal(methodForProvider('BDO', false), 'bank');
    assert.equal(methodForProvider(null, true), 'qrph');
  });
  it('a plan with a payment needs a way to pay; no plan, no need', () => {
    const plan = new FormData();
    plan.append('plan_label', 'Reservation');
    plan.append('plan_value', '20000');
    plan.append('plan_anchor', '');
    const starter = new FormData();
    starter.append('plan_label', 'Reservation');
    starter.append('plan_value', '');
    starter.append('plan_anchor', '');
    assert.equal(planPostsPayments(plan), true);
    assert.equal(planPostsPayments(starter), false, 'two named, empty starter lines are no plan');
    assert.equal(payWaysNeeded(true, []), true);
    assert.equal(payWaysNeeded(true, [{}]), false);
    assert.equal(payWaysNeeded(false, []), false);
  });
  it('on the record card they read as the shipped direct-pay rows — an account and a QR are two', () => {
    const rows = payWaysAsDirectPay([
      { method: 'bank', details: null, qr: 'r2://x/y.png', qrUrl: 'https://example.test/q.png', provider: 'BPI', account_name: 'Rosa Dizon', account_number: '0000-0000-00' },
      { method: 'other', details: 'Cash on the day', qr: null, qrUrl: null },
    ]);
    assert.deepEqual(
      rows.map((m) => [m.method_type, m.label, m.account_number, m.qr_display_url, m.note]),
      [
        ['bank', 'BPI', '0000-0000-00', null, null],
        ['qr', 'BPI', null, 'https://example.test/q.png', null],
        ['bank', 'Other', null, null, 'Cash on the day'],
      ],
    );
    assert.equal(payWaysSummary([{ method: 'bank', provider: 'BPI' }, { method: 'qrph' }]), 'BPI · InstaPay / QR Ph');
  });
});
