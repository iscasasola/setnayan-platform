/**
 * Booking-fee LOCK collection — the APP-LAYER POST-CONDITIONS of the REAL
 * `collectBookingFeeAtLock` (lib/booking-fee-lock.server.ts), driven against the
 * REAL replayed schema in PGlite.
 *
 * ── EVERY ASSERTION IN THIS FILE IS A POSITIVE POST-CONDITION ───────────────
 * A ROW EXISTS WITH THE RIGHT VALUES — never merely that the call returned
 * without an error. That sentence is the whole reason this file exists.
 * `collectBookingFeeAtLock`'s signature failure mode is SUCCEEDING WHILE DOING
 * NOTHING: five of its arms (`disabled`, `skipped`, `free`, `zero_fee`,
 * `no_payer`) return a non-error status and write no money row at all, and two
 * more (`order_exists`, the payments-insert rollback) are about rows that must
 * NOT be duplicated or must be UN-written. A test that asserted "no throw"
 * would pass against a function whose body was deleted.
 *
 * ── A RED TEST HERE IS A FINDING, NOT A CHORE ───────────────────────────────
 * The vendor booking fee is ARMED in production. This is the code that turns a
 * computed charge into money a vendor actually sees: an `orders` row on the
 * manual GCash/BDO QR rail plus its `payments` row, which is what puts the bill
 * in /admin/payments for reconciliation. If a test in this file goes red, the
 * first hypothesis is that the MONEY PATH IS WRONG — not that the test is
 * flaky. Do not "fix" a test here to make the suite green; read the assertion,
 * reproduce the scenario, and report the defect.
 *
 * ── WHY THE REAL FUNCTION AND NOT A RE-IMPLEMENTATION ───────────────────────
 * The SQL half is already covered end-to-end (booking-fee-lock.db.test.ts: the
 * taper, the free-5 boundary, idempotent re-lock, off-platform, non-contracted,
 * the settle bridge, sourced-set parity). What was NOT covered is the TS half —
 * the payer resolution, the order shape, the payment link, and the
 * compensating delete. booking-fee-rederive.db.test.ts even hand-mints the
 * order the TS "would" write (`seedOrder`), which tests the hand-mint, not the
 * code. So this file imports the production module and calls it, through a
 * supabase-js-shaped adapter over PGlite that returns errors as DATA (exactly
 * like supabase-js), because the rollback arm only runs when an insert error is
 * RETURNED rather than thrown.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp } from '../../lib/booking-fee';
import { bookingFeeLockServiceKey } from '../../lib/booking-fee-lock';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * lib/booking-fee-lock.server.ts opens with `import 'server-only'`, a module
 * Next.js supplies to the bundler and which does not exist in node_modules, so
 * a plain import of the production file dies with MODULE_NOT_FOUND before a
 * single assertion runs. The import is a BUNDLER ASSERTION ("never ship me to a
 * client"), carries no runtime behaviour, and lib/live-studio-channel-pool.test
 * already guards its presence textually — so resolving it to an empty module is
 * faithful, not a shortcut. Registered here (module scope) so it is in place
 * before the dynamic import in before(); a static import would be hoisted above
 * it and defeat the point. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub__.js');
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

type CollectResult = Awaited<
  ReturnType<typeof import('../../lib/booking-fee-lock.server').collectBookingFeeAtLock>
>;
let collectBookingFeeAtLock: typeof import('../../lib/booking-fee-lock.server').collectBookingFeeAtLock;

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;

/* ── A supabase-js-shaped adapter over PGlite ────────────────────────────────
 * Models EXACTLY the call shapes lib/booking-fee-lock.server.ts uses:
 *   .rpc(fn, namedArgs)
 *   .from(t).select(cols).eq(...)[.limit(n)].maybeSingle()
 *   .from(t).insert(row).select(cols).maybeSingle()
 *   await .from(t).insert(row)
 *   await .from(t).delete().eq(...)
 * Anything else throws loudly rather than silently skipping the call.
 *
 * THE FIDELITY THAT MATTERS: errors are RETURNED as `{ data, error }`, never
 * thrown. The order-rollback arm is reached only via `if (pErr)` — an adapter
 * that threw would abort the function before the compensating delete and make
 * the rollback untestable while looking like a crash.
 */
type PgError = { message: string } | null;
type Row = Record<string, unknown>;

