/**
 * Phase 4A orchestrator tests — maybeAutoAccept against a canned in-memory
 * Supabase stub. What these prove:
 *
 *   • flag off / not opted in / thread not pending → the client is NEVER
 *     touched (zero extra work on every ordinary message).
 *   • happy path → the hold RPC (unlock_vendor_event_hold, consumed as-is) is
 *     called exactly once with the right args, the thread flips
 *     pending→accepted, an is_bot welcome posts, and an action='auto_accept'
 *     log row lands with the compat score.
 *   • RPC error (e.g. today's FORBIDDEN under the service role) → FAIL-CLOSED:
 *     no thread flip, no welcome, no log — the manual flow is unchanged.
 *   • NO token → the RPC is never even called (no hold, never borrow), and the
 *     waiting lead is flagged via compat_reasons.auto_accept_skipped.
 *   • trust-flagged (open inquiry_concentration integrity flag) → never.
 *   • daily auto-accept cap reached → never.
 *   • token probe ERROR → fail-closed (no accept AND no misleading flag).
 *   • first evaluation snapshots compat_score_at_inquiry + compat_reasons.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { maybeAutoAccept, type AutoAcceptContext } from './auto-accept';

const FLAG = 'NEXT_PUBLIC_VENDOR_AUTOREPLY_V1';

function withFlag<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  return fn().finally(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });
}

// ── Canned-query Supabase stub (richer than the inbox-hook one: update + rpc) ─

type Canned = {
  rows?: unknown[];
  single?: unknown;
  count?: number;
  /** Rows returned by an update(...).select(...) chain. */
  updateRows?: unknown[];
  /** Any method call on this table throws (error-injection). */
  throw?: boolean;
};
type WriteEntry = { table: string; kind: 'insert' | 'update'; row: Record<string, unknown> };
type RpcEntry = { name: string; args: Record<string, unknown> };
type ListResult = { data: unknown[] | null; error: null; count: number | null };

class FakeQuery implements PromiseLike<ListResult> {
  private insertedRow: Record<string, unknown> | null = null;
  private updatedRow: Record<string, unknown> | null = null;
  constructor(
    private table: string,
    private canned: Canned,
    private log: WriteEntry[],
  ) {
    if (canned.throw) throw new Error(`table ${table} exploded (injected)`);
  }
  select(..._args: unknown[]) {
    return this;
  }
  eq(..._args: unknown[]) {
    return this;
  }
  gte(..._args: unknown[]) {
    return this;
  }
  is(..._args: unknown[]) {
    return this;
  }
  or(..._args: unknown[]) {
    return this;
  }
  contains(..._args: unknown[]) {
    return this;
  }
  order(..._args: unknown[]) {
    return this;
  }
  limit(..._args: unknown[]) {
    return this;
  }
  insert(row: Record<string, unknown>) {
    this.insertedRow = row;
    this.log.push({ table: this.table, kind: 'insert', row });
    return this;
  }
  update(row: Record<string, unknown>) {
    this.updatedRow = row;
    this.log.push({ table: this.table, kind: 'update', row });
    return this;
  }
  async maybeSingle() {
    return { data: this.canned.single ?? null, error: null };
  }
  async single() {
    if (this.insertedRow) return { data: { message_id: 'welcome-msg-1' }, error: null };
    return { data: this.canned.single ?? null, error: null };
  }
  then<R1 = ListResult, R2 = never>(
    onfulfilled?: ((value: ListResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: ListResult;
    if (this.insertedRow) {
      result = { data: [], error: null, count: null };
    } else if (this.updatedRow) {
      result = { data: this.canned.updateRows ?? [], error: null, count: null };
    } else {
      result = { data: this.canned.rows ?? [], error: null, count: this.canned.count ?? null };
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

type RpcCanned = { data?: unknown; error?: { message: string } | null };

function fakeAdmin(
  canned: Record<string, Canned>,
  log: WriteEntry[],
  rpcLog: RpcEntry[],
  rpcResult: RpcCanned = { data: { held: true }, error: null },
): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(table, canned[table] ?? {}, log);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcLog.push({ name, args });
      return { data: rpcResult.data ?? null, error: rpcResult.error ?? null };
    },
  } as unknown as SupabaseClient;
}

/** A client where ANY property access explodes — proves zero DB touches. */
function untouchableAdmin(): SupabaseClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('client must not be touched');
      },
    },
  ) as SupabaseClient;
}

