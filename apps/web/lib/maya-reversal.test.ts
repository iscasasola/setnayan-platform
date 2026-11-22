/**
 * 💳 A MAYA-PAID ORDER IS HANDED BACK FROM SETNAYAN, FOR AS LONG AS MAYA ALLOWS IT
 * (owner 2026-11-22 "make it possible to allow refund until maya allow refund" · specs DECISION_LOG 86f20253).
 *
 * Maya is mocked throughout. The cases the build was asked to prove:
 *   void-allowed · refund-allowed · neither · read-failed · success records once ·
 *   a Maya refusal (including the not-switched-on refusal) records nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  decideMayaReversal,
  mayaRefusalLine,
  mayaReversalBody,
  mayaReversalPath,
  readMayaReversal,
  runMayaReversal,
  MAYA_NOT_ENABLED_LINE,
  MAYA_NO_LONGER_LINE,
  MAYA_UNREACHABLE_LINE,
  type MayaReversalDeps,
  type MayaPaymentWithFlags,
} from '@/lib/maya-reversal';
import { postMayaReversal } from '@/lib/maya-api';
import type { MayaConfig } from '@/lib/integration-config';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

// 2026-11-22 10:00 GMT+8 = 02:00 UTC.
const NOW = Date.parse('2026-11-22T02:00:00Z');
const paid = (extra: Partial<MayaPaymentWithFlags> = {}): MayaPaymentWithFlags => ({
  id: 'pay-1',
  status: 'PAYMENT_SUCCESS',
  isPaid: true,
  amount: '2499.00',
  currency: 'PHP',
  ...extra,
});

/** A mocked Maya and a ledger that records only what the caller would record. */
function fakeMaya(opts: {
  payment: MayaPaymentWithFlags | null | 'error' | (() => MayaPaymentWithFlags);
  answers?: Array<{ ok: true } | { ok: false; status: number | null; code: string | null }>;
}) {
  const posts: Array<{ kind: string; amountPhp: number }> = [];
  const answers = [...(opts.answers ?? [{ ok: true as const }])];
  const deps: MayaReversalDeps = {
    fetchPayment: async () => (typeof opts.payment === 'function' ? opts.payment() : opts.payment),
    postReversal: async (input) => {
      posts.push({ kind: input.kind, amountPhp: input.amountPhp });
      return answers.shift() ?? { ok: false, status: 400, code: 'PY0082' };
    },
    now: () => NOW,
  };
  return { deps, posts };
}

// ── The read: what the ONE button says ─────────────────────────────────────────────────────────────────────────────

test('void-allowed: Maya says canVoid → the button is Void, for the whole payment', () => {
  assert.deepEqual(decideMayaReversal(paid({ canVoid: true, canRefund: false }), NOW), { kind: 'void', amountPhp: 2499 });
});

test('refund-allowed: canVoid false, canRefund true → the button is Refund', () => {
  assert.deepEqual(decideMayaReversal(paid({ canVoid: false, canRefund: true }), NOW), { kind: 'refund', amountPhp: 2499 });
});

test('void wins when Maya allows both (a void returns the money the same day)', () => {
  assert.equal(decideMayaReversal(paid({ canVoid: true, canRefund: true }), NOW).kind, 'void');
});

test('neither: Maya says no to both → no button, the one line', () => {
  assert.deepEqual(decideMayaReversal(paid({ canVoid: false, canRefund: false }), NOW), { kind: 'neither' });
  assert.equal(decideMayaReversal(paid({ canVoid: false }), NOW).kind, 'neither', 'one false flag is still Maya answering');
});

test('read-failed: Maya unreachable, unknown payment or a thrown fetch is "error" — never "not refundable"', async () => {
  for (const payment of ['error', null] as const) {
    const { deps } = fakeMaya({ payment });
    assert.deepEqual(await readMayaReversal(deps, 'pay-1'), { kind: 'error' });
  }
  const throwing = {
    fetchPayment: async () => {
      throw new Error('socket');
    },
    now: () => NOW,
  };
  assert.deepEqual(await readMayaReversal(throwing, 'pay-1'), { kind: 'error' });
  assert.notEqual(MAYA_UNREACHABLE_LINE, MAYA_NO_LONGER_LINE);
  assert.match(MAYA_UNREACHABLE_LINE, /Couldn’t reach Maya — try again/);
});

test('an amount Maya did not give, or not PHP, is "error": a full-amount reversal needs the amount', () => {
  assert.equal(decideMayaReversal(paid({ amount: undefined, canVoid: true }), NOW).kind, 'error');
  assert.equal(decideMayaReversal(paid({ currency: 'USD', canVoid: true }), NOW).kind, 'error');
});

test('Maya already shows it VOIDED/REFUNDED → "already" (record it, send nothing again)', () => {
  assert.deepEqual(decideMayaReversal(paid({ status: 'REFUNDED', canRefund: false }), NOW), {
    kind: 'already',
    status: 'REFUNDED',
    amountPhp: 2499,
  });
});

