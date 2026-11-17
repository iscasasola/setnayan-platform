/**
 * Guards for phase 2 of the admin BDO batch match (owner 2026-11-17, specs
 * DECISION_LOG rows "exact matches AUTO-APPROVE", "limits APPROVED, undo 30
 * minutes", "a self-match HOLDS 30 minutes then pays", "leftovers are matched
 * by hand").
 *
 *   1. NOTHING THAT IS NOT AN EXACT MATCH EVER MATCHES BY ITSELF — every near
 *      miss below goes to a person, and a fuzz over the exact pair proves that
 *      changing ANY field of it sends it to a person.
 *   2. UNDO RESTORES THE EARLIER STATE — the hold touches only four fields of
 *      the received row and never the payment, Undo puts exactly those back,
 *      and Undo and the release cannot both win.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import {
  AUTO_MATCH_HOLD_MS,
  HOLD_FIELDS,
  dueCutoffIso,
  fullInvoiceOf,
  holdIsDue,
  holdPatch,
  isWholeReference,
  planAutoMatches,
  undoIsOpen,
  undoPatch,
  type AutoOpenRow,
  type CountedPayment,
} from '@/lib/admin/received-auto-match';
import type { WaitingPayment } from '@/lib/admin/received-match';

const BDO = 'GXCHPHM2XXXB000000006991560';

const row = (over: Partial<AutoOpenRow> = {}): AutoOpenRow => ({
  received_id: 1,
  reference: BDO,
  reference_norm: BDO,
  amount_php: 2499,
  received_at: '2026-11-17T02:42:00.000Z', // 10:42 Manila
  read_status: 'read',
  left_reason: null,
  auto_undone_at: null,
  ...over,
});

const pay = (over: Partial<WaitingPayment> = {}): WaitingPayment => ({
  payment_id: 'p1',
  amount_php: 2499,
  reference_number: '6991560', // the FULL InstaPay invoice, as /pay reads it
  order_created_at: '2026-11-17T01:00:00.000Z', // 09:00 Manila, before the money
  label: 'jose@example.ph',
  ...over,
});

const plan = (open: AutoOpenRow[], waiting: WaitingPayment[], counted: CountedPayment[] = []) =>
  planAutoMatches({ open, waiting, counted });
const reasonOf = (open: AutoOpenRow[], waiting: WaitingPayment[], counted: CountedPayment[] = []) => {
  const p = plan(open, waiting, counted);
  assert.equal(p.holds.length, 0, `expected a person to match it, but it would match by itself: ${JSON.stringify(p.holds)}`);
  return p.hand[0]?.reason;
};

// ── the one shape that matches by itself ────────────────────────────────────

test('ANCHOR — the exact pair (full invoice, same centavos, one payment, after the order) holds', () => {
  assert.deepEqual(plan([row()], [pay()]).holds, [{ received_id: 1, payment_id: 'p1' }]);
  // The whole reference itself, character for character, counts too (ruling 2).
  assert.deepEqual(plan([row()], [pay({ reference_number: BDO.toLowerCase() })]).holds.length, 1);
});

// ── 1 · nothing that is not an exact match ──────────────────────────────────

test('ruling (3): a SHORTER piece of the invoice is never the whole reference', () => {
  assert.equal(fullInvoiceOf(BDO), '6991560');
  assert.equal(isWholeReference(BDO, '6991560'), true);
  assert.equal(isWholeReference(BDO, '991560'), false, 'the old typed "last 6 digits" of a 7-digit invoice');
  assert.equal(isWholeReference(BDO, '1560'), false);
  assert.equal(isWholeReference(BDO, '06991560'), true, 'one more padding zero is still the same invoice');
  assert.equal(isWholeReference(BDO, '106991560'), false, 'a different, longer invoice');
  assert.equal(isWholeReference(BDO, 'XXXB000000006991560'), false, 'a piece of the BDO string is not the whole of it');
  assert.equal(isWholeReference(BDO, null), false);
  assert.equal(isWholeReference(null, '6991560'), false);
  assert.equal(reasonOf([row()], [pay({ reference_number: '991560' })]), 'no_whole_reference');
});

test('amount-only, a centavo off, or an amount not read: a person matches it', () => {
  assert.equal(reasonOf([row()], [pay({ reference_number: 'SOMETHINGELSE1' })]), 'no_whole_reference');
  assert.equal(reasonOf([row()], [pay({ amount_php: 2499.01 })]), 'amount_differs');
  assert.equal(reasonOf([row()], [pay({ amount_php: 2449 })]), 'amount_differs');
  assert.equal(reasonOf([row({ amount_php: null })], [pay()]), 'no_amount');
});

test('2+ candidates: two unpaid payments naming the transfer — at ANY amount — go to a person', () => {
  assert.equal(reasonOf([row()], [pay(), pay({ payment_id: 'p2' })]), 'two_payments_named');
  assert.equal(reasonOf([row()], [pay(), pay({ payment_id: 'p2', amount_php: 147 })]), 'two_payments_named');
  // A second payment of the same AMOUNT but another reference does not block.
  assert.equal(plan([row()], [pay(), pay({ payment_id: 'p2', reference_number: '1234567' })]).holds.length, 1);
});

test('two received screenshots naming one payment: neither matches by itself (exactly ONE)', () => {
  assert.equal(reasonOf([row(), row({ received_id: 2 })], [pay()]), 'payment_claimed_twice');
  // Even when the twin could not have matched (no time read), it still blocks.
  assert.equal(plan([row(), row({ received_id: 2, received_at: null })], [pay()]).holds.length, 0);
  // And an earlier Undo on the twin still counts as a claim.
  assert.equal(plan([row(), row({ received_id: 2, auto_undone_at: '2026-11-17T03:00:00Z' })], [pay()]).holds.length, 0);
});

test('ruling (4): money earlier than the order — or a time we could not read — waits for a person', () => {
  assert.equal(reasonOf([row({ received_at: '2026-11-17T00:59:00.000Z' })], [pay()]), 'before_order');
  assert.equal(reasonOf([row({ received_at: null })], [pay()]), 'no_time');
  assert.equal(reasonOf([row()], [pay({ order_created_at: null })]), 'no_order_time');
});

test('unreadable, not Setnayan, undone before, no reference, or already counted: a person', () => {
  assert.equal(reasonOf([row({ read_status: 'unreadable' })], [pay()]), 'unreadable');
  assert.equal(reasonOf([row({ left_reason: 'not_setnayan' })], [pay()]), 'not_setnayan');
  assert.equal(reasonOf([row({ auto_undone_at: '2026-11-17T03:00:00.000Z' })], [pay()]), 'undone_before');
  assert.equal(reasonOf([row({ reference_norm: null })], [pay()]), 'no_reference');
  assert.equal(
    reasonOf([row()], [pay()], [{ payment_id: 'old', reference_number: '6991560' }]),
    'already_counted',
    'the same screenshot already paid another payment',
  );
  // "Leave for the next drop" is NOT a refusal — it is tried again.
  assert.equal(plan([row({ left_reason: 'later' })], [pay()]).holds.length, 1);
});

test('FUZZ — change any one field of the exact pair and it never matches by itself', () => {
  // Deterministic, so a red run can be replayed.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('');
  const mutations: Array<[string, () => [AutoOpenRow, WaitingPayment]]> = [
    ['amount up', () => [row(), pay({ amount_php: 2499 + Math.ceil(rnd() * 5000) / 100 })]],
    ['amount down', () => [row(), pay({ amount_php: 2499 - Math.ceil(rnd() * 2000) / 100 })]],
    ['received amount', () => [row({ amount_php: 2499 + Math.ceil(rnd() * 900) / 100 }), pay()]],
    ['shorter tail', () => [row(), pay({ reference_number: '6991560'.slice(Math.ceil(rnd() * 6)) })]],
    ['other invoice', () => [row(), pay({ reference_number: `${1 + Math.floor(rnd() * 8)}${digits(6)}` })]],
    ['longer invoice', () => [row(), pay({ reference_number: `${1 + Math.floor(rnd() * 8)}6991560` })]],
    ['earlier money', () => [row({ received_at: new Date(Date.parse('2026-11-17T01:00:00.000Z') - 1 - Math.floor(rnd() * 864e5)).toISOString() }), pay()]],
  ];
  let checked = 0;
  for (let i = 0; i < 60; i += 1) {
    for (const [name, make] of mutations) {
      const [r, p] = make();
      // A mutation that lands back on the exact pair is not a near miss.
      // Independent oracle — NOT isWholeReference, or a loosened rule would excuse itself.
      const exact =
        r.amount_php === 2499 &&
        p.amount_php === 2499 &&
        (p.reference_number === '6991560' || p.reference_number === BDO) &&
        Date.parse(r.received_at!) >= Date.parse(p.order_created_at!);
      if (exact) continue;
      assert.equal(plan([r], [p]).holds.length, 0, `${name}: ${JSON.stringify({ r, p })} matched by itself`);
      checked += 1;
    }
  }
  assert.ok(checked > 300, `only ${checked} near misses were generated — the fuzz checks nothing`);
});

test('the auto path decides ONLY through planAutoMatches, and only from the owner’s own drop', () => {
  const src = stripComments(readFileSync(new URL('../../app/admin/payments/received-auto.ts', import.meta.url), 'utf8'));
  assert.match(src, /planAutoMatches\(/);
  // Ruling (1): buyer photos never approve — no receipt reader, no advisory table.
  assert.doesNotMatch(src, /payment-receipt-read|payment_receipt_reads/);
  // The hold is a write to the received row and NOTHING ELSE: it never touches the payment.
  const hold = src.slice(src.indexOf('export async function holdAutoMatches'), src.indexOf('export async function undoAutoMatch'));
  assert.ok(hold.length > 200, 'holdAutoMatches not found — the scan proves nothing');
  assert.doesNotMatch(hold, /from\('payments'\)\s*\.(update|insert|upsert|delete)/);
  assert.doesNotMatch(hold, /approve\(/, 'a hold must not pay — only the release after 30 minutes does');
  // The hold is written only by the drop, the only caller.
  const recv = stripComments(readFileSync(new URL('../../app/admin/payments/received.ts', import.meta.url), 'utf8'));
  const drop = recv.slice(recv.indexOf('export async function dropReceived'), recv.indexOf('export type ApproveCore'));
  assert.match(drop, /holdAutoMatches\(userId\)/);
});

test('ruling (6): no email — the only notices are the toast and the Focus list', () => {
  for (const f of ['../../app/admin/payments/received-auto.ts', '../../app/admin/payments/_components/received-held.tsx']) {
    const src = stripComments(readFileSync(new URL(f, import.meta.url), 'utf8'));
    assert.doesNotMatch(src, /emitNotification|sendEmail|resend/i, `${f} sends a notice the ruling did not ask for`);
  }
});

// ── 2 · Undo restores the earlier state ─────────────────────────────────────

test('Undo puts back exactly what the hold changed, and the payment was never changed', () => {
  const before = {
    received_id: 9,
    reference: BDO,
    amount_php: 2499,
    left_reason: 'later' as const,
    matched_payment_id: null,
    match_kind: null,
    matched_at: null,
    matched_by: null,
  };
  const held = { ...before, ...holdPatch('p1', 'admin-1', '2026-11-17T03:00:00.000Z') };
  // The hold writes ONLY the four hold fields.
  assert.deepEqual(Object.keys(holdPatch('p1', 'admin-1', 'x')).sort(), [...HOLD_FIELDS].sort());
  const undone = { ...held, ...undoPatch('2026-11-17T03:10:00.000Z') };
  const { auto_undone_at, ...rest } = undone;
  assert.deepEqual(rest, before, 'Undo left the received row different from before the hold');
  assert.equal(auto_undone_at, '2026-11-17T03:10:00.000Z', 'Undo must stamp the row so the next drop does not redo it');
  assert.equal(held.left_reason, 'later', 'a hold must not touch left_reason, or Undo could not restore it');
});

test('the window: Undo strictly inside 30 minutes; the release exactly from 30 minutes; never both', () => {
  const at = '2026-11-17T03:00:00.000Z';
  const t = (ms: number) => new Date(Date.parse(at) + ms);
  assert.equal(AUTO_MATCH_HOLD_MS, 30 * 60 * 1000);
  assert.equal(undoIsOpen(at, t(0)), true);
  assert.equal(undoIsOpen(at, t(AUTO_MATCH_HOLD_MS - 1)), true);
  assert.equal(undoIsOpen(at, t(AUTO_MATCH_HOLD_MS)), false);
  for (const ms of [0, 1, AUTO_MATCH_HOLD_MS - 1, AUTO_MATCH_HOLD_MS, AUTO_MATCH_HOLD_MS + 1, 3 * AUTO_MATCH_HOLD_MS]) {
    assert.notEqual(undoIsOpen(at, t(ms)), holdIsDue(at, t(ms)), `at +${ms} ms Undo and release would both be allowed`);
  }
  // The SQL cut-off draws the same line: due ⇔ matched_at <= cutoff.
  assert.equal(at <= dueCutoffIso(t(AUTO_MATCH_HOLD_MS)), true);
  assert.equal(at <= dueCutoffIso(t(AUTO_MATCH_HOLD_MS - 1)), false);
});

test('Undo and the release are one compare-and-swap on released_at — only one can win', () => {
  const src = stripComments(readFileSync(new URL('../../app/admin/payments/received-auto.ts', import.meta.url), 'utf8'));
  const undo = src.slice(src.indexOf('export async function undoAutoMatch'), src.indexOf('export async function releaseDueHolds'));
  const release = src.slice(src.indexOf('export async function releaseDueHolds'), src.indexOf('async function reopen'));
  assert.ok(undo.length > 200 && release.length > 200, 'functions not found — the scan proves nothing');
  // Undo: only an automatic match, only unreleased, only inside the window.
  assert.match(undo, /\.update\(undoPatch\(/);
  assert.match(undo, /\.eq\('match_kind', 'auto'\)/);
  assert.match(undo, /\.is\('released_at', null\)/);
  assert.match(undo, /\.gt\('matched_at', dueCutoffIso\(now\)\)/);
  assert.match(undo, /changed\.length === 0/, 'Undo must notice when the release won');
  // Release: claims released_at before it pays, and pays only what it claimed.
  const claim = release.indexOf(".update({ released_at: nowIso })");
  const pays = release.indexOf('await approve(');
  assert.ok(claim > 0 && pays > claim, 'the release must claim the row BEFORE it runs the approve');
  assert.match(release.slice(claim, pays), /\.is\('released_at', null\)/);
  assert.match(release.slice(claim, pays), /claimed\.length === 0\) continue/);
  // Undo never touches the payment either.
  assert.doesNotMatch(undo, /from\('payments'\)/);
});

test('an Undo is final: the row goes back to the hand pile and never matches by itself again', () => {
  const undone = row({ auto_undone_at: '2026-11-17T03:10:00.000Z' });
  assert.equal(plan([undone], [pay()]).holds.length, 0);
  assert.deepEqual(plan([undone], [pay()]).hand, [{ received_id: 1, reason: 'undone_before' }]);
});
