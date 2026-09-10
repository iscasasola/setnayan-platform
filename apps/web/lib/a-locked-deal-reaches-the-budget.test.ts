/**
 * a-locked-deal-reaches-the-budget.test.ts
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 * A couple renegotiates with a supplier they have ALREADY booked — the likeliest
 * reason to strike a Deal at all — and locks it. Before 2026-09-09:
 *
 *   • `planChatLockBooking` returned `refresh_fee_only` for every
 *     CONFIRMED_LOCK_STATUSES row (`contracted` included), and that branch wrote
 *     NOTHING, on the rule "an already-booked row's price is frozen";
 *   • `lockDeal` nevertheless stamped `locked_at` and froze
 *     `chat_threads.agreed_price_centavos` at the NEW total;
 *   • the card told the couple "🔒 Deal locked — price frozen."
 *
 * So the payment step held ₱85,000 while `/budget` — which reads
 * `event_vendors.total_cost_php` — held ₱100,000. **Two live numbers
 * disagreeing, with the reassuring one on screen.** Nothing errored, nothing
 * logged; the write simply matched zero rows, which PostgREST reports as success.
 *
 * ── The fix, as of 2026-09-11: a CHANGE beside the agreed total ─────────────
 * #5355 (2026-09-09) first closed this with an ABSOLUTE write of
 * `total_cost_php`. It chose that over a budget line because a line, back then,
 * deleted a headline-billed supplier's price outright
 * (`a-settled-delta-must-not-erase-the-headline.test.ts`, −₱15,000 not ₱85,000).
 * The same day the owner ruled "Both, shown separately" — the agreed total AND
 * the change, each visible — and `is_change_delta` (migration 20271218458148)
 * made a change line safe. So the reprice now REPLACES NOTHING: it calls the
 * service-role `record_agreed_price_change`, which leaves `total_cost_php` at
 * what they agreed at the lock and records (new − agreed-so-far) as a change
 * line. A second press of the same Deal finds a difference of 0 and writes
 * nothing, so it still cannot double count. The database half of this is
 * proved in `tests/db/a-change-after-the-lock-keeps-both-numbers.db.test.ts`.
 *
 * ⚠ THE FEE BASE MOVES WITH THE PRICE, BY OWNER DECISION (2026-09-09), not by
 * accident. The fee is charged when the VENDOR ACKNOWLEDGES THE PAYMENT on the
 * renegotiated price (what they actually booked at); since 2026-09-11
 * `booking_fee_open_lock_charge` reads `total_cost_php` + the change lines, so
 * that still holds now that the price column no longer moves.
 *
 * 🔑 THE MEASUREMENT HAS TO REACH THE RENDER. Repricing alone would not have
 * been enough — every write that claims to record a price now reports whether
 * the row MATCHED (`priceLanded`), and `lockDeal` refuses to stamp the Deal when
 * it did not. A screen may not say "frozen" about a number that never landed.
 *
 * 🛡 Behaviour is driven through the real `bookVendorAtChatLock` against a
 * stubbed PostgREST client — the UPDATE payload and the RPC arguments are
 * captured and asserted, not inferred from the source.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `chat-lock-booking.server.ts` opens with `import 'server-only'`, a module
 * Next.js supplies to the BUNDLER and which does not exist in node_modules, so a
 * static import dies with MODULE_NOT_FOUND before one assertion runs. Same shim,
 * same reasoning as `lib/booking-fee-anchor.test.ts`. Registered at module
 * scope; the real import is dynamic in `before()`, because a static one would
 * hoist above this and defeat it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_deal_lock__.js');
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

// The 'considering' case below routes through `planChatLockBooking`, whose
// answer depends on NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED ('book' when off,
// 'request' when on). Pinned here so the assertion measures THIS change rather
// than whatever the runner's environment happens to carry — the flag is read at
// call time, and an env-dependent expectation is a test that passes for a reason
// nobody chose.
process.env.NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED = 'false';

let bookVendorAtChatLock: typeof import('./chat-lock-booking.server').bookVendorAtChatLock;
before(async () => {
  ({ bookVendorAtChatLock } = await import('./chat-lock-booking.server'));
});

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = join(HERE, '../app/_components/negotiation-actions.ts');

type Captured = { table: string; payload: Record<string, unknown> } | null;

/**
 * PostgREST-shaped stub. The couple's client answers the status read, then
 * captures the UPDATE payload and returns `matchedRows` rows from `.select()`.
 */