// ── The fallback: no flags → the documented cut-off on Maya's own createdAt ───────────────────────────────────────

test('no flags: same PH day → void; from the next PH midnight → refund; past 180 days → neither', () => {
  // 2026-11-22 00:30 GMT+8 — the same PH day as NOW, though the UTC date is the 21st.
  assert.equal(decideMayaReversal(paid({ createdAt: '2026-11-21T16:30:00Z' }), NOW).kind, 'void');
  // 2026-11-21 23:59 GMT+8 — yesterday in PH: void window closed at midnight.
  assert.equal(decideMayaReversal(paid({ createdAt: '2026-11-21T15:59:00Z' }), NOW).kind, 'refund');
  // 180 PH days back → still refund; 181 → neither.
  const day = 24 * 60 * 60 * 1000;
  assert.equal(decideMayaReversal(paid({ createdAt: new Date(NOW - 180 * day).toISOString() }), NOW).kind, 'refund');
  assert.equal(decideMayaReversal(paid({ createdAt: new Date(NOW - 181 * day).toISOString() }), NOW).kind, 'neither');
});

test('no flags and not a successful payment, or no timestamp → never a button', () => {
  assert.equal(decideMayaReversal(paid({ status: 'PAYMENT_FAILED', createdAt: '2026-11-22T01:00:00Z' }), NOW).kind, 'neither');
  assert.equal(decideMayaReversal(paid({}), NOW).kind, 'error');
});

// ── The press ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('success records once: Maya yes → ok with Maya’s full amount; a second press is refused by Maya → nothing', async () => {
  let state: MayaPaymentWithFlags = paid({ canVoid: true, canRefund: false });
  const { deps, posts } = fakeMaya({
    payment: () => state,
    answers: [{ ok: true }, { ok: false, status: 400, code: 'PY0045' }],
  });
  const recorded: number[] = [];
  const press = async () => {
    const out = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'Couple paid twice through Maya today.' });
    if (out.ok) recorded.push(out.amountPhp);
    return out;
  };
  // Two presses racing: both read "void", both POST; Maya takes the first and refuses the second.
  const [a, b] = await Promise.all([press(), press()]);
  assert.deepEqual(posts, [
    { kind: 'void', amountPhp: 2499 },
    { kind: 'void', amountPhp: 2499 },
  ]);
  assert.equal([a, b].filter((o) => o.ok).length, 1, 'exactly one press may be recorded');
  assert.deepEqual(recorded, [2499]);
  // A later press after Maya voided it posts nothing at all.
  state = paid({ status: 'VOIDED', canVoid: false, canRefund: false });
  const c = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'Couple paid twice through Maya today.' });
  assert.deepEqual(c, { ok: true, kind: 'already', amountPhp: 2499 });
  assert.equal(posts.length, 2, 'Maya was asked again for a payment it already handed back');
});

test('a Maya refusal records nothing — every PY code, said plainly', async () => {
  const cases: Array<[string, RegExp]> = [
    ['PY0045', /can’t be voided/],
    ['PY0073', /void window closed at midnight/],
    ['PY0047', /can’t be refunded/],
    ['PY0048', /more than the payment/],
    ['PY0072', /only from the day after the payment/],
  ];
  for (const [codeName, line] of cases) {
    const { deps } = fakeMaya({
      payment: paid({ canVoid: false, canRefund: true }),
      answers: [{ ok: false, status: codeName === 'PY0047' ? 401 : 400, code: codeName }],
    });
    const out = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'A reason long enough to record.' });
    assert.equal(out.ok, false, `${codeName} was treated as a yes`);
    if (!out.ok) {
      assert.match(out.line, line, codeName);
      assert.match(out.line, /Nothing was recorded\.$/);
    }
  }
});

test('the not-switched-on refusal records nothing and says ask your Maya account manager', async () => {
  for (const answer of [
    { ok: false as const, status: 401, code: 'PY0019' },
    { ok: false as const, status: 403, code: null },
    { ok: false as const, status: 401, code: null },
  ]) {
    const { deps } = fakeMaya({ payment: paid({ canRefund: true, canVoid: false }), answers: [answer] });
    const out = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'A reason long enough to record.' });
    assert.equal(out.ok, false);
    if (!out.ok) assert.ok(out.line.startsWith(MAYA_NOT_ENABLED_LINE), out.line);
  }
  assert.equal(
    MAYA_NOT_ENABLED_LINE,
    'Maya hasn’t switched on refunds through the app for this account — ask your Maya account manager',
  );
});

test('no answer to the POST is not a "no": refresh to see — and nothing is recorded', () => {
  assert.match(mayaRefusalLine({ status: null, code: null }), /refresh the page to see whether it went through\. Nothing was recorded\./);
});

