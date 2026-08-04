/**
 * Guard: the vendor inbox is UNGATED — every vendor can receive and answer a
 * couple inquiry with no tier wall and no weekly cap ("your inbox is never
 * locked", owner 2026-07-24) — AND ungating the inbox must NOT remove the
 * couple-side spam protection.
 *
 * The unit-test harness has no database, so these invariants are asserted
 * STATICALLY on the source + SQL (the established pattern in this repo). Three
 * things must hold together:
 *
 *   1. The answer RPC the app uses (unlock_vendor_event_free) drops the two
 *      tier gates — TIER_FREE_NO_INAPP (free-tier block) and
 *      VERIFIED_WEEKLY_LIMIT (10/rolling-week) — while pinning the token cost to
 *      zero and keeping FORBIDDEN + idempotency.
 *   2. acceptInquiry routes UNCONDITIONALLY to that free variant (no
 *      tier-gated unlock_vendor_event, no launch flag), and the send/proposal
 *      paths no longer carry the FREE-tier ('tier_free') block.
 *   3. The couple-side spam gate (velocity caps in lib/inquiry-gate.ts) is still
 *      present — the ungate opens the vendor's answer path, it does not open a
 *      spam hole.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', '..', 'supabase', 'migrations');

/**
 * Strip comments so the assertions test CODE, not prose. Source-scan tests must
 * ignore the explanatory comments that describe the very gates we removed (both
 * the TS files and the free-variant migration keep a "we removed
 * TIER_FREE_NO_INAPP here" note) — otherwise a negative assertion trips on the
 * comment that documents the removal. Removes block comments plus line comments
 * beginning with the given marker (`//` for TS, `--` for SQL).
 */
function stripComments(text: string, lineMarker: '//' | '--'): string {
  const esc = lineMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (both TS and SQL)
    .replace(new RegExp(esc + '.*', 'g'), ''); // line comments to EOL
}

/** Comment-stripped source of a sibling lib file. */
const src = (name: string): string => stripComments(readFileSync(join(HERE, name), 'utf8'), '//');

/** The newest migration file (by sort-order prefix) that defines the given RPC. */
function newestMigrationDefining(re: RegExp): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 14-digit prefixes sort chronologically as strings
  for (let i = files.length - 1; i >= 0; i--) {
    const file = files[i];
    if (file === undefined) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (re.test(sql)) return { file, sql };
  }
  throw new Error(`No migration defines the RPC matching ${re}`);
}

/** Extract a plpgsql function body (from its CREATE to the closing $$), comment-stripped. */
function rpcBody(re: RegExp): { file: string; body: string } {
  const { file, sql } = newestMigrationDefining(re);
  const rest = sql.slice(sql.search(re));
  const open = rest.indexOf('$$');
  const close = rest.indexOf('$$', open + 2);
  assert.ok(open !== -1 && close !== -1, `Could not delimit the RPC body in ${file}`);
  return { file, body: stripComments(rest.slice(open + 2, close), '--') };
}

const DEFINES_FREE = /CREATE OR REPLACE FUNCTION\s+public\.unlock_vendor_event_free\s*\(/;

test('the answer RPC (unlock_vendor_event_free) drops both tier gates', () => {
  const { file, body } = rpcBody(DEFINES_FREE);

  // The free-tier block is GONE — a free vendor may answer.
  assert.ok(
    !/TIER_FREE_NO_INAPP/.test(body),
    `${file}: unlock_vendor_event_free must NOT raise TIER_FREE_NO_INAPP (free vendors can answer).`,
  );
  // The verified weekly cap is GONE — no 10/rolling-week wall.
  assert.ok(
    !/VERIFIED_WEEKLY_LIMIT/.test(body),
    `${file}: unlock_vendor_event_free must NOT raise VERIFIED_WEEKLY_LIMIT (no weekly cap).`,
  );
  // The answer is still free (token cost pinned to zero before the unlock row).
  assert.match(
    body,
    /v_tokens\s*:=\s*0\s*;/,
    `${file}: the answer token cost must be pinned to zero (v_tokens := 0;).`,
  );
  // The non-purchase invariants survive: answering-member ownership + idempotency.
  assert.match(body, /FORBIDDEN/, `${file}: the answering-member gate (FORBIDDEN) must be preserved.`);
  assert.match(
    body,
    /vendor_event_unlocks/,
    `${file}: the idempotent per-(vendor,event) unlock row must be preserved.`,
  );
});

test('acceptInquiry routes unconditionally to the ungated answer RPC', () => {
  const body = src('chat-actions.ts');
  assert.match(
    body,
    /rpc\(\s*['"]unlock_vendor_event_free['"]/,
    'chat-actions.ts: acceptInquiry must call unlock_vendor_event_free.',
  );
  // The tier-GATED variant must no longer be invoked on the accept path.
  assert.ok(
    !/rpc\(\s*['"]unlock_vendor_event['"]/.test(body),
    'chat-actions.ts: the tier-gated unlock_vendor_event must NOT be called (inbox is ungated).',
  );
  // No launch flag gating the ungate — it is the default, not a toggle.
  assert.ok(
    !/freeInquiryAcceptEnabled/.test(body),
    'chat-actions.ts: the ungate must be unconditional (no freeInquiryAcceptEnabled flag).',
  );
});

test('the send + proposal paths no longer carry the FREE-tier block', () => {
  for (const name of ['chat-send.ts', 'proposal-send.ts']) {
    const body = src(name);
    assert.ok(
      !/tierCaps\([^)]*\)\.chat\s*===\s*['"]none['"]/.test(body),
      `${name}: the FREE-tier messaging gate (tierCaps(...).chat === 'none') must be removed.`,
    );
  }
});

test('ungating the inbox did NOT remove couple-side spam protection', () => {
  const body = src('inquiry-gate.ts');
  // The velocity caps + master switch that blunt a bot/sock-puppet flood must
  // still exist — ungating the vendor answer path must not touch them.
  assert.match(body, /INQUIRY_DAILY_CAP/, 'inquiry-gate.ts: the daily inquiry cap must be preserved.');
  assert.match(
    body,
    /INQUIRY_CONCURRENT_OPEN_CAP/,
    'inquiry-gate.ts: the concurrent-open inquiry cap must be preserved.',
  );
  assert.match(
    body,
    /inquiryGateEnabled/,
    'inquiry-gate.ts: the spam-gate master switch must be preserved.',
  );
});
