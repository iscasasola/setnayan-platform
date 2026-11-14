/**
 * PAY-01 (live walk, 14 Nov 2026) — a quote accepted at "20% on lock, balance 14 days before" froze a
 * 50/50 payment plan. The plan must be the quote's own amounts. Fixture is the live prod shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import { createRequire } from 'node:module';
import { scheduleRowsFromAcceptedQuote } from './accepted-quote-plan';
import { computePlanInstances } from './vendor-service-payment-schedules';

/* ── `server-only` shim (the shape of lib/a-crew-tag-reaches-the-suppliers-day.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_quote_plan__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

const LIVE_QUOTE = {
  version: 1,
  balances: true,
  installments: [
    { due: 'on_lock', seq: 0, kind: 'percent', label: 'First payment', offset_days: 0, percent_bps: 2000, amount_centavos: 535000, is_downpayment: true, is_auto_balance: false },
    { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 14, percent_bps: null, amount_centavos: 2140000, is_downpayment: false, is_auto_balance: true },
  ],
  total_centavos: 2675000,
};

test('the frozen plan carries the quote amounts, not 50/50', () => {
  const rows = scheduleRowsFromAcceptedQuote(LIVE_QUOTE);
  const plan = computePlanInstances({ scheduleRows: rows, totalCostPhp: 26750, lockDateIso: '2026-11-14', eventDateIso: '2027-02-27' });
  assert.deepEqual(plan.map((p) => [p.label, p.amount_php, p.due_date]), [
    ['First payment', 5350, '2026-11-14'],
    ['Final balance', 21400, '2027-02-13'],
  ]);
});

test('no usable quote schedule → nothing, so the caller keeps its own fallback', () => {
  assert.deepEqual(scheduleRowsFromAcceptedQuote({}), []);
  assert.deepEqual(scheduleRowsFromAcceptedQuote(null), []);
  assert.deepEqual(scheduleRowsFromAcceptedQuote({ installments: [] }), []);
});

test('"on the event day" freezes as zero days before', () => {
  const [r] = scheduleRowsFromAcceptedQuote({ installments: [{ seq: 0, due: 'on_event', amount_centavos: 100000, label: 'Day-of' }] });
  assert.ok(r, 'the installment is kept');
  assert.equal(r.due_anchor, 'before_event');
  assert.equal(r.due_offset_days, 0);
});

test('the freeze asks the accepted quote BEFORE it seeds the 50/50 estimate', () => {
  const src = readFileSync(join(__dirname, 'booking-payment-plan.server.ts'), 'utf8');
  const ask = src.indexOf('scheduleRowsFromAcceptedQuote(');
  const seed = src.indexOf('defaultPaymentScheduleRows();');
  assert.ok(ask > 0 && seed > 0 && ask < seed, `quote read ${ask} must precede the estimate ${seed}`);
  assert.match(src.slice(ask - 900, ask), /\.eq\('status', 'accepted'\)/);
});

/**
 * Behaviour, not position: run the real freeze against a fake client holding the live shape — a booking
 * with a total, a service with NO schedule, and an accepted 20% quote — and read what it WRITES.
 */
test('the freeze WRITES the accepted quote amounts and does not mark them an estimate', async () => {
  const { freezePaymentPlanAtBooking } = await import('./booking-payment-plan.server');
  const writes: Array<Record<string, unknown>> = [];
  const tableData: Record<string, unknown> = {
    event_vendors: { total_cost_php: 26750, change_lines: [] },
    events: { event_date: '2027-02-27' },
    vendor_service_payment_schedules: [],
    vendor_proposals: { payment_schedule: LIVE_QUOTE },
    event_vendor_payment_plan: null,
  };
  const builder = (table: string) => {
    const result = { data: tableData[table] ?? null, error: null };
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'is', 'in', 'neq', 'not']) b[m] = () => b;
    b.maybeSingle = async () => result;
    b.single = async () => result;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    b.upsert = (row: Record<string, unknown>) => {
      writes.push({ table, ...row });
      return b;
    };
    b.update = (row: Record<string, unknown>) => {
      writes.push({ table, ...row });
      return b;
    };
    b.insert = b.upsert;
    return b;
  };
  const client = { from: builder } as never;
  await freezePaymentPlanAtBooking(
    client,
    {
      eventId: 'e1',
      vendorId: 'v1',
      booking: { vendor_name: 'Shop', marketplace_vendor_id: 'p1', service_id: 's1' },
      tellUserId: null,
      tag: 'test',
    },
    { emit: async () => {} },
  );
  const plan = writes.find((w) => w.table === 'event_vendor_payment_plan');
  assert.ok(plan, 'a plan was written');
  assert.equal(plan.is_default_seeded, false);
  const amounts = (plan.instances_json as Array<{ amount_php: number | null }>).map((i) => i.amount_php);
  assert.deepEqual(amounts, [5350, 21400]);
});
