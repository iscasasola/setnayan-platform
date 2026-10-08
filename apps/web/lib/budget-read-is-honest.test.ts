/**
 * budget-read-is-honest.test.ts — the MONEY half of "reads are honest".
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `resolveEventMoney` is the one calculator every surface asks for a couple's
 * money. Supabase RESOLVES with `{ error }` instead of throwing, and the
 * resolver turned every refused select into `data ?? []`. So a refused `orders`
 * read — an RLS denial, a phantom column, a statement timeout — arrived as "no
 * orders", and the page then stated it:
 *
 *   summary .......... "Agreed ₱0 · Paid ₱0"
 *   the list ......... an empty "Bought on Setnayan"
 *
 * to a couple who had paid for three things, in output BYTE-IDENTICAL to an
 * event that had bought nothing. The guest list's half of this was closed in
 * `guests-read-is-honest.test.ts` and the supplier dashboard's in
 * `vendor-dashboard/reads-are-honest.test.ts`; this follows the same shape.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The measurement has to travel WITH the
 * figures — `EventMoney.reads` — or nothing the person sees can improve.
 *
 * ── What "must not yield committed = 0" means here ────────────────────────
 * `committed` stays a number (ten callers add it up). What changes is that a
 * refused source is REPORTED, and the one reading a summary is meant to use —
 * `knownMoneyTotals` — answers `null` (unknown), never 0, for any figure the
 * refused source would have been part of.
 *
 * 🛡 Behaviour is driven through the real resolver over a stubbed client — the
 * status is never built by hand, because a guard for a value must drive the
 * thing that COMPUTES it. Each source assertion was sabotaged and seen red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeEventMoney,
  knownMoneyTotals,
  moneyReadsAllOk,
  resolveEventMoney,
  resolveEventMoneySettled,
  MONEY_READS_OK,
} from '@/lib/budget-truth';
import { stripComments } from '@/lib/strip-comments';

type Result = { data: unknown; error: unknown };
const OK_EMPTY: Result = { data: [], error: null };

/**
 * A client whose answer depends on the TABLE asked — which is the whole point:
 * one source refuses while the others answer. Every chained filter returns the
 * same thenable builder.
 */
function stubClient(byTable: Record<string, Result | 'throw'>): SupabaseClient {
  const builderFor = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of [
      'select',
      'eq',
      'neq',
      'is',
      'in',
      'or',
      'not',
      'order',
      'limit',
      'gte',
      'lte',
      'maybeSingle',
      'single',
    ]) {
      builder[m] = () => builder;
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const answer = byTable[table] ?? OK_EMPTY;
      if (answer === 'throw') return Promise.reject(new Error(`network died on ${table}`)).then(resolve, reject);
      return Promise.resolve(answer).then(resolve);
    };
    return builder;
  };
  return { from: (table: string) => builderFor(table) } as unknown as SupabaseClient;
}

/** PostgREST's shape for an RLS / grant refusal: it RESOLVES, with an error. */
const DENIED: Result = { data: null, error: { message: 'permission denied for table', code: '42501' } };

const PAID_ORDER = {
  order_id: 'o1',
  description: 'Event Hub Pro',
  service_key: 'EVENT_HUB_PRO',
  requested_total_php: 2499,
  confirmed_total_php: 2499,
  status: 'paid',
  vendor_profile_id: null,
};
const COST = {
  cost_id: 'c1',
  plan_group_id: null,
  label: 'Church offering',
  amount_php: 15000,
  paid_php: 5000,
  due_date: null,
};
const BOOKED_SUPPLIER = {
  vendor_id: 'v1',
  event_id: 'e1',
  category: 'reception_venue',
  vendor_name: 'Seda Vertis North',
  status: 'contracted',
  total_cost_php: 100000,
  marketplace_vendor_id: null,
  event_vendor_package_id: null,
  archived_at: null,
  voided_by_fraud: false,
  package_role: null,
};

// ── the resolver — a refusal is reported, per source ───────────────────────

