/**
 * ⭐ THE BROADCAST UNLOCK, END TO END (LS6 · owner-ruled 2026-09-02).
 *
 * lib/live-studio-window.test.ts proves the RULE (`decideBroadcastWindow`) against
 * a pure input. This file proves the WIRING: that `resolveBroadcastWindow` reads
 * ownership out of the database (via `eventSkuActive` — any route: order, bundle,
 * grant, promo) and hands it straight to the decision, and that `stampFirstLiveAt`
 * still records the informational "first go-live" fact correctly now that nothing
 * about entitlement depends on it.
 *
 * 🚫 RETIRED HERE: everything this file used to prove about the grant-kind
 * metering split (founder/comp/internal/promo, `resolveLiveStudioGrantKind`,
 * `classifyGrant` wiring) and the per-event-day anchor math (`foldWindowEnd`,
 * "buy Thu, wedding Sat" regression) — LS6 deleted the code these tests pinned,
 * so pinning it here would just be testing that deleted code stays deleted, which
 * `git grep` already proves better than a test can.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveBroadcastWindow, stampFirstLiveAt } from './live-studio-window-server';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolvePath(HERE, rel), 'utf8');

const EVENT = 'S89E-TESTEVENT1';

/* ══════════════════════════════════════════════════════════════════════════════
   A TABLE-AWARE Supabase stub. `eventSkuActive` fans out across several tables and
   RPCs (orders, bundle components, baskets, promo windows, comp grants, internal)
   — this models ONLY the `orders` route (paid/fulfilled rows), which is enough to
   drive `owned` true or false, and gracefully no-ops everything else so the other
   routes never accidentally contribute a spurious `true`.
   ══════════════════════════════════════════════════════════════════════════════ */

function stub(opts: { owned?: boolean; ordersError?: boolean; firstLiveAt?: string | null }) {
  const wrote: Array<Record<string, unknown>> = [];

  const table = (name: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      not: () => q,
      in: () => q,
      is: () => Promise.resolve({ error: null }),
      order: () => q,
      limit: () => q,
      upsert: () => Promise.resolve({ error: null }),
      update: (payload: Record<string, unknown>) => {
        if (name === 'panood_control_state' && 'first_live_at' in payload) wrote.push(payload);
        return q;
      },
      maybeSingle: () => {
        if (name === 'panood_control_state') {
          return Promise.resolve({
            data: { first_live_at: opts.firstLiveAt === undefined ? null : opts.firstLiveAt },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(onOk: (v: unknown) => unknown) {
        if (name === 'orders') {
          if (opts.ordersError) return Promise.resolve({ data: null, error: { code: 'XXXXX', message: 'boom' } }).then(onOk);
          const data = opts.owned ? [{ status: 'paid' }] : [];
          return Promise.resolve({ data, error: null }).then(onOk);
        }
        // Every other table (bundle components, baskets, ...) — empty, never grants.
        return Promise.resolve({ data: [], error: null }).then(onOk);
      },
    };
    return q;
  };

  const client = {
    from: (name: string) => table(name),
    // Comp grant / internal-account RPCs — always "no" so only `orders` drives `owned`.
    rpc: () => Promise.resolve({ data: false, error: null }),
  } as unknown as SupabaseClient;

  return { client, wrote };
}

/* ── resolveBroadcastWindow — ownership is the whole test ────────────────────── */

test('owned via a paid order ⇒ multiCam forever, no expiry', async () => {
  const { client } = stub({ owned: true });
  const d = await resolveBroadcastWindow(client, EVENT);
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'owned');
});

test('not owned ⇒ the free tier', async () => {
  const { client } = stub({ owned: false });
  const d = await resolveBroadcastWindow(client, EVENT);
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'not-owned');
});

test('FAIL-CLOSED — an erroring ownership read resolves to not-owned, never a free ₱2,500 unlock', async () => {
  const { client } = stub({ owned: true, ordersError: true });
  const d = await resolveBroadcastWindow(client, EVENT);
  assert.equal(d.multiCam, false, 'a database blip must never give away multi-cam');
  assert.equal(d.reason, 'not-owned');
});

test('a blank event id short-circuits to not-owned without querying', async () => {
  const { client } = stub({ owned: true }); // would resolve owned=true if it were queried
  const d = await resolveBroadcastWindow(client, '');
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'not-owned');
});

/* ── stampFirstLiveAt — still an informational stamp, still gated on ownership ── */

test('a FREE go-live does not stamp — the informational fact stays about a REAL broadcast', async () => {
  const { client, wrote } = stub({ owned: false });
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, []);
});

test('an OWNED go-live with no prior anchor DOES stamp', async () => {
  const { client, wrote } = stub({ owned: true });
  await stampFirstLiveAt(client, EVENT);
  assert.equal(wrote.length, 1);
  assert.ok(typeof wrote[0]?.first_live_at === 'string');
});

test('an already-anchored event is not re-stamped (write-once)', async () => {
  const { client, wrote } = stub({ owned: true, firstLiveAt: '2026-08-01T10:00:00.000Z' });
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, [], 'the anchor may never move, restart or extend');
});

test('FAIL-CLOSED on the write too — an unresolvable entitlement never stamps', async () => {
  const { client, wrote } = stub({ owned: true, ordersError: true });
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, []);
});

test('a blank event id is a no-op, not a throw', async () => {
  const { client, wrote } = stub({ owned: true });
  await stampFirstLiveAt(client, '');
  assert.deepEqual(wrote, []);
});

/* ── STRUCTURAL GUARDS — what the LS6 rewrite must have actually deleted ─────── */

test('the retired grant-kind and day-order machinery is gone from this module', () => {
  // stripComments FIRST — the module's own retirement docblock names these
  // symbols in prose ("🚫 RETIRED HERE (LS6): ... `resolveLiveStudioGrantKind` ...
  // are all gone"), and that explanatory mention must not itself trip the guard.
  const src = stripComments(read('./live-studio-window-server.ts'));
  for (const gone of [
    'resolveLiveStudioGrantKind',
    'fetchBroadcastDayStarts',
    'broadcastDaySkus',
    'fetchActiveBroadcast',
    'classifyGrant',
  ]) {
    assert.ok(!src.includes(gone), `${gone} should have been removed by LS6, but is still referenced`);
  }
});

test('resolveBroadcastWindow takes no isLive/broadcastStartedAt opts any more — nothing time-based left to feed it', () => {
  const src = read('./live-studio-window-server.ts');
  const fn = src.slice(
    src.indexOf('export async function resolveBroadcastWindow'),
    src.indexOf(') {', src.indexOf('export async function resolveBroadcastWindow')),
  );
  assert.doesNotMatch(fn, /isLive/, 'the signature must not still accept a liveness hint the decision no longer uses');
});

test('the stamp still asks before it writes, and the ask is `!entitled.multiCam`', () => {
  const src = read('live-studio-window-server.ts');
  const fn = src.slice(src.indexOf('export async function stampFirstLiveAt'));
  const askAt = fn.indexOf('resolveBroadcastWindow(supabase, eventId)');
  const writeAt = fn.indexOf('update({ first_live_at');
  assert.ok(askAt > -1, 'the stamp must resolve ownership before writing');
  assert.ok(writeAt > -1);
  assert.ok(askAt < writeAt, 'ownership must be asked BEFORE the write, not after');
  assert.match(fn, /if \(!entitled\.multiCam\) return;/);
});