function ctx(overrides: Partial<AutoAcceptContext> = {}): AutoAcceptContext {
  return {
    threadId: 't1',
    eventId: 'e1',
    vendorProfileId: 'v1',
    inquiryStatus: 'pending',
    existingCompatScore: 90,
    businessName: 'Blooms & Co.',
    config: { autoAcceptEnabled: true, autoAcceptThreshold: 78, dailyAutoAcceptCap: 10 },
    avgRating: 4.9,
    reviewCount: 60,
    eventRow: { region: 'ncr' },
    ...overrides,
  };
}

function happyCanned(overrides: Record<string, Canned> = {}): Record<string, Canned> {
  return {
    vendor_profiles: {
      single: {
        user_id: 'founder-1',
        tier_state: 'pro',
        verification_state: 'verified',
        hq_latitude: null,
        hq_longitude: null,
      },
    },
    integrity_flags: { count: 0 },
    vendor_bot_replies: { count: 0 },
    vendor_wallets: { single: { earned_tokens: 3, purchased_tokens: 2 } },
    lead_token_holds: { rows: [{ tokens: 2 }] },
    regions: { single: null },
    chat_threads: { updateRows: [{ thread_id: 't1' }] },
    chat_messages: {},
    ...overrides,
  };
}

// ── Zero-touch pre-exits ────────────────────────────────────────────────────

test('flag off → returns without touching the client', () =>
  withFlag(undefined, async () => {
    await maybeAutoAccept(ctx(), untouchableAdmin());
  }));

test('vendor not opted in (config null / disabled) → zero touches', () =>
  withFlag('true', async () => {
    await maybeAutoAccept(ctx({ config: null }), untouchableAdmin());
    await maybeAutoAccept(
      ctx({ config: { autoAcceptEnabled: false, autoAcceptThreshold: 78, dailyAutoAcceptCap: 10 } }),
      untouchableAdmin(),
    );
  }));

test('thread already accepted / declined → zero touches (never re-accepts)', () =>
  withFlag('true', async () => {
    await maybeAutoAccept(ctx({ inquiryStatus: 'accepted' }), untouchableAdmin());
    await maybeAutoAccept(ctx({ inquiryStatus: 'declined' }), untouchableAdmin());
  }));

// ── The accept path ─────────────────────────────────────────────────────────

test('happy path → hold RPC once + thread flip + is_bot welcome + auto_accept log', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(ctx(), fakeAdmin(happyCanned(), log, rpcLog));

    // The hold RPC — consumed as-is, called exactly once, with the §4A args.
    assert.equal(rpcLog.length, 1);
    assert.equal(rpcLog[0]?.name, 'unlock_vendor_event_hold');
    assert.deepEqual(rpcLog[0]?.args, {
      p_vendor_profile_id: 'v1',
      p_event_id: 'e1',
      p_thread_id: 't1',
    });

    // pending → accepted flip.
    const flip = log.find(
      (e) => e.table === 'chat_threads' && e.kind === 'update' && e.row.inquiry_status === 'accepted',
    );
    assert.ok(flip, 'expected the pending→accepted thread update');
    assert.ok(typeof flip.row.accepted_at === 'string');

    // AI-labelled welcome citing the business.
    const welcome = log.find((e) => e.table === 'chat_messages' && e.kind === 'insert');
    assert.ok(welcome, 'expected a welcome chat_messages insert');
    assert.equal(welcome.row.is_bot, true);
    assert.equal(welcome.row.sender_role, 'vendor');
    assert.equal(welcome.row.sender_user_id, null);
    assert.match(String(welcome.row.body), /Blooms & Co\. accepted your inquiry/);

    // The auto_accept log row (the daily-cap counter) with the score.
    const logRow = log.find((e) => e.table === 'vendor_bot_replies' && e.kind === 'insert');
    assert.ok(logRow, 'expected a vendor_bot_replies insert');
    assert.equal(logRow.row.action, 'auto_accept');
    assert.equal(logRow.row.compat_score, 90);
    assert.equal(logRow.row.message_id, 'welcome-msg-1');
    assert.equal(logRow.row.was_llm, false);
  }));