test('a REFUSED orders read is reported — it does not become "no orders, ₱0"', async () => {
  const money = await resolveEventMoney(stubClient({ orders: DENIED, event_costs: { data: [COST], error: null } }), 'e1');

  assert.equal(money.reads.orders, 'failed', 'the refusal must be reported, not swallowed');
  assert.equal(money.reads.suppliers, 'ok', 'a source that answered stays answered');
  assert.equal(money.reads.costs, 'ok');
  assert.equal(moneyReadsAllOk(money), false);

  const known = knownMoneyTotals(money);
  assert.equal(known.partial, true);
  assert.equal(known.agreedPhp, null, 'Agreed is UNKNOWN — a sum missing a term — never a number');
  assert.equal(known.paidPhp, null, 'Paid is unknown for the same reason');
  assert.notEqual(known.agreedPhp, 0, 'and in particular it is not ₱0');
  assert.equal(known.owedAtLeastPhp, 10000, 'what IS owed across the answered sources is still said — as a floor');
});

test('a refused orders read on an otherwise EMPTY event still is not committed = 0 as a fact', async () => {
  // The exact case the page used to get wrong: nothing else on the event, so
  // every number is 0 and the only thing that can tell "refused" from "new
  // event" is the status.
  const refused = await resolveEventMoney(stubClient({ orders: DENIED }), 'e1');
  const genuine = await resolveEventMoney(stubClient({}), 'e1');

  assert.equal(refused.committed, genuine.committed, 'the raw figures really are identical…');
  assert.notDeepEqual(refused.reads, genuine.reads, '…so the status is the only thing that can tell them apart');
  assert.equal(knownMoneyTotals(genuine).agreedPhp, 0, 'a real empty ledger is a fact, and may be stated');
  assert.equal(knownMoneyTotals(refused).agreedPhp, null, 'a refused one may not');
});

test('orders that DO arrive are counted, and every read says ok', async () => {
  const money = await resolveEventMoney(stubClient({ orders: { data: [PAID_ORDER], error: null } }), 'e1');
  assert.deepEqual(money.reads, { suppliers: 'ok', orders: 'ok', costs: 'ok' });
  assert.equal(money.committed, 2499);
  assert.equal(knownMoneyTotals(money).agreedPhp, 2499);
  assert.equal(knownMoneyTotals(money).paidPhp, 2499);
});

test('a MISSING orders relation is an answer (no rows can exist), not a refusal', async () => {
  const money = await resolveEventMoney(
    stubClient({ orders: { data: null, error: { message: 'relation "orders" does not exist', code: '42P01' } } }),
    'e1',
  );
  assert.equal(money.reads.orders, 'ok');
});

test('a refused event_costs read fails ITS group only', async () => {
  const money = await resolveEventMoney(stubClient({ event_costs: DENIED, orders: { data: [PAID_ORDER], error: null } }), 'e1');
  assert.deepEqual(money.reads, { suppliers: 'ok', orders: 'ok', costs: 'failed' });
  assert.equal(knownMoneyTotals(money).agreedPhp, null);
});

test('a supplier whose PAYMENTS were refused is withheld — never drawn as "₱0 paid"', async () => {
  const withPayments = await resolveEventMoney(
    stubClient({ event_vendors: { data: [BOOKED_SUPPLIER], error: null } }),
    'e1',
  );
  assert.equal(withPayments.reads.suppliers, 'ok');
  assert.equal(withPayments.committed, 100000, 'the fixture really is a booked ₱100,000 supplier');

  const refused = await resolveEventMoney(
    stubClient({ event_vendors: { data: [BOOKED_SUPPLIER], error: null }, event_vendor_payments: DENIED }),
    'e1',
  );
  assert.equal(refused.reads.suppliers, 'failed', 'one refusal in the supplier set fails the group');
  assert.equal(
    refused.lines.filter((l) => l.vendorId !== null).length,
    0,
    'a supplier line without its payments would read "nothing paid" — a wrong number, so it is not drawn',
  );
});

