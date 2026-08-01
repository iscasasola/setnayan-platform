/**
 * The anon RPC surface cannot grow without somebody saying why.
 *
 * ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
 * The platform's security work audits ROW-LEVEL SECURITY policies. It emerged
 * on 2026-08-01 that the guest-facing surface largely does not go through RLS
 * at all: guests read their seat through SECURITY DEFINER functions while the
 * underlying tables grant `anon` nothing. A policy audit therefore CANNOT see
 * this class — it concludes "anon cannot read this table", which is true about
 * the table and false about the product.
 *
 * A sweep found 211 anon-EXECUTE-able SECURITY DEFINER functions. Seven were
 * closed by migration 20271028837115, including one that DELETES chat threads
 * and one that MINTS vendor tokens, both reachable with nothing but the
 * publishable key that ships in the public JavaScript bundle.
 *
 * ── WHY A ONE-OFF REVOKE WAS NOT ENOUGH ────────────────────────────────────
 * Several of those functions ALREADY had a REVOKE in their defining migration.
 * It did not last: a later `CREATE OR REPLACE` in a different migration
 * re-applied Supabase's default privileges, and nothing re-asserted the revoke.
 * A REVOKE is a point-in-time act. Without this test the same seven would drift
 * back open the next time somebody edited a body, and CI would stay green.
 *
 * ── HOW IT WORKS ───────────────────────────────────────────────────────────
 * Same shape as `ugat-concept.baseline.txt`: the surface is DERIVED from the
 * live catalog, and every member must appear in a baseline file with a written
 * reason. Adding a function to the baseline is allowed — that is the point.
 * Adding one SILENTLY is not.
 *
 * ⚠ ANON-CALLABLE IS NOT AUTOMATICALLY A BUG. This product deliberately gates
 * guests on secret tokens rather than sessions — a guest has no account, and an
 * unguessable QR/claim token IS the credential. `public_seat_lookup` SHOULD be
 * anon-callable. The baseline exists to record which ones are deliberate, not
 * to drive the count to zero.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const BASELINE = path.join(__dirname, 'anon-rpc-surface.baseline.txt');

/** `<function name> | <reason>` — blank lines and `#` comments ignored. */
function readBaseline(): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(BASELINE)) return out;
  for (const raw of fs.readFileSync(BASELINE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [fn, ...rest] = line.split('|');
    out.set((fn ?? '').trim(), rest.join('|').trim());
  }
  return out;
}

async function anonCallableSecdef(): Promise<string[]> {
  const { rows } = await db.query<{ proname: string }>(`
    SELECT DISTINCT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.prosecdef
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
     ORDER BY p.proname
  `);
  return rows.map((r) => r.proname);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · the replay actually has anon and some SECURITY DEFINER functions', async () => {
  // Anti-vacuity. If `anon` did not exist in the replay, has_function_privilege
  // would throw or the set would be empty and every assertion below would pass
  // for the wrong reason.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_roles WHERE rolname = 'anon'`,
  );
  assert.equal(rows[0]?.n, 1, 'the anon role is missing from the replay');

  const { rows: sd } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc p
       JOIN pg_namespace n2 ON n2.oid = p.pronamespace AND n2.nspname = 'public'
      WHERE p.prosecdef`,
  );
  assert.ok((sd[0]?.n ?? 0) > 50, 'suspiciously few SECURITY DEFINER functions — the replay looks wrong');
});

test('the seven closed on 2026-08-01 are still closed to anon', async () => {
  // These are named individually, not left to the baseline, because each was a
  // real finding. A regression here is not "the surface grew" — it is one of
  // these specific holes reopening.
  const closed = [
    'purge_expired_chat',
    'claim_unlock_vendor_event',
    'subscriptions_due_for_renewal_reminder',
    'papic_event_pool_status',
    'papic_event_owns_service',
    'redeem_vendor_token_voucher',
    'detect_self_review_signal',
  ];
  const live = new Set(await anonCallableSecdef());
  const reopened = closed.filter((fn) => live.has(fn));
  assert.deepEqual(
    reopened,
    [],
    `these were closed to anon and are open again: ${reopened.join(', ')}. A later CREATE OR REPLACE re-applies Supabase's default privileges — re-issue the REVOKE in the SAME migration that replaced the body.`,
  );
});

test('no NEW anon-callable SECURITY DEFINER function appears without a written reason', async () => {
  const live = await anonCallableSecdef();
  const baseline = readBaseline();
  const undeclared = live.filter((fn) => !baseline.has(fn));

  assert.deepEqual(
    undeclared,
    [],
    `${undeclared.length} SECURITY DEFINER function(s) are callable by ANY holder of the publishable key and are not declared:\n` +
      undeclared.map((f) => `  · ${f}`).join('\n') +
      `\n\nThis is not automatically a bug — the guest surface is deliberately token-gated, and a function guarded by an unguessable token SHOULD be here. But say so: add a line to tests/db/anon-rpc-surface.baseline.txt as\n` +
      `  ${undeclared[0] ?? '<fn>'} | <what actually gates it>\n` +
      `Before you do, read the body and answer one question: what stops an anonymous caller passing arguments of their choosing? "It is only called from our own server" is not an answer — the grant is what decides, not the caller.`,
  );
});

test('every baseline line names a function that still exists and is still anon-callable', async () => {
  // A stale line is worse than a missing one: it reads as considered when the
  // function is gone, and it hides the fact that the surface shrank.
  const live = new Set(await anonCallableSecdef());
  const stale = [...readBaseline().keys()].filter((fn) => !live.has(fn));
  assert.deepEqual(
    stale,
    [],
    `baseline lines for functions that are no longer anon-callable: ${stale.join(', ')}. Delete them.`,
  );
});

test('every baseline line carries a real reason, not a placeholder', async () => {
  const bad = [...readBaseline().entries()]
    .filter(([, reason]) => reason.length < 15 || /^(tbd|todo|\?+|n\/?a)$/i.test(reason))
    .map(([fn]) => fn);
  assert.deepEqual(bad, [], `baseline lines with no real reason: ${bad.join(', ')}`);
});