function stubAuthed(currentStatus: string, matchedRows: number, sink: { last: Captured }) {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.not = () => b;
    b.update = (payload: Record<string, unknown>) => {
      sink.last = { table, payload };
      return b;
    };
    b.maybeSingle = async () => ({
      data: { status: currentStatus, lock_request_state: null },
      error: null,
    });
    // A terminal `.select('vendor_id')` after `.update()` is awaited directly.
    b.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: Array.from({ length: matchedRows }, () => ({ vendor_id: 'ev1' })),
        error: null,
      }).then(resolve);
    return b;
  };
  return { from: (table: string) => builder(table) } as unknown as SupabaseClient;
}

type RpcCall = { fn: string; args: Record<string, unknown> };

/**
 * Admin client: the verified pre-check reads `vendor_profiles`; the post-lock
 * reprice calls `record_agreed_price_change`, which answers `rpcStatus`.
 */
function stubAdmin(verified: boolean, rpcStatus = 'changed', rpcSink: { calls: RpcCall[] } = { calls: [] }) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = async () => ({
    data: { verification_state: verified ? 'verified' : 'unverified' },
    error: null,
  });
  return {
    from: () => b,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcSink.calls.push({ fn, args });
      return { data: { status: rpcStatus }, error: null };
    },
  } as unknown as SupabaseClient;
}

const ARGS = {
  eventId: 'e1',
  eventVendorId: 'ev1',
  marketplaceVendorId: 'vp1',
  agreedTotalPhp: 85_000,
};

test('an ALREADY-BOOKED supplier: the new deal is recorded BESIDE the agreed total, never over it', async () => {
  const sink: { last: Captured } = { last: null };
  const rpc: { calls: RpcCall[] } = { calls: [] };
  const outcome = await bookVendorAtChatLock(
    stubAuthed('contracted', 1, sink),
    stubAdmin(true, 'changed', rpc),
    ARGS,
  );

  assert.equal(outcome.status, 'already_booked');
  assert.equal(
    'priceLanded' in outcome && outcome.priceLanded,
    true,
    'The change was recorded, so the couple may be told the price is frozen.',
  );
  // THE RULING. The agreed total is not overwritten — the couple session issues
  // NO update to event_vendors at all on this branch. Before 2026-09-11 it wrote
  // total_cost_php := 85,000 and the ₱100,000 they locked at was gone.
  assert.equal(
    sink.last,
    null,
    'The already-booked reprice overwrote the booking row again. Owner 2026-09-09: ' +
      '"Both, shown separately" — the agreed total stays and the change sits beside it.',
  );
  const recorded = rpc.calls.filter((c) => c.fn === 'record_agreed_price_change');
  assert.equal(recorded.length, 1, 'The new deal was not recorded as a change at all.');
  assert.equal(recorded[0]!.args.p_new_total_php, 85_000);
  assert.equal(recorded[0]!.args.p_event_vendor_id, 'ev1');
  assert.equal(recorded[0]!.args.p_event_id, 'e1');
});

