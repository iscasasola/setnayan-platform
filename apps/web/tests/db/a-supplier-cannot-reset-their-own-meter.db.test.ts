/**
 * A SUPPLIER OWNS THE ROW, NEVER THE VERDICT.
 *
 * 🚨 TWO HOLES IN ONE POLICY. `vendor_papic_captures_vendor_update` is FOR
 * UPDATE with USING and WITH CHECK that both ask ONE question — *is this row on
 * a profile you own?* — and constrain NO COLUMN. In production `authenticated`
 * holds UPDATE on ALL 23 columns, `hidden_at` and `nsfw_checked` included.
 *
 *   1. **Unlimited free shots.** `fetchVendorPapicPointsSpent` tallies spend as
 *      the captures `WHERE hidden_at IS NULL`. PATCH `hidden_at` onto your own
 *      rows and your spent count returns to ZERO — shoot the whole allowance
 *      again, repeatably, with no error anywhere.
 *   2. **An unscreened file reaching the couple.** `..._member_read` shows a
 *      capture only when `nsfw_checked = true`, and the same UPDATE lets the
 *      supplier set it. The safety screen is not the control if the uploader
 *      owns its verdict.
 *
 * 🔑 THE ROW IS YOURS, THE FIELD IS NOT — the eighth instance of this shape in
 * this schema (DECISION_LOG 2026-08-12, eight PRs, incl. #4366 where an
 * uploader could pre-mark a photo `clean` so the screen never ran).
 *
 * ⚠ THE TESTS BELOW ASSERT THE VALUE READS BACK SAFE, NOT THAT THE WRITE
 * THREW. A pin does not refuse — it overwrites. And on a table whose column
 * DEFAULT is already the safe value, "the forgery was refused" proves nothing:
 * assert that a row naming nothing reads back safe, AND that a row naming the
 * dangerous value reads back safe anyway.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * The body of the function AS THE DATABASE INSTALLED IT after replay — not the
 * migration file's text. Reading the file would pass even if the migration
 * never applied; `pg_get_functiondef` can only answer if the object exists.
 *
 * ⚠ These are assertions about the RULE, not about an attempted forgery.
 * Seeding a real capture drags in a booked vendor, an event and an order, and a
 * PIN DOES NOT REFUSE — it overwrites — so `assert.rejects` would be the wrong
 * shape anyway (RLS returns zero rows rather than throwing; that mistake is
 * recorded in DECISION_LOG 2026-08-20/21). The behavioural half belongs with
 * the vendor-capture fixtures when that lane leaves the DPO flag.
 */
async function installedBody(): Promise<string> {
  const r = await db.query<{ src: string }>(
    `SELECT pg_get_functiondef('public.tg_pin_vendor_capture_verdict()'::regprocedure) AS src`,
  );
  return r.rows[0]!.src;
}

/**
 * The body with SQL comments removed.
 *
 * 🪤 THE GUARD READ ITS OWN EXPLANATION AND WENT RED. The function carries a
 * comment saying *"current_user, NOT auth.role() … every `auth.role() IS NULL`
 * privileged branch is DEAD CODE"* — and the rule below bans exactly that
 * string. The body was correct; the assertion was matching prose.
 *
 * This repo has now paid for the same shape three times (a contrast guard that
 * fired on the comment explaining the fix; a naming census that matched its own
 * ban list). **Strip comments before matching, every time.**
 */
async function installedCode(): Promise<string> {
  return (await installedBody()).replace(/--[^\n]*/g, ' ');
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the trigger exists at all — or every rule below is vacuous', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgrelid = 'public.vendor_papic_captures'::regclass
        AND tgname = 'pin_vendor_capture_verdict'`,
  );
  assert.equal(r.rows[0]?.n, 1, 'the pin trigger is gone from vendor_papic_captures');
});

test('the trigger fires on BOTH verbs — an UPDATE-only pin is half a fix', async () => {
  // A guard is only as wide as the verbs it fires on. #4361 was a correct guard
  // attached BEFORE UPDATE only: update-yourself-to-admin was reverted, and
  // delete-then-reinsert-as-admin sailed through.
  const r = await db.query<{ ins: boolean; upd: boolean }>(
    `SELECT (tgtype & 4) <> 0 AS ins, (tgtype & 16) <> 0 AS upd
       FROM pg_trigger
      WHERE tgrelid = 'public.vendor_papic_captures'::regclass
        AND tgname = 'pin_vendor_capture_verdict'`,
  );
  assert.equal(r.rows[0]?.ins, true, 'the pin no longer fires on INSERT');
  assert.equal(r.rows[0]?.upd, true, 'the pin no longer fires on UPDATE');
});

test('🚨 an unprivileged INSERT cannot arrive pre-screened or pre-hidden', async () => {
  const src = await installedBody();
  assert.match(
    src,
    /TG_OP = 'INSERT'[\s\S]*?NEW\.nsfw_checked := false/,
    'INSERT no longer forces nsfw_checked false — a supplier could insert a row already marked screened, and member_read trusts that flag',
  );
  assert.match(
    src,
    /TG_OP = 'INSERT'[\s\S]*?NEW\.hidden_at := NULL/,
    'INSERT no longer forces hidden_at NULL — a row could arrive pre-hidden and never count against the meter',
  );
});

test('🚨 an unprivileged UPDATE cannot move either field', async () => {
  const src = await installedBody();
  assert.match(
    src,
    /NEW\.nsfw_checked := OLD\.nsfw_checked/,
    'nsfw_checked is no longer pinned on UPDATE — a supplier can mark their own file screened, and member_read trusts that flag',
  );
  assert.match(
    src,
    /NEW\.hidden_at := OLD\.hidden_at/,
    'hidden_at is no longer pinned on UPDATE — a supplier can reset their own spent-points meter and shoot the allowance again',
  );
});

test('🚨 privilege is derived from current_user, never auth.role()', async () => {
  const src = await installedCode();
  assert.match(
    src,
    /current_user NOT IN \('authenticated', 'anon'\)/,
    'the privileged branch moved off current_user',
  );
  assert.ok(
    !/auth\.role\(\)\s+IS\s+NULL/.test(src),
    'the privileged branch is keyed on `auth.role() IS NULL` — the replay shim returns \'anon\' where production returns NULL, so that branch is DEAD CODE in every db test in this repo and the guard would pass while protecting nothing',
  );
});

test('the service role is still the decider — the screen must be able to write its verdict', async () => {
  assert.match(
    await installedBody(),
    /IF current_user NOT IN \('authenticated', 'anon'\) THEN[\s\S]{0,80}RETURN NEW/,
    'the privileged early-return is gone — the post-screen verdict update runs on the service role and would now be pinned too, leaving every capture unscreened forever',
  );
});
