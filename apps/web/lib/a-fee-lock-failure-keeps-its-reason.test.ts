/**
 * a-fee-lock-failure-keeps-its-reason.test.ts — the LOCK half of the booking
 * fee may fail open or fail closed, but it may never fail SILENT
 * (FEE-HONEST, 2026-09-19 · S26 `result-dropped-silently`, money tier).
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * The platform's first real booking completed with `booking_fee_ledger` EMPTY
 * because a fail-open branch returned `skipped` and its reason was thrown away
 * (fixed in #5615). The same file still had four places where a REFUSED read
 * looked exactly like a ruling:
 *
 *   resolveFeeAnchorRowId, booking read ... NULL → verdict said "archived booking
 *                                            or orphaned cascade line"
 *   resolveFeeAnchorRowId, anchor read .... same NULL, same false cause
 *   collectBookingFeeAtLock, order check .. refused read = "no order yet" → a
 *                                            SECOND bill minted (no unique index)
 *   collectBookingFeeAtLock, payer read ... refused read = `no_payer` → ops told
 *                                            "unclaimed supplier profile"
 *
 * Every function here is EXECUTED against a fake client that refuses, and each
 * test asserts BOTH halves: (a) the fallback direction is unchanged (bill
 * nothing, never trap the committed lock) and (b) the reason is recorded.
 * (The three `booking-fee-charge.ts` RPC sites are S34's, PR #5707, with its own
 * test `a-fee-rpc-failure-leaves-a-reason.test.ts` — not duplicated here.)
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { judgeDepositEffects, type DepositEffectsOutcome } from '@/lib/deposit-acknowledged-effects';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim (same as money-reads-are-honest.test.ts) ─────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_fee_lock_reason__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let lock: typeof import('@/lib/booking-fee-lock.server');
before(async () => {
  process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = 'true';
  lock = await import('@/lib/booking-fee-lock.server');
});

type Result = { data: unknown; error: unknown };
type Call = { table: string; op: string; filters: Record<string, unknown> };

/**
 * A fake client whose every answer comes from `answer(call)`. The chain records
 * the table, the operation (select/insert/delete) and every filter, so a test
 * states exactly which read refuses. `logged` captures `logQueryError` output.
 */
