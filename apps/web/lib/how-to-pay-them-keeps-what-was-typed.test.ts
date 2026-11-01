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
import { parsePostedPayWays, payWaysSummary, readStoredPayWays, waysOrNote } from './self-added-pay-ways';

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