test('hold RPC error (e.g. FORBIDDEN) → fail-closed: no flip, no welcome, no log', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(
      ctx(),
      fakeAdmin(happyCanned(), log, rpcLog, {
        error: { message: 'FORBIDDEN: caller is not an answering member of this vendor' },
      }),
    );
    assert.equal(rpcLog.length, 1, 'the RPC was attempted');
    assert.equal(log.length, 0, 'but nothing was written — manual flow unchanged');
  }));

// ── The never paths ─────────────────────────────────────────────────────────

test('NO token → RPC never called, no hold, waiting lead flagged on the thread', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    const canned = happyCanned({
      vendor_wallets: { single: { earned_tokens: 1, purchased_tokens: 0 } },
      lead_token_holds: { rows: [{ tokens: 1 }] }, // 1 available − 1 held < 1 needed
    });
    await maybeAutoAccept(ctx(), fakeAdmin(canned, log, rpcLog));

    assert.equal(rpcLog.length, 0, 'no hold is ever placed without a token');
    const flip = log.find(
      (e) => e.table === 'chat_threads' && e.row.inquiry_status === 'accepted',
    );
    assert.equal(flip, undefined, 'thread stays pending');
    const flagUpdate = log.find(
      (e) =>
        e.table === 'chat_threads' &&
        e.kind === 'update' &&
        (e.row.compat_reasons as { auto_accept_skipped?: string } | undefined)
          ?.auto_accept_skipped === 'no_token',
    );
    assert.ok(flagUpdate, 'the waiting high-compat lead is flagged for the vendor');
    assert.equal(
      log.some((e) => e.table === 'chat_messages'),
      false,
      'no welcome message',
    );
  }));

test('trust-flagged (open inquiry_concentration flag) → never auto-accepts', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(
      ctx(),
      fakeAdmin(happyCanned({ integrity_flags: { count: 1 } }), log, rpcLog),
    );
    assert.equal(rpcLog.length, 0);
    assert.equal(log.length, 0, 'no writes at all (score already snapshotted)');
  }));

test('daily auto-accept cap reached → never', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(
      ctx(),
      fakeAdmin(happyCanned({ vendor_bot_replies: { count: 10 } }), log, rpcLog),
    );
    assert.equal(rpcLog.length, 0);
    assert.equal(log.length, 0);
  }));

test('token probe ERROR → fail-closed: no accept AND no misleading no-token flag', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(
      ctx(),
      fakeAdmin(happyCanned({ vendor_wallets: { throw: true } }), log, rpcLog),
    );
    assert.equal(rpcLog.length, 0);
    assert.equal(log.length, 0, 'no flag write either — we failed to look, vendor is not "out"');
  }));

test('below threshold → never; free tier → never', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    await maybeAutoAccept(ctx({ existingCompatScore: 50 }), fakeAdmin(happyCanned(), log, rpcLog));
    assert.equal(rpcLog.length, 0);

    const canned = happyCanned({
      vendor_profiles: {
        single: {
          user_id: 'founder-1',
          tier_state: 'free',
          verification_state: null,
          hq_latitude: null,
          hq_longitude: null,
        },
      },
    });
    await maybeAutoAccept(ctx(), fakeAdmin(canned, log, rpcLog));
    assert.equal(rpcLog.length, 0);
  }));

// ── The at-inquiry snapshot ─────────────────────────────────────────────────

test('first evaluation snapshots compat_score_at_inquiry + reasons on the thread', () =>
  withFlag('true', async () => {
    const log: WriteEntry[] = [];
    const rpcLog: RpcEntry[] = [];
    // Threshold 100 keeps the accept from firing so ONLY the snapshot lands.
    await maybeAutoAccept(
      ctx({
        existingCompatScore: null,
        config: { autoAcceptEnabled: true, autoAcceptThreshold: 100, dailyAutoAcceptCap: 10 },
      }),
      fakeAdmin(happyCanned(), log, rpcLog),
    );
    const snap = log.find((e) => e.table === 'chat_threads' && e.kind === 'update');
    assert.ok(snap, 'expected the at-inquiry snapshot update');
    assert.equal(typeof snap.row.compat_score_at_inquiry, 'number');
    const reasons = snap.row.compat_reasons as { reasons?: unknown } | undefined;
    assert.ok(Array.isArray(reasons?.reasons));
    assert.equal(rpcLog.length, 0);
  }));
