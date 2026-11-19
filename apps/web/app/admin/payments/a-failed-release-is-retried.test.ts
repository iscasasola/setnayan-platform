/**
 * a-failed-release-is-retried.test.ts — the 30-minute hold's release, RUN.
 *
 * The blocker this holds shut (review of #7940, 19 Nov): `releaseDueHolds`
 * claims `released_at` BEFORE it runs the approve, and `approvePaymentCore`
 * THROWS on a DB error. Before the fix, a throw left the payment `pending` with
 * `released_at` set — so it was never retried, it dropped off the held list, a
 * hand Match said "on its 30-minute hold, Undo it first", Undo said
 * "confirmed", and no audit row said any of it.
 *
 * Each test drives the REAL `releaseDueHolds` / `readHeld` against an in-memory
 * client that models the exact PostgREST call shapes they use, and reads the
 * rows afterwards — a property of the outcome, not of the source text.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

/* ── `server-only` shim ── a bundler assertion with no runtime behaviour. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_received_release__.js');
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

type Mod = typeof import('./received-auto');
let releaseDueHolds: Mod['releaseDueHolds'];
let readHeld: Mod['readHeld'];
before(async () => {
  ({ releaseDueHolds, readHeld } = await import('./received-auto'));
});

// ── An in-memory client: the call shapes received-auto.ts uses, nothing more ──

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;
type Filter = (r: Row) => boolean;

function fakeAdmin(db: Db) {
  class Q implements PromiseLike<{ data: unknown; error: null }> {
    private filters: Filter[] = [];
    private op: 'select' | 'update' | 'insert' = 'select';
    private patch: Row = {};
    private one = false;
    private max = Infinity;
    constructor(private table: string) {}
    select() { return this; }
    update(patch: Row) { this.op = 'update'; this.patch = patch; return this; }
    insert(row: Row) { this.op = 'insert'; this.patch = row; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
    is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
    not(c: string, op: 'is', v: null) { assert.equal(op, 'is'); this.filters.push((r) => (r[c] ?? null) !== v); return this; }
    lte(c: string, v: string) { this.filters.push((r) => String(r[c]) <= v); return this; }
    gt(c: string, v: string) { this.filters.push((r) => String(r[c]) > v); return this; }
    order() { return this; }
    limit(n: number) { this.max = n; return this; }
    maybeSingle() { this.one = true; return this; }
    then<A, B>(ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.run()).then(ok, no);
    }
    private run(): { data: unknown; error: null } {
      const rows = (db[this.table] ??= []);
      if (this.op === 'insert') {
        rows.push({ ...this.patch });
        return { data: null, error: null };
      }
      const hit = rows.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max);
      if (this.op === 'update') for (const r of hit) Object.assign(r, this.patch);
      const out = hit.map((r) => ({ ...r }));
      return { data: this.one ? (out[0] ?? null) : out, error: null };
    }
  }
  return { from: (t: string) => new Q(t) } as unknown as Parameters<Mod['releaseDueHolds']>[1];
}

const DUE = new Date(Date.now() - 31 * 60 * 1000).toISOString(); // past the 30-minute hold

function seed(): Db {
  return {
    admin_received_transactions: [
      {
        received_id: 7,
        reference: 'GXCHPHM2XXXB000000006991560',
        amount_php: 2499,
        matched_payment_id: 'pay-1',
        match_kind: 'auto',
        matched_at: DUE,
        matched_by: 'admin-1',
        created_by: 'admin-1',
        released_at: null,
        auto_undone_at: null,
      },
    ],
    payments: [{ payment_id: 'pay-1', status: 'pending' }],
    admin_audit_log: [],
  };
}

const received = (db: Db) => db.admin_received_transactions[0]!;
const actions = (db: Db) => db.admin_audit_log.map((a) => a.action);

test('a thrown approve puts the claim back, keeps the hold listed, writes the audit row — and the next run pays it', async () => {
  const db = seed();
  const admin = fakeAdmin(db);
  let calls = 0;
  const approve: Parameters<Mod['releaseDueHolds']>[0] = async () => {
    calls += 1;
    if (calls === 1) throw new Error('approve payment: connection reset');
    db.payments[0]!.status = 'matched';
    return { ok: true };
  };

  // Run 1: the approve throws. The job is told (rejects → ok=false), never "nothing was due".
  await assert.rejects(releaseDueHolds(approve, admin), /1 release\(s\) failed/);
  assert.equal(db.payments[0]!.status, 'pending', 'the payment must still be waiting');
  assert.equal(received(db).released_at, null, 'the claim stayed set — the payment would never be retried');
  assert.equal(received(db).match_kind, 'auto', 'a failed release is not an Undo');
  assert.equal(received(db).matched_payment_id, 'pay-1');

  const held = await readHeld(admin);
  assert.ok(held, 'the held read must answer');
  assert.deepEqual(held!.map((h) => h.received_id), [7], 'the hold dropped off the held list');

  assert.deepEqual(actions(db), ['payment_auto_match_release_failed'], 'a failed release must leave an audit row');
  const meta = db.admin_audit_log[0]!.metadata as Record<string, unknown>;
  assert.equal(meta.payment_id, 'pay-1');
  assert.equal(meta.retried_next_run, true);
  assert.equal(meta.payment_status_after, 'pending');
  assert.match(String(meta.message), /connection reset/);

  // Run 2: the same hold is picked up again and paid.
  assert.equal(await releaseDueHolds(approve, admin), 1);
  assert.equal(calls, 2, 'the hold was not retried');
  assert.equal(db.payments[0]!.status, 'matched');
  assert.notEqual(received(db).released_at, null);
  assert.deepEqual((await readHeld(admin))!, [], 'a paid hold must leave the held list');
  assert.deepEqual(actions(db), ['payment_auto_match_release_failed', 'payment_auto_match_released']);
});

test('a throw AFTER the payment flipped keeps the claim — that money is matched, never approved twice', async () => {
  const db = seed();
  const admin = fakeAdmin(db);
  const approve: Parameters<Mod['releaseDueHolds']>[0] = async () => {
    db.payments[0]!.status = 'matched';
    throw new Error('promote order: timeout');
  };
  await assert.rejects(releaseDueHolds(approve, admin));
  assert.notEqual(received(db).released_at, null, 'a matched payment must not go back on the hold');
  assert.deepEqual(actions(db), ['payment_auto_match_release_failed']);
  const meta = db.admin_audit_log[0]!.metadata as Record<string, unknown>;
  assert.equal(meta.retried_next_run, false);
  assert.equal(meta.payment_status_after, 'matched');
});

test('one failed hold does not stop the next one from being released', async () => {
  const db = seed();
  db.admin_received_transactions.push({ ...received(db), received_id: 8, matched_payment_id: 'pay-2' });
  db.payments.push({ payment_id: 'pay-2', status: 'pending' });
  const admin = fakeAdmin(db);
  const approve: Parameters<Mod['releaseDueHolds']>[0] = async ({ paymentId }) => {
    if (paymentId === 'pay-1') throw new Error('boom');
    db.payments[1]!.status = 'matched';
    return { ok: true };
  };
  await assert.rejects(releaseDueHolds(approve, admin));
  assert.equal(db.payments[1]!.status, 'matched', 'the second hold was skipped because the first threw');
  assert.deepEqual(actions(db).sort(), ['payment_auto_match_release_failed', 'payment_auto_match_released']);
});

for (const [kind, outcome] of [
  ['shortfall', { ok: false, shortfall: true, message: 'Payment matched, but the order was NOT marked paid' }],
  ['not_promotable', { ok: false, notPromotable: true, message: 'The order is cancelled' }],
] as const) {
  test(`a ${kind} answer is recorded as "matched, order NOT paid" — never counted as paid`, async () => {
    const db = seed();
    const admin = fakeAdmin(db);
    const approve: Parameters<Mod['releaseDueHolds']>[0] = async () => {
      db.payments[0]!.status = 'matched';
      return outcome;
    };
    assert.equal(await releaseDueHolds(approve, admin), 0, `a ${kind} was counted as paid`);
    assert.deepEqual(actions(db), ['payment_auto_match_released_order_not_paid']);
    const meta = db.admin_audit_log[0]!.metadata as Record<string, unknown>;
    assert.equal(meta.reason, kind);
    assert.equal(meta.reopened, false, 'a matched payment must not go back to the hand pile');
    assert.notEqual(received(db).released_at, null);
  });
}
