/**
 * Phase 3b orchestrator tests — runVendorAutoReply against a canned in-memory
 * Supabase stub. What these prove:
 *
 *   • FLAG OFF / non-couple sender → the function returns without touching the
 *     client AT ALL (the stub throws on any access — zero behavior change).
 *   • bot disabled / no config / cap reached / no active Vendor AI add-on → no
 *     bot message is inserted.
 *   • couple + enabled + under cap → posts ONE chat_messages row with
 *     sender_role='vendor' + is_bot=true + sender_user_id=null, then logs a
 *     vendor_bot_replies row pointing at it.
 *   • ANY throw inside the pipeline (engine, DB, client construction) resolves
 *     instead of propagating — the couple's already-inserted human message can
 *     never be blocked or errored by a bot failure (fail-closed contract).
 *
 * The flag reads process.env at call time, so tests set/restore
 * NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 around each case (node:test runs these
 * sequentially in-process).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runVendorAutoReply } from './inbox-hook';
import type { VendorServiceRow } from '../vendor-services';

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

// ── Canned-query Supabase stub ──────────────────────────────────────────────

type Canned = { rows?: unknown[]; single?: unknown; count?: number };
type InsertLogEntry = { table: string; row: Record<string, unknown> };
type ListResult = { data: unknown[]; error: null; count: number | null };

class FakeQuery implements PromiseLike<ListResult> {
  private insertedRow: Record<string, unknown> | null = null;
  constructor(
    private table: string,
    private canned: Canned,
    private log: InsertLogEntry[],
  ) {}
  select(..._args: unknown[]) {
    return this;
  }
  eq(..._args: unknown[]) {
    return this;
  }
  gte(..._args: unknown[]) {
    return this;
  }
  in(..._args: unknown[]) {
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
    this.log.push({ table: this.table, row });
    return this;
  }
  async maybeSingle() {
    return { data: this.canned.single ?? null, error: null };
  }
  async single() {
    if (this.insertedRow) return { data: { message_id: 'bot-msg-1' }, error: null };
    return { data: this.canned.single ?? null, error: null };
  }
  then<R1 = ListResult, R2 = never>(
    onfulfilled?: ((value: ListResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const result: ListResult = this.insertedRow
      ? { data: [], error: null, count: null }
      : { data: this.canned.rows ?? [], error: null, count: this.canned.count ?? null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

function fakeAdmin(canned: Record<string, Canned>, log: InsertLogEntry[]): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(table, canned[table] ?? {}, log);
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

function service(): VendorServiceRow {
  return {
    vendor_service_id: 's1',
    public_id: 'S89S-0000000000',
    vendor_profile_id: 'v1',
    category: 'wedding_photography',
    title: 'Wedding Signature',
    starting_price_php: 48000,
    added_pax_price_php: null,
    pricing_basis: 'fixed',
    per_pax_price_php: null,
    min_pax: null,
    hour_base_php: null,
    min_hours: null,
    extra_hour_php: null,
    crew_size: null,
    crew_meal_required: false,
    crew_meal_included: true,
    transport_included: true,
    transport_flat_fee_php: null,
    primary_photo_r2_key: null,
    showcase_video_r2_key: null,
    showcase_photo_r2_keys: [],
    is_active: true,
    branch_id: null,
    recommended_lead_time_months: null,
    last_minute_end_months: null,
    last_minute_surcharge_pct: null,
    daily_capacity: null,
    exclusive_perk_text: null,
    base_pax: null,
    coverage_id: null,
    created_at: '2027-01-01',
    updated_at: '2027-01-01',
  };
}

function happyCanned(overrides: Record<string, Canned> = {}): Record<string, Canned> {
  return {
    // DPO control ACTIVE — the owner has approved the Vendor-AI flow at
    // /admin/data-privacy, so the fail-closed privacy gate lets the run proceed.
    data_privacy_controls: { single: { status: 'active' } },
    chat_threads: { single: { thread_id: 't1', event_id: 'e1', vendor_profile_id: 'v1' } },
    vendor_bot_config: { single: { enabled: true, daily_reply_cap: 30 } },
    vendor_bot_replies: { count: 0 },
    chat_messages: { single: { body: 'How much is your wedding package?' } },
    // The stub returns ONE canned single per table, and vendor_profiles is read
    // twice — for the AI add-on entitlement (ai_addon_expires_at) and for
    // business_name. Carry both fields; the far-future expiry keeps the paid
    // add-on gate open in the happy path.
    vendor_profiles: {
      single: { business_name: 'Blooms & Co.', ai_addon_expires_at: '2099-01-01T00:00:00.000Z' },
    },
    vendor_services: { rows: [service()] },
    vendor_service_inclusions: { rows: [] },
    vendor_service_discounts: { rows: [] },
    vendor_service_addons: { rows: [] },
    vendor_packages: { rows: [] },
    vendor_coverages: { rows: [] },
    vendor_reviews: { rows: [] },
    vendor_review_stats: { single: null },
    events: { single: { event_type: 'wedding' } },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('flag off → returns without touching the client (zero behavior change)', () =>
  withFlag(undefined, async () => {
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, untouchableAdmin());
  }));

test('vendor sender → returns without touching the client (loop-guard)', () =>
  withFlag('true', async () => {
    await runVendorAutoReply({ threadId: 't1', senderRole: 'vendor' }, untouchableAdmin());
  }));

test('bot disabled → no bot message, no log row', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    const canned = happyCanned({
      vendor_bot_config: { single: { enabled: false, daily_reply_cap: 30 } },
    });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));
    assert.equal(log.length, 0);
  }));

test('no vendor_bot_config row → no bot message (strictly opt-in)', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    const canned = happyCanned({ vendor_bot_config: { single: null } });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));
    assert.equal(log.length, 0);
  }));

test('daily cap reached → no bot message', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    const canned = happyCanned({ vendor_bot_replies: { count: 30 } });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));
    assert.equal(log.length, 0);
  }));

test('no active Vendor AI add-on → no bot message (paid-add-on gate)', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    // Vendor is enabled + under cap, but the add-on window is expired → the
    // assistant must not run (the inbox still works by hand).
    const canned = happyCanned({
      vendor_profiles: {
        single: { business_name: 'Blooms & Co.', ai_addon_expires_at: '2000-01-01T00:00:00.000Z' },
      },
    });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));
    assert.equal(log.length, 0);
  }));

test('DPO control inactive → no bot message (privacy fail-closed)', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    // Everything else is happy, but the owner has NOT approved the Vendor-AI
    // flow at /admin/data-privacy → the assistant must not run.
    const canned = happyCanned({
      data_privacy_controls: { single: { status: 'inactive' } },
    });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));
    assert.equal(log.length, 0);
  }));

test('couple + enabled + under cap → posts AI-labelled reply + logs it', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    await runVendorAutoReply(
      { threadId: 't1', senderRole: 'couple' },
      fakeAdmin(happyCanned(), log),
    );

    const msg = log.find((e) => e.table === 'chat_messages');
    assert.ok(msg, 'expected a chat_messages insert');
    assert.equal(msg.row.is_bot, true);
    assert.equal(msg.row.sender_role, 'vendor');
    assert.equal(msg.row.sender_user_id, null);
    assert.equal(msg.row.thread_id, 't1');
    assert.equal(msg.row.vendor_profile_id, 'v1');
    assert.ok(
      typeof msg.row.body === 'string' && msg.row.body.length > 0,
      'reply body must be non-empty',
    );

    const logged = log.find((e) => e.table === 'vendor_bot_replies');
    assert.ok(logged, 'expected a vendor_bot_replies log row');
    assert.equal(logged.row.message_id, 'bot-msg-1');
    assert.equal(logged.row.action, 'reply');
    assert.equal(logged.row.intent, 'price');
    assert.equal(logged.row.was_llm, false);
  }));

test('handoff intent (booking) → NO chat message, handoff log row only', () =>
  withFlag('true', async () => {
    const log: InsertLogEntry[] = [];
    const canned = happyCanned({
      chat_messages: { single: { body: 'We want to book you — how do we proceed?' } },
    });
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, fakeAdmin(canned, log));

    assert.equal(log.filter((e) => e.table === 'chat_messages').length, 0);
    const logged = log.find((e) => e.table === 'vendor_bot_replies');
    assert.ok(logged, 'expected a handoff log row');
    assert.equal(logged.row.action, 'handoff');
    assert.equal(logged.row.message_id, null);
  }));

test('any throw inside the pipeline resolves — human message insert unaffected', () =>
  withFlag('true', async () => {
    const explosive = {
      from() {
        throw new Error('db exploded');
      },
    } as unknown as SupabaseClient;
    // Must resolve, not reject — the fail-closed contract.
    await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' }, explosive);
  }));

test('no admin override + missing env → still resolves (client construction fail-closed)', () =>
  withFlag('true', async () => {
    // Force createAdminClient() down its "missing env" throw path
    // deterministically (CI shells may export real Supabase vars — we must
    // never let a unit test construct a live client and hit the network).
    const KEYS = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ] as const;
    const saved = KEYS.map((k) => [k, process.env[k]] as const);
    for (const k of KEYS) delete process.env[k];
    try {
      await runVendorAutoReply({ threadId: 't1', senderRole: 'couple' });
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }));