test('the reprice records the price and nothing else — no second booking path', async () => {
  const sink: { last: Captured } = { last: null };
  const rpc: { calls: RpcCall[] } = { calls: [] };
  await bookVendorAtChatLock(stubAuthed('deposit_paid', 1, sink), stubAdmin(true, 'changed', rpc), ARGS);

  // This row is already booked. A status flip, a first-pick stamp or a fee call
  // here would be a second booking path, which is exactly what the shared core
  // exists to prevent. The couple session writes NOTHING; the one server call
  // carries exactly the booking, the event and the agreed number.
  assert.equal(sink.last, null, 'The couple session wrote to the booking row on an already-booked reprice.');
  assert.deepEqual(
    rpc.calls.map((c) => c.fn),
    ['record_agreed_price_change'],
    'Exactly one server call on a reprice — never a fee call or a booking write.',
  );
  assert.deepEqual(
    Object.keys(rpc.calls[0]!.args).sort(),
    ['p_event_id', 'p_event_vendor_id', 'p_new_total_php'],
    'The reprice passes the booking, the event and the agreed total — nothing else.',
  );
});

test('a reprice that finds NO booking reports priceLanded:false — it never reads as success', async () => {
  for (const answer of ['not_found', 'something_new']) {
    const sink: { last: Captured } = { last: null };
    const outcome = await bookVendorAtChatLock(
      stubAuthed('complete', 0, sink),
      stubAdmin(true, answer),
      ARGS,
    );
    assert.equal(outcome.status, 'already_booked');
    assert.equal(
      'priceLanded' in outcome && outcome.priceLanded,
      false,
      `The server answered '${answer}'. If this says true, the caller will stamp the Deal ` +
        'and tell the couple their price is frozen when nothing was recorded.',
    );
  }
});

test('a repeat press (the agreed total already IS the new number) still counts as landed', async () => {
  // `record_agreed_price_change` answers 'unchanged' when the difference is 0 —
  // the second press of the same Deal. That is a landing, not a failure: the
  // budget already reads this number, so the couple must not be told to retry.
  for (const answer of ['unchanged', 'priced']) {
    const sink: { last: Captured } = { last: null };
    const outcome = await bookVendorAtChatLock(
      stubAuthed('contracted', 1, sink),
      stubAdmin(true, answer),
      ARGS,
    );
    assert.equal('priceLanded' in outcome && outcome.priceLanded, true, `'${answer}' must read as landed`);
  }
});

test('a FIRST lock still books at the negotiated total and reports the landing', async () => {
  const sink: { last: Captured } = { last: null };
  const outcome = await bookVendorAtChatLock(stubAuthed('considering', 1, sink), stubAdmin(true), ARGS);

  assert.equal(outcome.status, 'booked');
  assert.equal('priceLanded' in outcome && outcome.priceLanded, true);
  assert.equal(sink.last!.payload.total_cost_php, 85_000);
  assert.equal(
    sink.last!.payload.status,
    'contracted',
    'The unbooked path must still BOOK — repricing must not have swallowed it.',
  );
});

test('lockDeal refuses to stamp a Deal whose price did not land', () => {
  const src = stripComments(readFileSync(ACTIONS, 'utf8'));

  // Anchor first, so a rename cannot pass this vacuously.
  assert.equal(
    (src.match(/export async function lockDeal\b/g) ?? []).length,
    1,
    'lockDeal is gone — this guard is blind. Re-anchor it.',
  );
  assert.equal(
    (src.match(/'priceLanded' in outcome && !outcome\.priceLanded/g) ?? []).length,
    1,
    'lockDeal no longer refuses on a price that did not land. Without it the card ' +
      'says "Deal locked — price frozen" while /budget still shows the old figure — ' +
      'the exact defect this file was written to close.',
  );
  // The refusal must come BEFORE the stamp/freeze, or it refuses nothing.
  const guardAt = src.indexOf("'priceLanded' in outcome");
  const stampAt = src.indexOf('agreed_price_centavos');
  assert.ok(guardAt > 0 && stampAt > 0, 'Both anchors must exist for the ordering check to mean anything.');
  assert.ok(
    guardAt < stampAt,
    'The priceLanded refusal sits AFTER the thread price freeze, so the Deal is ' +
      'already stamped by the time it fires. Move it above the freeze.',
  );
});