function assertModelled(ok: boolean, what: string): asserts ok {
  if (!ok) {
    throw new Error(
      `[booking-fee adapter] unsupported call shape: ${what}. This adapter models only what ` +
        'lib/booking-fee-lock.server.ts uses — extend it rather than letting the test skip the call.',
    );
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/i;

class Query implements PromiseLike<{ data: Row[] | null; error: PgError }> {
  private eqs: Array<[string, unknown]> = [];
  private limitN: number | null = null;
  private projection: string | null;

  constructor(
    private readonly pg: PGlite,
    private readonly table: string,
    private readonly op: 'select' | 'insert' | 'delete',
    projection: string | null,
    private readonly payload: Row | null,
  ) {
    this.projection = projection;
  }

  eq(column: string, value: unknown): this {
    assertModelled(this.op !== 'insert', `.eq() on an insert into ${this.table}`);
    this.eqs.push([column, value]);
    return this;
  }

  limit(n: number): this {
    assertModelled(this.op === 'select', `.limit() on a ${this.op} of ${this.table}`);
    this.limitN = n;
    return this;
  }

  /** Post-insert `.select(cols)` → RETURNING cols. */
  select(cols: string): this {
    assertModelled(this.op === 'insert', `.select() chained onto a ${this.op}`);
    this.projection = cols;
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: PgError }> {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    return { data: data && data.length > 0 ? data[0]! : null, error: null };
  }

  private cols(): string {
    if (!this.projection || this.projection.trim() === '*') return '*';
    return this.projection
      .split(',')
      .map((c) => `"${c.trim()}"`)
      .join(', ');
  }

  private async run(): Promise<{ data: Row[] | null; error: PgError }> {
    const params: unknown[] = [];
    const where = () => {
      if (this.eqs.length === 0) return '';
      const parts = this.eqs.map(([c, v]) => {
        params.push(v);
        return `"${c}" = $${params.length}`;
      });
      return ` WHERE ${parts.join(' AND ')}`;
    };

    let sql: string;
    if (this.op === 'select') {
      sql =
        `SELECT ${this.cols()} FROM public."${this.table}"` +
        where() +
        (this.limitN === null ? '' : ` LIMIT ${Number(this.limitN)}`);
    } else if (this.op === 'delete') {
      sql = `DELETE FROM public."${this.table}"` + where();
    } else {
      const entries = Object.entries(this.payload ?? {});
      assertModelled(entries.length > 0, `.insert({}) into ${this.table}`);
      const names = entries.map(([c]) => `"${c}"`).join(', ');
      const values = entries
        .map(([, v]) => {
          params.push(v);
          return `$${params.length}`;
        })
        .join(', ');
      sql =
        `INSERT INTO public."${this.table}" (${names}) VALUES (${values})` +
        (this.projection ? ` RETURNING ${this.cols()}` : '');
    }

    try {
      const res = await this.pg.query(sql, params);
      // supabase-js: an insert with no .select() resolves with data === null.
      if (this.op === 'insert' && !this.projection) return { data: null, error: null };
      return { data: (res.rows ?? []) as Row[], error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }

  then<T1 = { data: Row[] | null; error: PgError }, T2 = never>(
    onfulfilled?: ((v: { data: Row[] | null; error: PgError }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

function makeAdminClient(pg: PGlite): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: (cols = '*') => new Query(pg, table, 'select', cols, null),
        insert: (payload: Row) => new Query(pg, table, 'insert', null, payload),
        delete: () => new Query(pg, table, 'delete', null, null),
      };
    },
    async rpc(fn: string, params: Record<string, unknown>) {
      assertModelled(IDENT.test(fn), `rpc name ${fn}`);
      const keys = Object.keys(params);
      for (const k of keys) assertModelled(IDENT.test(k), `rpc arg name ${k}`);
      const sql =
        `SELECT public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS result`;
      try {
        const res = await pg.query<{ result: unknown }>(sql, keys.map((k) => params[k]));
        return { data: res.rows[0]?.result ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },
  } as unknown as SupabaseClient;
}

/* ── Fixtures (same shapes as booking-fee-lock.db.test.ts) ───────────────────*/

/** A VERIFIED, CLAIMED vendor identity — `userId` is the payer the order must name. */
async function newVendor(email: string): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Postcondition Vendor', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

/** A VERIFIED but UNCLAIMED (admin-owned) vendor profile — `user_id IS NULL`. */
async function newUnclaimedVendor(): Promise<string> {
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES (NULL, 'Unclaimed Vendor', 'Cebu', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
  );
  return v.rows[0]!.vendor_profile_id;
}

/** A couple account, so "the payer is the VENDOR, not the couple" is a real contrast. */
async function newCoupleUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newEvent(name: string, coupleUserId?: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  const eventId = r.rows[0]!.event_id;
  if (coupleUserId) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1, $2, 'couple')`,
      [eventId, coupleUserId],
    );
  }
  return eventId;
}

/** Stamp the marketplace thread that makes a (event, vendor) pair SETNAYAN-SOURCED. */
async function markSourced(eventId: string, vendorProfileId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, 'explore')`,
    [eventId, vendorProfileId],
  );
}

async function newContractedBooking(
  eventId: string,
  vendorProfileId: string | null,
  totalCostPhp: number | null,
  opts: { sourced?: boolean; packageRole?: 'anchor' | 'covered'; packageBookingId?: string } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id,
        package_role, event_vendor_package_id)
     VALUES ($1, 'photographer', 'Postcondition Vendor', 'contracted', $2, $3, $4, $5)
     RETURNING vendor_id`,
    [eventId, totalCostPhp, vendorProfileId, opts.packageRole ?? null, opts.packageBookingId ?? null],
  );
  if (vendorProfileId && opts.sourced !== false) await markSourced(eventId, vendorProfileId);
  return r.rows[0]!.vendor_id;
}

/** Open a charge straight through the SQL RPC — used only to burn free-5 slots. */
async function openLockChargeRaw(eventVendorId: string): Promise<void> {
  await db.query(`SELECT public.booking_fee_open_lock_charge($1)`, [eventVendorId]);
}

/** Burn the vendor's five free bookings so the NEXT booking is billable. */
async function warmPastFree5(vendorProfileId: string, label: string): Promise<void> {
  for (let i = 1; i <= 5; i += 1) {
    const eventId = await newEvent(`${label}-warm-${i}`);
    const evId = await newContractedBooking(eventId, vendorProfileId, 10_000);
    await openLockChargeRaw(evId);
  }
}

/**
 * Call the REAL production function as the REAL caller identity. The docblock
 * on collectBookingFeeAtLock says it MUST run on the service-role client, and
 * `guard_money_row_insert_caller` (SEC-4b) is a deny-list on current_user — so
 * running the writes as `service_role` proves the sanctioned caller can
 * actually mint these rows, rather than proving only that a superuser can.
 */
async function collect(eventVendorId: string): Promise<CollectResult> {
  await db.exec('SET ROLE service_role');
  try {
    return await collectBookingFeeAtLock(admin, { eventVendorId });
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
  }
}

/* ── Post-condition readers ──────────────────────────────────────────────────*/

type OrderRow = {
  order_id: string;
  event_id: string | null;
  user_id: string;
  vendor_profile_id: string | null;
  service_key: string | null;
  description: string;
  requested_total_php: string;
  status: string;
  reference_code: string | null;
};

async function ordersForCharge(chargeId: string): Promise<OrderRow[]> {
  const r = await db.query<OrderRow>(
    `SELECT order_id, event_id, user_id, vendor_profile_id, service_key, description,
            requested_total_php, status::text AS status, reference_code
       FROM public.orders WHERE service_key = $1 ORDER BY created_at`,
    [bookingFeeLockServiceKey(chargeId)],
  );
  return r.rows;
}

type PaymentRow = {
  payment_id: string;
  order_id: string;
  user_id: string;
  amount_php: string;
  channel: string;
  status: string;
};

/** Payments reached ONLY by joining through the order — the link is the assertion. */
async function paymentsLinkedToChargeOrder(chargeId: string): Promise<PaymentRow[]> {
  const r = await db.query<PaymentRow>(
    `SELECT p.payment_id, p.order_id, p.user_id, p.amount_php, p.channel, p.status::text AS status
       FROM public.payments p
       JOIN public.orders o ON o.order_id = p.order_id
      WHERE o.service_key = $1
      ORDER BY p.created_at`,
    [bookingFeeLockServiceKey(chargeId)],
  );
  return r.rows;
}

type ChargeRow = { charge_id: string; status: string; amount: number; fee: number };

async function chargesFor(eventVendorId: string): Promise<ChargeRow[]> {
  const r = await db.query<{
    charge_id: string;
    status: string;
    amount_charged_centavos: string;
    computed_fee_centavos: string;
  }>(
    `SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
       FROM public.booking_fee_charges WHERE event_vendor_id = $1 ORDER BY created_at`,
    [eventVendorId],
  );
  return r.rows.map((x) => ({
    charge_id: x.charge_id,
    status: x.status,
    amount: Number(x.amount_charged_centavos),
    fee: Number(x.computed_fee_centavos),
  }));
}

/**
 * GLOBAL money-row census. The "wrote nothing" arms need a whole-table
 * assertion: a `payments` row carries no service_key, so "no payment for this
 * charge" can only be proved by showing NO payment appeared anywhere.
 */
async function moneyRowCensus(): Promise<{ orders: number; payments: number }> {
  const r = await db.query<{ o: number; p: number }>(
    `SELECT (SELECT count(*) FROM public.orders)::int AS o,
            (SELECT count(*) FROM public.payments)::int AS p`,
  );
  return { orders: r.rows[0]!.o, payments: r.rows[0]!.p };
}

async function assertWroteNoMoneyRows(
  before: { orders: number; payments: number },
  what: string,
): Promise<void> {
  const now = await moneyRowCensus();
  assert.equal(now.orders, before.orders, `${what} must create NO orders row`);
  assert.equal(now.payments, before.payments, `${what} must create NO payments row`);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  ({ collectBookingFeeAtLock } = await import('../../lib/booking-fee-lock.server'));
  // The fee is ARMED in production; these tests exercise the armed path. The
  // flag-OFF no-op has its own test, which unsets and restores this.
  process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = 'true';
});

after(async () => {
  delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  await db?.close();
});

/* ── META — the harness is not green for the wrong reason ───────────────────*/

test('META: the adapter drives the REAL production function, and errors are DATA', async () => {
  // (a) It really is the shipped module, not a local copy.
  const mod = await import('../../lib/booking-fee-lock.server');
  assert.equal(collectBookingFeeAtLock, mod.collectBookingFeeAtLock);

  // (b) A failing statement must come back as `{ error }`, never as a throw —
  // the rollback arm of the production code is only reachable that way.
  const bad = await admin.from('orders').select('no_such_column').eq('order_id', null).maybeSingle();
  assert.ok(bad.error, 'a bad statement must RETURN an error, not throw');
  assert.match(String(bad.error?.message), /no_such_column/);

  // (c) service_role can actually write the money tables — otherwise every
  // "an order exists" assertion below could only ever fail, and every
  // "no order exists" assertion would pass for the wrong reason.
  await db.exec('SET ROLE service_role');
  const canWrite = await db
    .query(`SELECT has_table_privilege('service_role','public.orders','INSERT') AS ok`)
    .then((r) => (r.rows[0] as { ok: boolean }).ok);
  await db.exec('RESET ROLE');
  assert.equal(canWrite, true, 'service_role must hold INSERT on orders');
});

/* ── 1 · THE HAPPY PATH — a real bill lands in /admin/payments ──────────────*/

test('billable lock → charge + vendor-payer ORDER + linked manual PAYMENT', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor('happy@fee.test');
  const coupleUserId = await newCoupleUser('happy-couple@fee.test');
  await warmPastFree5(vendorProfileId, 'happy');

  const eventId = await newEvent('happy-6', coupleUserId);
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const res = await collect(evId);

  // (d) the returned status reflects success.
  assert.equal(res.status, 'ordered', 'a billable lock must MINT an order');
  assert.ok(res.status === 'ordered');
  assert.equal(res.amountPhp, 6_000, '₱200,000 → 5% of 100k + 1% of 100k = ₱6,000');
  assert.match(res.referenceCode, /^SN[0-9A-F]{8}$/, 'reference code keeps the shared SN+hex shape');

  // (a) the charge row.
  const charges = await chargesFor(evId);
  assert.equal(charges.length, 1, 'exactly one charge for the booking');
  assert.equal(charges[0]!.charge_id, res.chargeId);
  assert.equal(charges[0]!.status, 'pending');
  assert.equal(charges[0]!.amount, 600_000, 'charge is ₱6,000 in centavos');

  // (b) the order row — the thing the vendor is actually billed by.
  const orders = await ordersForCharge(res.chargeId);
  assert.equal(orders.length, 1, 'exactly one order for the charge');
  const order = orders[0]!;
  assert.equal(order.order_id, res.orderId);
  assert.equal(order.user_id, vendorUserId, 'the PAYER is the vendor’s claiming user');
  assert.notEqual(order.user_id, coupleUserId, 'the couple must never be billed the vendor’s fee');
  assert.equal(order.vendor_profile_id, vendorProfileId);
  assert.equal(order.event_id, eventId);
  assert.equal(order.status, 'submitted');
  assert.ok(order.reference_code, 'reference_code is NOT NULL');
  assert.equal(order.reference_code, res.referenceCode, 'the returned code is the stored code');
  assert.equal(Number(order.requested_total_php), 6_000, 'order asks for the charge amount in pesos');
  assert.equal(
    order.service_key,
    `vendor_booking_fee__${res.chargeId}`,
    'vendor_-prefixed key → VAT-INCLUSIVE, and carries the charge id for the settle bridge',
  );
  assert.ok(order.service_key!.startsWith('vendor_'), 'service_key must be vendor_-prefixed');
  // Deliberately rate-AGNOSTIC. The shipped description hardcodes "(5%)", but
  // the schedule has been a 5%/1% TAPER since 2026-07-25: a ₱1,000,000 booking
  // is billed ₱14,000 — 1.4%, not 5% — and the vendor's own bill would say
  // otherwise. Pinning the literal string here would enshrine that defect, so
  // this asserts only that the vendor is told what the bill is FOR. See the
  // finding filed against lib/booking-fee-lock.server.ts:150.
  assert.match(order.description, /booking fee/i, 'the vendor must be told what the bill is');

  // (c) the payment row, reached ONLY through the order — the link is asserted.
  const payments = await paymentsLinkedToChargeOrder(res.chargeId);
  assert.equal(payments.length, 1, 'exactly one payment, linked to the order');
  assert.equal(payments[0]!.order_id, order.order_id, 'ORDER ↔ PAYMENT link');
  assert.equal(Number(payments[0]!.amount_php), 6_000);
  assert.equal(payments[0]!.channel, 'manual', 'manual = the BDO/GCash QR rail');
  assert.equal(payments[0]!.user_id, vendorUserId, 'the payment is owed by the vendor');
  assert.equal(payments[0]!.status, 'pending', 'lands in /admin/payments awaiting reconciliation');
});

/* ── 2 · AMOUNT AGREEMENT — centavos, order pesos, payment pesos ────────────*/

for (const c of [
  {
    label: 'taper-crossing ₱123,456.78 (sub-peso fee — the rounding case)',
    totalPhp: 123_456.78,
    // 5% of ₱100,000 + 1% of ₱23,456.78 = ₱5,234.5678 → ₱5,234.57
    expectCentavos: 523_457,
  },
  {
    label: 'floor case ₱500 (5% = ₱25, floored to ₱50)',
    totalPhp: 500,
    expectCentavos: 5_000,
  },
]) {
  test(`amount agrees across ledger/order/payment — ${c.label}`, async () => {
    const { vendorProfileId } = await newVendor(`amt-${c.expectCentavos}@fee.test`);
    await warmPastFree5(vendorProfileId, `amt-${c.expectCentavos}`);
    const eventId = await newEvent(`amt-${c.expectCentavos}-6`);
    const evId = await newContractedBooking(eventId, vendorProfileId, c.totalPhp);

    const res = await collect(evId);
    assert.equal(res.status, 'ordered');
    assert.ok(res.status === 'ordered');

    const charge = (await chargesFor(evId))[0]!;
    const order = (await ordersForCharge(res.chargeId))[0]!;
    const payment = (await paymentsLinkedToChargeOrder(res.chargeId))[0]!;

    assert.equal(charge.amount, c.expectCentavos, 'the ledger charge is the expected centavos');
    // The TS schedule and the SQL schedule must already agree (asserted in the
    // sibling suite); this pins that the APP then carries that number, unrounded
    // and undrifted, into both money rows a human will read.
    assert.equal(
      Math.round(bookingFeePhp(c.totalPhp) * 100),
      c.expectCentavos,
      'TS schedule agrees with the SQL charge',
    );
    assert.equal(
      Math.round(Number(order.requested_total_php) * 100),
      charge.amount,
      'order pesos ↔ charge centavos: no rounding drift',
    );
    assert.equal(
      Math.round(Number(payment.amount_php) * 100),
      charge.amount,
      'payment pesos ↔ charge centavos: no rounding drift',
    );
    assert.equal(
      Number(order.requested_total_php),
      Number(payment.amount_php),
      'the vendor is asked for, and logged as paying, the SAME peso amount',
    );
    assert.equal(res.amountPhp, Number(order.requested_total_php), 'the returned amount is the billed amount');
  });
}

/* ── 3 · no_payer — the half-write branch ───────────────────────────────────*/

test('unclaimed vendor profile → no_payer, and NEITHER money row is written', async () => {
  // An admin-owned profile (user_id NULL) has nobody to bill. The charge must
  // still exist so ops can resolve it once the vendor claims — but an order
  // with no payer would be a bill addressed to nobody.
  const vendorProfileId = await newUnclaimedVendor();
  await warmPastFree5(vendorProfileId, 'nopayer');
  const eventId = await newEvent('nopayer-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const censusBefore = await moneyRowCensus();
  const res = await collect(evId);

  assert.equal(res.status, 'no_payer');
  assert.ok(res.status === 'no_payer');

  // The charge survives — this is the half that MUST be written.
  const charges = await chargesFor(evId);
  assert.equal(charges.length, 1, 'the charge is still recorded for ops');
  assert.equal(charges[0]!.charge_id, res.chargeId);
  assert.equal(charges[0]!.status, 'pending');
  assert.equal(charges[0]!.amount, 600_000);

  // …and the halves that MUST NOT be.
  assert.deepEqual(await ordersForCharge(res.chargeId), [], 'no order for an unpayable charge');
  assert.deepEqual(await paymentsLinkedToChargeOrder(res.chargeId), []);
  await assertWroteNoMoneyRows(censusBefore, 'a no_payer charge');
});

/* ── 4 · IDEMPOTENCY AT THE ORDER LAYER ────────────────────────────────────*/

test('calling twice for the same (vendor,event) → exactly ONE order and ONE payment', async () => {
  const { vendorProfileId, userId } = await newVendor('idem@fee.test');
  await warmPastFree5(vendorProfileId, 'idem');
  const eventId = await newEvent('idem-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const censusBefore = await moneyRowCensus();
  const first = await collect(evId);
  assert.equal(first.status, 'ordered');
  assert.ok(first.status === 'ordered');

  const second = await collect(evId);

  // ROWS FIRST, deliberately. Without the guard the second call really does
  // insert a second `orders` row (its reference_code is freshly random, so no
  // UNIQUE constraint stops it) — a vendor billed twice for one booking. That
  // must be reported as "two bills", not as a status mismatch.
  const orders = await ordersForCharge(first.chargeId);
  assert.equal(orders.length, 1, 'a re-lock must not mint a SECOND bill for the same booking');
  assert.equal(orders[0]!.user_id, userId);
  const payments = await paymentsLinkedToChargeOrder(first.chargeId);
  assert.equal(payments.length, 1, 'and must not mint a second payment');

  const censusAfter = await moneyRowCensus();
  assert.equal(censusAfter.orders - censusBefore.orders, 1, 'exactly one order across BOTH calls');
  assert.equal(censusAfter.payments - censusBefore.payments, 1, 'exactly one payment across BOTH calls');

  assert.equal(second.status, 'order_exists', 'the re-lock must recognise the existing order');
  assert.ok(second.status === 'order_exists');
  assert.equal(second.chargeId, first.chargeId, 'same charge is reused');
  assert.equal(second.orderId, first.orderId, 'and it points at the SAME order');
});

/* ── 5 · FREE-5 — a courtesy booking is audited, never billed ───────────────*/

test('a booking inside the free-5 → waived charge, NO order, NO payment', async () => {
  const { vendorProfileId } = await newVendor('free5@postcond.test');
  const eventId = await newEvent('free5-1');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const censusBefore = await moneyRowCensus();
  const res = await collect(evId);

  assert.equal(res.status, 'free');
  assert.ok(res.status === 'free');
  assert.equal(res.bookingOrdinal, 1, 'the vendor’s first booked customer');

  const charges = await chargesFor(evId);
  assert.equal(charges.length, 1, 'the waived charge is still written, for audit');
  assert.equal(charges[0]!.status, 'waived_free5');
  assert.equal(charges[0]!.amount, 0, 'a free booking charges ₱0');

  assert.deepEqual(await ordersForCharge(res.chargeId), [], 'a free booking must never be billed');
  await assertWroteNoMoneyRows(censusBefore, 'a free-5 booking');
});

/* ── 6 · OFF-PLATFORM + IMPORT — never billed ───────────────────────────────*/

test('off-platform booking (no marketplace link) → skipped, NO order, NO payment', async () => {
  const eventId = await newEvent('offplatform-postcond');
  const evId = await newContractedBooking(eventId, null, 500_000);

  const censusBefore = await moneyRowCensus();
  const res = await collect(evId);

  assert.equal(res.status, 'skipped');
  assert.ok(res.status === 'skipped');
  assert.equal(res.reason, 'not_verified_vendor');
  await assertWroteNoMoneyRows(censusBefore, 'an off-platform booking');
});

test('a client the VENDOR brought (import) → zero_fee, NO order, NO payment', async () => {
  // No marketplace thread at all → attribution 'import' → waived_import charge.
  // The app maps that to `zero_fee` (it is neither 'waived_free5' nor 'pending'),
  // and must not bill a deal Setnayan had no part in.
  const { vendorProfileId } = await newVendor('import@postcond.test');
  await warmPastFree5(vendorProfileId, 'import');
  const eventId = await newEvent('import-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000, { sourced: false });

  const censusBefore = await moneyRowCensus();
  const res = await collect(evId);

  assert.equal(res.status, 'zero_fee', 'an import produces a ₱0 charge and no bill');
  assert.ok(res.status === 'zero_fee');
  const charges = await chargesFor(evId);
  assert.equal(charges.length, 1);
  assert.equal(charges[0]!.status, 'waived_import');
  assert.equal(charges[0]!.amount, 0);
  assert.deepEqual(await ordersForCharge(res.chargeId), []);
  await assertWroteNoMoneyRows(censusBefore, 'an imported (vendor-brought) client');
});

/* ── 7 · PACKAGE — one booking, one bill, on the ANCHOR ─────────────────────*/

test('package booking bills ONCE on the anchor; a covered row bills nothing', async () => {
  const { vendorProfileId, userId } = await newVendor('pkg@postcond.test');
  await warmPastFree5(vendorProfileId, 'pkg');
  const eventId = await newEvent('pkg-6');

  const pkg = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos, primary_canonical_service)
     VALUES ($1, 'Postcondition Package', 20000000, 'photography') RETURNING package_id`,
    [vendorProfileId],
  );
  const booking = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages (event_id, package_id, status, total_locked_centavos)
     VALUES ($1, $2, 'locked', 20000000) RETURNING booking_id`,
    [eventId, pkg.rows[0]!.package_id],
  );
  const bookingId = booking.rows[0]!.booking_id;

  // The ANCHOR carries the money and takes the one fee.
  const anchorId = await newContractedBooking(eventId, vendorProfileId, 200_000, {
    packageRole: 'anchor',
    packageBookingId: bookingId,
  });
  // A COVERED row is one service inside the package — no money, no fee ever.
  const coveredId = await newContractedBooking(eventId, vendorProfileId, null, {
    packageRole: 'covered',
    packageBookingId: bookingId,
    sourced: false, // the thread already exists from the anchor insert
  });

  const anchorRes = await collect(anchorId);
  assert.equal(anchorRes.status, 'ordered', 'the anchor takes the single package fee');
  assert.ok(anchorRes.status === 'ordered');
  assert.equal(anchorRes.amountPhp, 6_000);
  const anchorOrders = await ordersForCharge(anchorRes.chargeId);
  assert.equal(anchorOrders.length, 1, 'exactly ONE order for the whole package');
  assert.equal(anchorOrders[0]!.user_id, userId);
  assert.equal((await paymentsLinkedToChargeOrder(anchorRes.chargeId)).length, 1);

  const censusBefore = await moneyRowCensus();
  const coveredRes = await collect(coveredId);
  assert.equal(coveredRes.status, 'skipped');
  assert.ok(coveredRes.status === 'skipped');
  assert.equal(coveredRes.reason, 'covered_row_no_fee', 'the DB guard refuses covered rows');
  assert.deepEqual(await chargesFor(coveredId), [], 'a covered row never even opens a charge');
  await assertWroteNoMoneyRows(censusBefore, 'a covered package row');
});

/* ── 8 · THE COMPENSATING DELETE — no orphan bill ───────────────────────────*/

test('payments insert fails → the just-created ORDER IS GONE, and the charge stays retryable', async () => {
  // WHY THIS MATTERS MOST: if the payments insert fails AFTER the order landed,
  // that compensating delete is the only thing between a vendor and an orphaned
  // bill sitting in /admin/payments with no payment behind it — visible to the
  // vendor, reconcilable by nobody.
  const { vendorProfileId, userId } = await newVendor('rollback@postcond.test');
  await warmPastFree5(vendorProfileId, 'rollback');
  const eventId = await newEvent('rollback-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  // Test-local DDL: a deterministic payments-insert failure. No production
  // change, no reliance on an incidental constraint.
  await db.exec(`
    CREATE OR REPLACE FUNCTION public._test_block_payments_insert() RETURNS trigger
    LANGUAGE plpgsql AS $fn$ BEGIN
      RAISE EXCEPTION 'test_forced_payments_insert_failure' USING ERRCODE = '23514';
    END $fn$;
    CREATE TRIGGER _test_block_payments_insert BEFORE INSERT ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public._test_block_payments_insert();
  `);

  let res: CollectResult;
  const censusBefore = await moneyRowCensus();
  try {
    res = await collect(evId);
  } finally {
    await db.exec(`
      DROP TRIGGER IF EXISTS _test_block_payments_insert ON public.payments;
      DROP FUNCTION IF EXISTS public._test_block_payments_insert();
    `);
  }

  assert.equal(res.status, 'skipped', 'a failed payment must not report success');
  assert.ok(res.status === 'skipped');
  assert.match(res.reason, /test_forced_payments_insert_failure/);

  // THE assertion: the order row is GONE, not merely unreported.
  const charge = (await chargesFor(evId))[0]!;
  const orphans = await ordersForCharge(charge.charge_id);
  assert.deepEqual(orphans, [], 'an order with no payment behind it must NOT survive');
  await assertWroteNoMoneyRows(censusBefore, 'a rolled-back booking-fee order');

  // And the charge is left LIVE, so the next lock re-issues rather than
  // stranding the fee. Proved by actually retrying, not by reading a comment.
  assert.equal(charge.status, 'pending', 'the charge stays pending for a retry');
  assert.equal(charge.amount, 600_000);

  const retry = await collect(evId);
  assert.equal(retry.status, 'ordered', 'the retry re-mints the bill cleanly');
  assert.ok(retry.status === 'ordered');
  assert.equal(retry.chargeId, charge.charge_id, 'the SAME charge is billed — no double-charge');
  const orders = await ordersForCharge(charge.charge_id);
  assert.equal(orders.length, 1, 'exactly one order after the retry');
  assert.equal(orders[0]!.user_id, userId);
  assert.equal((await paymentsLinkedToChargeOrder(charge.charge_id)).length, 1);
});

/* ── 9 · FLAG OFF — a pure no-op ────────────────────────────────────────────*/

test('flag OFF → writes NOTHING: no charge, no order, no payment', async () => {
  const { vendorProfileId } = await newVendor('flagoff@postcond.test');
  await warmPastFree5(vendorProfileId, 'flagoff');
  const eventId = await newEvent('flagoff-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const censusBefore = await moneyRowCensus();
  const previous = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  let res: CollectResult;
  try {
    res = await collect(evId);
  } finally {
    process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = previous;
  }

  assert.equal(res.status, 'disabled');
  assert.deepEqual(await chargesFor(evId), [], 'flag off must not even open a charge');
  await assertWroteNoMoneyRows(censusBefore, 'a lock with the fee flag off');

  // Positive control: the SAME booking bills the moment the flag is back on, so
  // the "wrote nothing" above is attributable to the flag and not to a broken
  // fixture that could never have billed.
  const armed = await collect(evId);
  assert.equal(armed.status, 'ordered', 'the same booking IS billable once armed');
  assert.ok(armed.status === 'ordered');
  assert.equal((await ordersForCharge(armed.chargeId)).length, 1);
});