function fakeClient(answer: (c: Call) => Result, rpc: (fn: string) => Result = () => ({ data: null, error: null })) {
  const calls: Call[] = [];
  const client = {
    rpc: (fn: string) => Promise.resolve(rpc(fn)),
    from(table: string) {
      const call: Call = { table, op: 'select', filters: {} };
      const chain: Record<string, unknown> = {};
      const settle = () => {
        calls.push(call);
        return Promise.resolve(answer(call));
      };
      for (const m of ['select', 'limit', 'order']) chain[m] = () => chain;
      chain.insert = () => ((call.op = 'insert'), chain);
      chain.delete = () => ((call.op = 'delete'), chain);
      chain.eq = (c: string, v: unknown) => ((call.filters[c] = v), chain);
      chain.is = (c: string, v: unknown) => ((call.filters[c] = v), chain);
      chain.maybeSingle = settle;
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => settle().then(res, rej);
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const REFUSED = (what: string): Result => ({ data: null, error: { code: '42501', message: `permission denied for ${what}` } });
const OK = (data: unknown): Result => ({ data, error: null });

/** Capture console.error (logQueryError's always-on sink) for the duration. */
async function capturingErrors<T>(fn: () => Promise<T>): Promise<{ value: T; logged: string[] }> {
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  try {
    return { value: await fn(), logged };
  } finally {
    console.error = orig;
  }
}

// ── resolveFeeAnchorRowId ────────────────────────────────────────────────────

test('anchor resolver: a REFUSED booking read still bills nothing, and says why', async () => {
  const { client } = fakeClient(() => REFUSED('table event_vendors'));
  const reasons: string[] = [];
  const { value, logged } = await capturingErrors(() =>
    lock.resolveFeeAnchorRowId(client, 'ev-1', (why) => reasons.push(why)),
  );
  assert.equal(value, null, 'direction unchanged: a failed read bills nothing');
  assert.equal(reasons.length, 1, 'the caller must be told the NULL was a refusal');
  assert.match(reasons[0]!, /booking row unreadable: permission denied/);
  assert.ok(
    logged.some((l) => l.includes('resolveFeeAnchorRowId.booking') && l.includes('permission denied')),
    `logQueryError must record the refusal; logged: ${JSON.stringify(logged)}`,
  );
});

test('anchor resolver: a REFUSED anchor lookup bills nothing (never the covered row), and says why', async () => {
  const { client } = fakeClient((c) =>
    typeof c.filters.event_vendor_package_id === 'string'
      ? REFUSED('anchor lookup')
      : OK({ vendor_id: 'ev-cov', package_role: 'covered', event_vendor_package_id: 'pkg-1', archived_at: null }),
  );
  const reasons: string[] = [];
  const { value, logged } = await capturingErrors(() =>
    lock.resolveFeeAnchorRowId(client, 'ev-cov', (why) => reasons.push(why)),
  );
  assert.equal(value, null, 'never falls back to the covered row');
  assert.deepEqual(reasons.map((r) => r.split(':')[0]), ['package anchor unreadable']);
  assert.ok(logged.some((l) => l.includes('resolveFeeAnchorRowId.anchor')), 'the anchor refusal is logged');
});

test('anchor resolver: a genuine "not a sale" NULL does NOT report a refusal', async () => {
  // The control: without it, "the sink fires" could be "the sink always fires".
  const { client } = fakeClient(() =>
    OK({ vendor_id: 'ev-1', package_role: null, event_vendor_package_id: null, archived_at: '2026-09-01' }),
  );
  const reasons: string[] = [];
  const { value, logged } = await capturingErrors(() =>
    lock.resolveFeeAnchorRowId(client, 'ev-1', (why) => reasons.push(why)),
  );
  assert.equal(value, null);
  assert.deepEqual(reasons, []);
  assert.deepEqual(logged, []);
});

// ── collectBookingFeeAtLock ──────────────────────────────────────────────────

const PENDING_CHARGE = () => OK({ charge_id: 'chg-6', status: 'pending', amount_charged_centavos: 250_000, booking_ordinal: 6 });

test('collector: a refused lock-charge RPC fails OPEN with the RPC\'s reason (the #5615 branch)', async () => {
  const { client } = fakeClient(() => OK(null), () => REFUSED('function booking_fee_open_lock_charge'));
  const r = await lock.collectBookingFeeAtLock(client, { eventVendorId: 'ev-1' });
  assert.equal(r.status, 'skipped', 'direction unchanged: never traps the committed lock');
  assert.match((r as { reason: string }).reason, /permission denied for function booking_fee_open_lock_charge/);
});

test('collector: a REFUSED existing-order check mints NO second bill, and says why', async () => {
  const { client, calls } = fakeClient((c) => (c.table === 'orders' ? REFUSED('table orders') : OK(null)), PENDING_CHARGE);
  const r = await lock.collectBookingFeeAtLock(client, { eventVendorId: 'ev-1' });
  assert.equal(r.status, 'skipped');
  assert.match((r as { reason: string }).reason, /existing-order check unreadable: permission denied for table orders/);
  assert.equal(
    calls.filter((c) => c.op === 'insert').length,
    0,
    'an unanswered "is there already a bill?" must never mint one',
  );
});

test('collector: a REFUSED payer read is a SKIP with its reason, never "no_payer"', async () => {
  const { client, calls } = fakeClient((c) => {
    if (c.table === 'orders') return OK(null);
    if (c.table === 'booking_fee_charges') return OK({ event_id: 'e1', vendor_profile_id: 'vp1', gift_credits: 0, gift_centavos: 0 });
    if (c.table === 'vendor_profiles') return REFUSED('table vendor_profiles');
    return OK(null);
  }, PENDING_CHARGE);
  const r = await lock.collectBookingFeeAtLock(client, { eventVendorId: 'ev-1' });
  assert.notEqual(r.status, 'no_payer', '"unclaimed supplier profile" is a false cause for a refused read');
  assert.equal(r.status, 'skipped');
  assert.match((r as { reason: string }).reason, /payer read failed: permission denied for table vendor_profiles/);
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0);
});

test('collector: a genuinely unclaimed profile is STILL no_payer (the control)', async () => {
  const { client } = fakeClient((c) => {
    if (c.table === 'booking_fee_charges') return OK({ event_id: 'e1', vendor_profile_id: 'vp1', gift_credits: 0, gift_centavos: 0 });
    if (c.table === 'vendor_profiles') return OK({ user_id: null });
    return OK(null);
  }, PENDING_CHARGE);
  const r = await lock.collectBookingFeeAtLock(client, { eventVendorId: 'ev-1' });
  assert.equal(r.status, 'no_payer');
});

test('collector: a failed payment insert whose ROLLBACK also fails names the orphaned order', async () => {
  const { client } = fakeClient((c) => {
    if (c.table === 'orders' && c.op === 'insert') return OK({ order_id: 'ord-9' });
    if (c.table === 'orders' && c.op === 'delete') return REFUSED('delete on orders');
    if (c.table === 'orders') return OK(null);
    if (c.table === 'booking_fee_charges') return OK({ event_id: 'e1', vendor_profile_id: 'vp1', gift_credits: 0, gift_centavos: 0 });
    if (c.table === 'vendor_profiles') return OK({ user_id: 'u1' });
    if (c.table === 'payments') return REFUSED('table payments');
    return REFUSED(c.table); // platform_settings → the schedule's own locked fallback
  }, PENDING_CHARGE);
  const r = await lock.collectBookingFeeAtLock(client, { eventVendorId: 'ev-1' });
  assert.equal(r.status, 'skipped');
  const reason = (r as { reason: string }).reason;
  assert.match(reason, /permission denied for table payments/);
  assert.match(reason, /rollback of order ord-9 ALSO failed: permission denied for delete on orders/);
});

// ── the verdict the owner's alarm reads ──────────────────────────────────────

const outcome = (o: Partial<DepositEffectsOutcome>): DepositEffectsOutcome => ({
  door: 'clients_card',
  eventVendorId: 'ev-1',
  eventId: 'e1',
  acknowledged: true,
  anchorId: null,
  feeEnabled: true,
  fee: null,
  pool: null,
  thrown: null,
  ...o,
});

test('verdict: an UNREADABLE money row is never explained as "archived or orphaned"', () => {
  const v = judgeDepositEffects(outcome({ anchorUnreadable: 'booking row unreadable: permission denied' }));
  assert.equal(v.level, 'attention');
  assert.match(v.summary, /money row UNREADABLE \(booking row unreadable: permission denied\)/);
  assert.doesNotMatch(v.summary, /archived booking or orphaned/);
  // Control: a ruled NULL still reads as the ruling.
  assert.match(judgeDepositEffects(outcome({})).summary, /archived booking or orphaned cascade line/);
});

test('the acknowledge effects actually hand the resolver a reason sink', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const src = stripComments(readFileSync(join(HERE, 'deposit-acknowledged-effects.server.ts'), 'utf8'));
  const calls = src.match(/resolveFeeAnchorRowId\(admin,\s*eventVendorId,\s*\(why\)\s*=>\s*\{\s*outcome\.anchorUnreadable\s*=\s*why;/g) ?? [];
  assert.equal(calls.length, 1, `expected the one resolver call to pass the sink; found ${calls.length}`);
});
