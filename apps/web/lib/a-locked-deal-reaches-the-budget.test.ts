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
 * ── The fix, and why it is the price and not a budget line ──────────────────
 * `total_cost_php` is an ABSOLUTE write, so locking twice cannot double count,
 * and it is the column the budget already reads for an ordinary supplier. The
 * alternative — settling a delta into `event_vendor_line_items` — was measured
 * and REFUSED: it deletes a headline-billed supplier's price outright
 * (`a-settled-delta-must-not-erase-the-headline.test.ts`, −₱15,000 not ₱85,000).
 *
 * ⚠ THE FEE BASE MOVES WITH THE PRICE, BY OWNER DECISION (2026-09-09), not by
 * accident. `collectBookingFeeAtLock` reads `total_cost_php` when the VENDOR
 * ACKNOWLEDGES THE PAYMENT: before that the fee is charged on the renegotiated
 * price (what they actually booked at); after it the order is already minted and
 * idempotent, so nothing moves.
 *
 * 🔑 THE MEASUREMENT HAS TO REACH THE RENDER. Repricing alone would not have
 * been enough — every write that claims to record a price now reports whether
 * the row MATCHED (`priceLanded`), and `lockDeal` refuses to stamp the Deal when
 * it did not. A screen may not say "frozen" about a number that never landed.
 *
 * 🛡 Behaviour is driven through the real `bookVendorAtChatLock` against a
 * stubbed PostgREST client — the UPDATE payload is captured and asserted, not
 * inferred from the source.
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

/** Admin client: the verified pre-check reads `vendor_profiles`. */
function stubAdmin(verified: boolean) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = async () => ({
    data: { verification_state: verified ? 'verified' : 'unverified' },
    error: null,
  });
  return { from: () => b } as unknown as SupabaseClient;
}

const ARGS = {
  eventId: 'e1',
  eventVendorId: 'ev1',
  marketplaceVendorId: 'vp1',
  agreedTotalPhp: 85_000,
};

test('an ALREADY-BOOKED supplier is repriced to the agreed total', async () => {
  const sink: { last: Captured } = { last: null };
  const outcome = await bookVendorAtChatLock(stubAuthed('contracted', 1, sink), stubAdmin(true), ARGS);

  assert.equal(outcome.status, 'already_booked');
  assert.equal(
    'priceLanded' in outcome && outcome.priceLanded,
    true,
    'The reprice matched a row, so the couple may be told the price is frozen.',
  );
  assert.ok(sink.last, 'No UPDATE was issued at all — this is the pre-2026-09-09 defect returning.');
  assert.equal(sink.last!.table, 'event_vendors');
  assert.equal(
    sink.last!.payload.total_cost_php,
    85_000,
    'The agreed total must reach event_vendors.total_cost_php — the column /budget reads.',
  );
});

test('the reprice touches the PRICE and nothing else', async () => {
  const sink: { last: Captured } = { last: null };
  await bookVendorAtChatLock(stubAuthed('deposit_paid', 1, sink), stubAdmin(true), ARGS);

  // This row is already booked. A status flip, a first-pick stamp or a fee call
  // here would be a second booking path, which is exactly what the shared core
  // exists to prevent.
  for (const forbidden of ['status', 'selection_match_rank', 'linked_vendor_profile_id']) {
    assert.equal(
      forbidden in sink.last!.payload,
      false,
      `The already-booked reprice wrote '${forbidden}'. It may write the price and the timestamp, nothing else.`,
    );
  }
  assert.deepEqual(
    Object.keys(sink.last!.payload).sort(),
    ['total_cost_php', 'updated_at'],
    'Exactly two columns move on a reprice.',
  );
});

test('a reprice that matches NO row reports priceLanded:false — it never reads as success', async () => {
  const sink: { last: Captured } = { last: null };
  const outcome = await bookVendorAtChatLock(stubAuthed('complete', 0, sink), stubAdmin(true), ARGS);

  assert.equal(outcome.status, 'already_booked');
  assert.equal(
    'priceLanded' in outcome && outcome.priceLanded,
    false,
    'A zero-row UPDATE is reported as success by PostgREST. If this says true, the ' +
      'caller will stamp the Deal and tell the couple their price is frozen when it is not.',
  );
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