test('neither / read-failed at the press: nothing is sent to Maya', async () => {
  for (const payment of [paid({ canVoid: false, canRefund: false }), 'error' as const]) {
    const { deps, posts } = fakeMaya({ payment });
    const out = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'A reason long enough to record.' });
    assert.equal(out.ok, false);
    assert.equal(posts.length, 0);
  }
});

test('two-admin path: Maya’s amount must equal the approved amount, or nothing is sent', async () => {
  const { deps, posts } = fakeMaya({ payment: paid({ amount: 30000, canRefund: true, canVoid: false }) });
  const out = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'A reason long enough.', expectAmountPhp: 29000 });
  assert.equal(out.ok, false);
  assert.equal(posts.length, 0);
  const ok = await runMayaReversal(deps, { mayaPaymentId: 'pay-1', reason: 'A reason long enough.', expectAmountPhp: 30000 });
  assert.deepEqual(ok, { ok: true, kind: 'refund', amountPhp: 30000 });
});

// ── The wire ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('the POST: secret key, the v2 route, the whole amount; Maya’s PY code is read from its refusal body', async () => {
  const config = {
    checkoutEndpoint: 'https://pg-sandbox.paymaya.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
  } as unknown as MayaConfig;
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const ok = (async (url: string | URL, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(
    await postMayaReversal(config, { mayaPaymentId: 'pay 1', kind: 'refund', amountPhp: 2499, reason: 'Paid twice.' }, ok),
    { ok: true },
  );
  const call = seen[0];
  assert.ok(call, 'Maya was never called');
  assert.equal(call.url, 'https://pg-sandbox.paymaya.com/payments/v2/payments/pay%201/refunds');
  assert.equal(call.init.method, 'POST');
  assert.equal((call.init.headers as Record<string, string>).Authorization, `Basic ${Buffer.from('sk-test:').toString('base64')}`);
  assert.deepEqual(JSON.parse(String(call.init.body)), {
    totalAmount: { amount: '2499.00', currency: 'PHP' },
    reason: 'Paid twice.',
  });
  assert.equal(mayaReversalPath('x', 'void'), '/payments/v2/payments/x/voids');
  assert.deepEqual(mayaReversalBody({ kind: 'void', amountPhp: 2499, reason: ' r ' }), { reason: 'r' });

  const refused = (async () =>
    new Response(JSON.stringify({ code: 'PY0045', message: 'Payment is not available for void' }), { status: 400 })) as unknown as typeof fetch;
  assert.deepEqual(
    await postMayaReversal(config, { mayaPaymentId: 'p', kind: 'void', amountPhp: 1, reason: 'r' }, refused),
    { ok: false, status: 400, code: 'PY0045', message: 'Payment is not available for void' },
  );
});

// ── The action: Maya first, the record only after its yes ───────────────────────────────────────────────────────────

test('refundOrder folds Maya in as an intent (no new action) and records ONLY after Maya’s yes', () => {
  const src = code('app/admin/payments/actions.ts');
  assert.match(src, /if \(intent === 'maya_reverse'\) \{\s*return mayaReverse\(adminUserId, formData\);/);
  const body = src.slice(src.indexOf('async function mayaReverse('), src.indexOf('async function serviceRemedy('));
  assert.ok(body.length > 0, 'mayaReverse moved');
  const refused = body.indexOf('if (!out.ok)');
  const recorded = body.indexOf('await applyRefund(');
  assert.ok(refused > 0 && recorded > refused, 'applyRefund must follow the refusal throw');
  assert.ok(body.indexOf('reverseOnMaya(') < refused, 'Maya must be asked before anything is recorded');
  assert.ok(body.indexOf('openLargeRefundApproval(') < body.indexOf('reverseOnMaya('), 'over ₱25,000 must open the two-admin request before Maya is asked');
  assert.match(body, /mayaPaymentIdForOrder\(admin, orderId\)/, 'the Maya id must come from the order, not the form');
  const large = src.slice(src.indexOf('export async function executeLargeRefund('), src.indexOf('async function openLargeRefundApproval('));
  assert.ok(large.indexOf('reverseOnMaya(') > 0 && large.indexOf('reverseOnMaya(') < large.indexOf('await applyRefund('));
});

test('the desk draws the Maya block for a Maya payment, and the by-hand refund for everything else (BDO unchanged)', () => {
  const desk = code('app/admin/payments/_components/desk.tsx');
  assert.match(desk, /isMayaPayment\(p\.channel\) \? \(\s*<MayaReversalForm/);
  assert.match(desk, /<input type="hidden" name="intent" value="maya_reverse" \/>/);
  assert.match(desk, /read\.kind === 'error' \|\| read\.kind === 'neither'/);
  const page = code('app/admin/payments/page.tsx');
  assert.match(page, /readMayaReversalLive\(opened\.reference_number\)/);
});