test('a refused event_vendors read fails the supplier group', async () => {
  const money = await resolveEventMoney(stubClient({ event_vendors: DENIED }), 'e1');
  assert.deepEqual(money.reads, { suppliers: 'failed', orders: 'ok', costs: 'ok' });
});

test('a THROW: the plain resolver still rejects; the settled one reports all three failed', async () => {
  const dead = () => stubClient({ orders: 'throw' });
  await assert.rejects(() => resolveEventMoney(dead(), 'e1'), 'callers that handle a throw themselves keep getting one');
  const money = await resolveEventMoneySettled(dead(), 'e1');
  assert.deepEqual(money.reads, { suppliers: 'failed', orders: 'failed', costs: 'failed' });
  assert.equal(knownMoneyTotals(money).agreedPhp, null);
});

test('the pure core, handed its rows, reports them read', () => {
  const money = computeEventMoney({
    targetCentavos: null,
    vendors: [],
    lineItems: [],
    payments: [],
    orders: [],
    costs: [],
    pricing: new Map(),
    packageLockedCentavos: new Map(),
    benchmarks: [],
  });
  assert.deepEqual(money.reads, MONEY_READS_OK);
});

// ── the source — the swallow cannot come back ──────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const truth = () => stripComments(readFileSync(join(HERE, 'budget-truth.ts'), 'utf8'));

function resolverBody(src: string): string {
  const at = src.indexOf('export async function resolveEventMoney(');
  assert.notEqual(at, -1, 'resolveEventMoney must still exist');
  return src.slice(at, src.indexOf('\nexport async function resolveEventMoneySettled(', at));
}

test('the resolver never turns `data` into `[]` without asking about `error`', () => {
  const body = resolverBody(truth());
  assert.ok(body.length > 500, 'the slice found the resolver');
  assert.equal(
    (body.match(/\.data\s*\?\?\s*\[\]/g) ?? []).length,
    0,
    '`res.data ?? []` is the line that made a refused read look like an empty table — use rowsOrRefused()',
  );
  assert.ok(
    (body.match(/rowsOrRefused</g) ?? []).length >= 6,
    'every list read goes through rowsOrRefused (vendors, line items, payments, orders, costs, benchmarks, packages)',
  );
});

test('the resolver hands the status to the core — computing it and dropping it is the same defect', () => {
  const body = resolverBody(truth());
  const call = body.slice(body.lastIndexOf('computeEventMoney({'));
  assert.match(call, /\n\s*reads,\n/, 'resolveEventMoney must pass `reads` into computeEventMoney');
  assert.match(body, /orders:\s*orderRows\s*!==\s*null\s*\?\s*'ok'\s*:\s*'failed'/, 'orders status comes from the read itself');
  assert.match(body, /costs:\s*costRows\s*!==\s*null\s*\?\s*'ok'\s*:\s*'failed'/, 'costs status comes from the read itself');
});

// ── the page — it asks in the form that says what failed ───────────────────

const page = () =>
  stripComments(readFileSync(join(HERE, '..', 'app/dashboard/[eventId]/budget/page.tsx'), 'utf8'));

test('the budget page asks the resolver in the form that never rejects', () => {
  const src = page();
  assert.match(src, /resolveEventMoneySettled\(supabase, eventId\)/, 'must take the measured, settled read');
  assert.doesNotMatch(
    src,
    /\.catch\(\(\)\s*:\s*EventMoney\s*\|\s*null\s*=>\s*null\)/,
    'a `.catch(() => null)` cannot say WHICH read failed — the page falls back to other arithmetic and paints a tidy wrong number',
  );
  assert.doesNotMatch(src, /\bresolveEventMoney\(supabase/, 'the rejecting form is for callers that do not render this page');
});

test('the budget page does not print totals from a ledger with a refused source', () => {
  const src = page();
  assert.match(
    src,
    /moneyRead !== null && moneyReadsAllOk\(moneyRead\) \? moneyRead : null/,
    'a partial ledger must not reach the figures that assume a whole one',
  );
});
