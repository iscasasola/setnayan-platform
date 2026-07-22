/**
 * Guard: answering a vendor inquiry must not require a PURCHASABLE token.
 *
 * The vendor token packs are retired (migration
 * 20270910266901_retire_vendor_token_packs). Before that, the live accept path
 * (chat-actions.ts `acceptInquiry` → the `unlock_vendor_event` RPC) burned 1-3
 * region-banded tokens per NEW (vendor,event) unlock and RAISED
 * `INSUFFICIENT_WALLET_BALANCES` (rolling the tx back) when the answering member
 * had no balance — which, with packs unsellable, could strand a token-less paid
 * vendor. Migration 20270909586177 neutralises that burn.
 *
 * The unit-test harness has no database, so this asserts the invariant
 * STATICALLY on the SQL: in the NEWEST migration that (re)defines
 * `unlock_vendor_event`, the token cost is pinned to zero before the unlock is
 * recorded, and the token-consuming branch is still guarded by `v_tokens > 0`.
 * Together those mean no `consume_*` runs on an answer, so
 * `INSUFFICIENT_WALLET_BALANCES` can never fire — a paid vendor with no
 * purchased tokens can always answer. If a future migration reintroduces a burn
 * on the answer without re-pinning the cost to zero, this test fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', '..', 'supabase', 'migrations');

const DEFINES_RPC = /CREATE OR REPLACE FUNCTION\s+public\.unlock_vendor_event\s*\(/;

/** The newest migration file (by sort-order prefix) that defines the RPC. */
function newestUnlockVendorEventMigration(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 14-digit prefixes sort chronologically as strings
  for (let i = files.length - 1; i >= 0; i--) {
    const file = files[i];
    if (file === undefined) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (DEFINES_RPC.test(sql)) return { file, sql };
  }
  throw new Error('No migration defines public.unlock_vendor_event');
}

/** Extract the newest unlock_vendor_event body (from its CREATE to the closing $$). */
function newestRpcBody(): { file: string; body: string } {
  const { file, sql } = newestUnlockVendorEventMigration();
  const start = sql.search(DEFINES_RPC);
  const rest = sql.slice(start);
  // The function body is delimited by `AS $$ … $$`.
  const open = rest.indexOf('$$');
  const close = rest.indexOf('$$', open + 2);
  assert.ok(open !== -1 && close !== -1, `Could not delimit the RPC body in ${file}`);
  return { file, body: rest.slice(open + 2, close) };
}

test('the live unlock_vendor_event pins the answer cost to zero (free answer)', () => {
  const { file, body } = newestRpcBody();

  // The cost is forced to 0 for the answer.
  assert.match(
    body,
    /v_tokens\s*:=\s*0\s*;/,
    `${file}: expected the answer token cost to be pinned to zero (v_tokens := 0;).`,
  );

  // The token debit is still guarded by v_tokens > 0, so with the cost pinned to
  // zero it is unreachable on an answer.
  assert.match(
    body,
    /IF\s+v_paid\s+AND\s+v_tokens\s*>\s*0\s+THEN/,
    `${file}: expected the consume_* debit to stay guarded by "IF v_paid AND v_tokens > 0".`,
  );

  // The zeroing must land BEFORE the unlock is recorded (so the recorded
  // tokens_burned is 0 and the debit block below sees v_tokens = 0).
  const zeroAt = body.search(/v_tokens\s*:=\s*0\s*;/g);
  const insertAt = body.indexOf('INSERT INTO public.vendor_event_unlocks');
  const guardAt = body.search(/IF\s+v_paid\s+AND\s+v_tokens\s*>\s*0\s+THEN/);
  assert.ok(insertAt !== -1, `${file}: could not find the vendor_event_unlocks INSERT.`);
  assert.ok(
    zeroAt !== -1 && zeroAt < insertAt && zeroAt < guardAt,
    `${file}: the "v_tokens := 0;" pin must precede both the unlock INSERT and the debit guard.`,
  );
});

test('answering keeps its non-purchase gates (free-tier block preserved)', () => {
  const { file, body } = newestRpcBody();
  // Making the answer free must NOT open it to unverified/free vendors: the
  // tier gate stays. (The verified 10/week throttle is a tier limit, not a
  // purchase gate, and is intentionally retained.)
  assert.match(
    body,
    /TIER_FREE_NO_INAPP/,
    `${file}: the free-tier block (TIER_FREE_NO_INAPP) must be preserved.`,
  );
});
