/**
 * Every predicate an RLS policy on `realtime.messages` names must be EXECUTE-able by
 * `authenticated` — DB verification (executed, not prose).
 *
 * ── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────────
 * No camera had ever put a picture on the Live Studio controller. The cause was not the
 * transport, the network, TURN, the streaming flag, or `panood_rtc_can_access` — that
 * predicate returned TRUE for the exact uid being refused. `authenticated` had simply
 * lost EXECUTE on `live_studio_guest_rtc_can_access`, the predicate behind a DIFFERENT
 * topic family's policies.
 *
 * 🔑 PRIVATE CHANNELS ALL SHARE ONE TABLE, SO THEY ALL SHARE ONE SET OF POLICIES.
 * Postgres OR-evaluates the permissive policies on a table, and a policy that RAISES is
 * not "this policy said no" — it fails the whole check. So one ungranted function in one
 * topic family refused `panood-rtc:` (Live Studio cameras), `panood-guest:` (guest pick)
 * and `call:` (1:1 calls) alike. Measured against prod 2026-09-01:
 *
 *     ERROR: 42501: permission denied for function live_studio_guest_rtc_can_access
 *
 * …raised while subscribing to a `panood-rtc:` topic.
 *
 * ── WHY NO EXISTING TEST CAUGHT IT ────────────────────────────────────────────
 * `panood-rtc-authz.db.test.ts`, `live-studio-guest-pick-authz.db.test.ts` and
 * `call-rtc-authorization.db.test.ts` each call their predicate directly, as the replay
 * owner. They prove the predicate's LOGIC and never the caller's PRIVILEGE, so all three
 * stayed green for the entire period in which none of the three transports could carry a
 * single frame. The policies themselves cannot be tested here: the replay harness has no
 * `realtime` schema, so every policy block is skipped by its own `to_regclass` guard.
 * The GRANT is the one half of the mechanism that IS replayed — so it is the half this
 * guards.
 *
 * ── AND WHY IT GUARDS THE CLASS ───────────────────────────────────────────────
 * The predicates are DISCOVERED from the migrations, never listed here. A fourth private
 * topic family added tomorrow is covered the day it lands, without anyone remembering
 * this file exists. That is deliberate: the grant was removed by a security sweep whose
 * own header warns that "fixing the instance in front of you and moving on is the
 * recurring defect", and it removed this one because a grep of `apps/` found no caller —
 * the caller being SQL, in another schema.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * Predicate names taken from the migrations that define the `realtime.messages` policies.
 *
 * Matches `public.<name>(realtime.topic())` — the shape every one of these policies uses,
 * in both its USING and its WITH CHECK arm. Read from the SQL rather than hard-coded so a
 * new topic family is covered automatically.
 */
async function predicatesNamedByRealtimePolicies(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'));
  const found = new Set<string>();
  for (const f of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
    // Only look at migrations that actually create a policy on realtime.messages, so a
    // migration merely mentioning a predicate in prose can't inflate the set.
    if (!/CREATE\s+POLICY[\s\S]{0,200}?ON\s+realtime\.messages/i.test(sql)) continue;
    for (const m of sql.matchAll(/public\.([a-z0-9_]+)\s*\(\s*realtime\.topic\(\)\s*\)/gi)) {
      found.add(m[1]!.toLowerCase());
    }
  }
  return [...found].sort();
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

test('the migrations do name predicates for realtime.messages policies', async () => {
  const names = await predicatesNamedByRealtimePolicies();
  // A zero-length list would make every assertion below vacuously true — the exact shape
  // of check that passes because it never ran.
  assert.ok(
    names.length >= 3,
    `expected at least the three known private-channel predicates, found ${names.length}: ${names.join(', ')}`,
  );
  assert.ok(
    names.includes('live_studio_guest_rtc_can_access'),
    `the predicate whose revoked grant broke all three transports must be discovered, got: ${names.join(', ')}`,
  );
});

test('every realtime.messages policy predicate exists after replay', async () => {
  const names = await predicatesNamedByRealtimePolicies();
  for (const name of names) {
    const r = await db.query<{ oid: string | null }>(
      `SELECT to_regprocedure('public.' || $1 || '(text)')::text AS oid`,
      [name],
    );
    assert.ok(
      r.rows[0]!.oid,
      `public.${name}(text) is named by a realtime.messages policy but does not exist`,
    );
  }
});

test('every realtime.messages policy predicate is EXECUTE-able by authenticated', async () => {
  const names = await predicatesNamedByRealtimePolicies();
  for (const name of names) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege('authenticated', 'public.' || $1 || '(text)', 'EXECUTE') AS ok`,
      [name],
    );
    assert.equal(
      r.rows[0]!.ok,
      true,
      `authenticated cannot EXECUTE public.${name}(text). Realtime evaluates EVERY permissive ` +
        `policy on realtime.messages as this role, and a policy that raises 42501 fails the ` +
        `whole authorization check — so this refuses EVERY private channel on the project, not ` +
        `just this predicate's own topic family. If a security sweep needs this closed, move the ` +
        `predicate out of the PostgREST-exposed schema; do not revoke the grant its policy runs on.`,
    );
  }
});
