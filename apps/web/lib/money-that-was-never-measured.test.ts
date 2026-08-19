/**
 * money-that-was-never-measured.test.ts
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `fetchVendorBudgetSummary` fires three reads. It checked the error on exactly
 * ONE of them — the vendor row — and took `?? []` on the other two. Supabase
 * RESOLVES with `{ error }` rather than throwing, so a refused payments read
 * arrived as `data: null`, became an empty payment list, and:
 *
 *     paidTotal = 0        →  remaining = itemizedTotal   (the FULL amount)
 *
 * A couple who had paid ₱150,000 of ₱200,000 was shown **Paid ₱0** and
 * **Remaining ₱200,000**.
 *
 * 🔑 THIS IS THE WORST SHAPE OF "A FAILED READ RENDERED AS A FACT", because the
 * output is not a missing list — it is a DEMAND. And the two figures are not
 * independent: one refused read moves both, which is why the card hides them
 * together rather than showing a truthful budget beside a fabricated balance.
 *
 * ⚠ `fetchBudgetSnapshot`, three functions down, makes the OPPOSITE choice and
 * is correct: it THROWS on all three read errors. Its summaries are honest by
 * construction, so it sets both flags true. The flags exist for the loader that
 * cannot throw — not to soften the one that does.
 *
 * 🛡 Behaviour tested against a stubbed client; source assertions
 * mutation-checked by occurrence count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVendorBudgetSummary } from '@/lib/budget';
import { stripComments } from '@/lib/strip-comments';

const VENDOR = {
  vendor_id: 'v1',
  public_id: 'S89V-1',
  event_id: 'e1',
  category: 'catering',
  vendor_name: 'Test Caterer',
  status: 'contracted',
  total_cost_php: 200_000,
  deposit_paid_php: 0,
  created_at: '2026-01-01',
};
const PAYMENT = { payment_id: 'p1', event_id: 'e1', vendor_id: 'v1', amount_php: 150_000, paid_at: '2026-02-01' };

/** Per-table stub: every chained filter returns the builder; `then` resolves. */
function stub(byTable: Record<string, { data: unknown; error: unknown }>): SupabaseClient {
  const make = (result: { data: unknown; error: unknown }) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit', 'not']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return b;
  };
  return {
    from: (table: string) => make(byTable[table] ?? { data: [], error: null }),
  } as unknown as SupabaseClient;
}

const OK = {
  event_vendors: { data: VENDOR, error: null },
  event_vendor_line_items: { data: [], error: null },
  event_vendor_payments: { data: [PAYMENT], error: null },
};

test('when payments are REFUSED the money is marked unmeasured', async () => {
  const got = await fetchVendorBudgetSummary(
    stub({
      ...OK,
      event_vendor_payments: {
        data: null,
        error: { message: 'permission denied for table event_vendor_payments', code: '42501' },
      },
    }),
    'e1',
    'v1',
  );
  assert.ok(got, 'the vendor row still read, so a summary still exists');
  assert.equal(got!.paymentsMeasured, false, 'the refusal must be reported');
  assert.equal(got!.lineItemsMeasured, true, 'and must not be blamed on the other read');
});

test('the refusal is INDISTINGUISHABLE by the numbers — the flag is the only tell', async () => {
  const refused = await fetchVendorBudgetSummary(
    stub({ ...OK, event_vendor_payments: { data: null, error: { message: 'denied' } } }),
    'e1',
    'v1',
  );
  const genuinelyUnpaid = await fetchVendorBudgetSummary(
    stub({ ...OK, event_vendor_payments: { data: [], error: null } }),
    'e1',
    'v1',
  );
  assert.equal(refused!.paidTotal, genuinelyUnpaid!.paidTotal, 'both compute ₱0 paid…');
  assert.equal(refused!.remaining, genuinelyUnpaid!.remaining, '…and both bill the full amount');
  assert.notEqual(
    refused!.paymentsMeasured,
    genuinelyUnpaid!.paymentsMeasured,
    'so the flag is the only thing separating "you owe it" from "we do not know"',
  );
});

test('a successful read still computes the real balance', async () => {
  const got = await fetchVendorBudgetSummary(stub(OK), 'e1', 'v1');
  assert.equal(got!.paymentsMeasured, true);
  assert.equal(got!.paidTotal, 150_000);
  assert.equal(got!.remaining, 50_000, 'paid 150k of 200k leaves 50k, not 200k');
});

test('a refused LINE ITEMS read is flagged separately', async () => {
  const got = await fetchVendorBudgetSummary(
    stub({ ...OK, event_vendor_line_items: { data: null, error: { message: 'denied' } } }),
    'e1',
    'v1',
  );
  assert.equal(got!.lineItemsMeasured, false);
  assert.equal(got!.paymentsMeasured, true, 'one refusal must not condemn the other read');
});

// ── the render: the flag has to reach the money ───────────────────────────

const CARD = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'app/dashboard/[eventId]/_components/vendor-itemization-card.tsx',
);
const card = () => stripComments(readFileSync(CARD, 'utf8'));

test('the card never prints a peso figure it did not measure', () => {
  const src = card();
  assert.match(src, /paymentsMeasured \? formatPhp\(paidTotal\) : '—'/, 'Paid must be gated');
  assert.match(src, /paymentsMeasured \? formatPhp\(remaining\) : '—'/, 'Remaining must be gated');
  assert.match(src, /We couldn&rsquo;t load your payments/, 'and the person must be told why');
});

test('the snapshot loader stays honest by throwing, not by flagging', () => {
  const src = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'budget.ts'), 'utf8'),
  );
  const snapshot = src.slice(src.indexOf('export async function fetchBudgetSnapshot'));
  const throws = snapshot.match(/if \(\w+Res\.error\) throw new Error/g) ?? [];
  assert.equal(throws.length, 3, 'all three reads must still fail closed, not degrade');
});
