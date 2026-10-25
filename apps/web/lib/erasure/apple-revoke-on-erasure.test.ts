/**
 * lib/erasure/apple-revoke-on-erasure.test.ts — ERASING AN ACCOUNT REVOKES ITS
 * SIGN IN WITH APPLE GRANT, AND SAYS WHAT HAPPENED.
 *
 * App Store Review Guideline 5.1.1(v); Apple-readiness check 2026-10-19 row 19
 * ("Nothing in apps/web or supabase/ calls appleid.apple.com/auth/revoke").
 *
 * Runs the REAL `eraseUserAccount` against a recording fake client, with the
 * revoke mocked through `ErasureIo.revokeAppleSignIn`, and pins the property,
 * not a phrasing:
 *   1. the revoke is asked for, for the person being erased;
 *   2. it is asked BEFORE the held-token row is deleted (after the delete there
 *      is nothing left to revoke with);
 *   3. every outcome except "never used Apple" lands in admin_audit_log —
 *      success as `apple_sign_in_revoked`, anything else as `erasure_step_failed`;
 *   4. a failed or THROWING revoke never stops the erasure — it still reaches
 *      the `user_erased` audit at the end.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eraseUserAccount, type ErasureAdminClient, type ErasureIo } from './purge';
import type { AppleRevokeOutcome } from '../apple-sign-in';

const USER = 'u0000000-0000-4000-8000-0000000000a1';
const ACTOR = 'u0000000-0000-4000-8000-0000000000b2';

type Insert = { table: string; row: Record<string, unknown> };

/** A chainable, thenable stand-in for supabase-js: every read is empty, every write succeeds. */
function makeAdmin(log: string[], inserts: Insert[]): ErasureAdminClient {
  const result = { data: null, error: null, count: 0 };
  function chain(table: string): unknown {
    const target = {
      then(resolve: (v: typeof result) => unknown) {
        return Promise.resolve(result).then(resolve);
      },
    };
    const proxy: unknown = new Proxy(target, {
      get(t, prop) {
        if (prop === 'then') return t.then;
        return (...args: unknown[]) => {
          if (prop === 'delete') log.push(`delete:${table}`);
          if (prop === 'update') log.push(`update:${table}`);
          if (prop === 'insert') {
            const rows = Array.isArray(args[0]) ? args[0] : [args[0]];
            for (const row of rows) inserts.push({ table, row: row as Record<string, unknown> });
          }
          return proxy;
        };
      },
    });
    return proxy;
  }
  const admin = {
    from: (table: string) => chain(table),
    rpc: async () => result,
    auth: { admin: { updateUserById: async () => ({ data: null, error: null }) } },
    storage: { from: () => chain('storage') },
  };
  return admin as unknown as ErasureAdminClient;
}

function makeIo(log: string[], revoke: (userId: string) => Promise<AppleRevokeOutcome>): ErasureIo {
  return {
    async deleteStoredAsset() {},
    async revokeAllSessions() {
      return { ok: true as const, sessionsRevoked: 1 };
    },
    async revokeAppleSignIn(userId: string) {
      log.push(`revoke-apple:${userId}`);
      return revoke(userId);
    },
    now: () => new Date('2026-10-19T00:00:00.000Z'),
  };
}

async function erase(revoke: (userId: string) => Promise<AppleRevokeOutcome>) {
  const log: string[] = [];
  const inserts: Insert[] = [];
  await eraseUserAccount(makeAdmin(log, inserts), USER, ACTOR, makeIo(log, revoke));
  const audit = inserts.filter((i) => i.table === 'admin_audit_log').map((i) => i.row);
  const appleRows = audit.filter(
    (r) => (r.metadata as { stage?: string } | undefined)?.stage === 'apple-sign-in-revoke',
  );
  return { log, audit, appleRows };
}

test('1+2 · the revoke is asked for the erased person, BEFORE the held-token row is deleted', async () => {
  const { log } = await erase(async () => ({ status: 'revoked', client: 'web' }));
  const revokeAt = log.indexOf(`revoke-apple:${USER}`);
  const deleteAt = log.indexOf('delete:apple_sign_in_tokens');
  assert.ok(revokeAt > -1, 'erasure never asked Apple to revoke the grant');
  assert.equal(log.filter((l) => l.startsWith('revoke-apple:')).length, 1, 'revoke once per erasure');
  assert.ok(deleteAt > -1, 'the held Apple token row is never deleted by erasure');
  assert.ok(revokeAt < deleteAt, 'the token row is deleted before the revoke could read it');
});

test('3 · a successful revoke is recorded as apple_sign_in_revoked', async () => {
  const { appleRows } = await erase(async () => ({ status: 'revoked', client: 'ios_app' }));
  assert.equal(appleRows.length, 1);
  assert.equal(appleRows[0]!.action, 'apple_sign_in_revoked');
  assert.equal(appleRows[0]!.target_id, USER);
  assert.deepEqual(appleRows[0]!.metadata, {
    stage: 'apple-sign-in-revoke',
    outcome: 'revoked',
    client: 'ios_app',
  });
});

test('3 · Apple refusing, no config, and no held token are each recorded as a failed step', async () => {
  const cases: Array<[AppleRevokeOutcome, Record<string, unknown>]> = [
    [
      { status: 'failed', client: 'web', httpStatus: 400, reason: 'invalid_client' },
      { outcome: 'failed', client: 'web', http_status: 400 },
    ],
    [
      { status: 'not_configured', client: 'web', missing: ['APPLE_SIGNIN_PRIVATE_KEY'] },
      { outcome: 'not_configured', client: 'web' },
    ],
    [{ status: 'no_token_held' }, { outcome: 'no_token_held' }],
  ];
  for (const [outcome, expected] of cases) {
    const { appleRows, audit } = await erase(async () => outcome);
    assert.equal(appleRows.length, 1, `${outcome.status} left no audit row`);
    assert.equal(appleRows[0]!.action, 'erasure_step_failed');
    const meta = appleRows[0]!.metadata as Record<string, unknown>;
    for (const [k, v] of Object.entries(expected)) assert.equal(meta[k], v, `${outcome.status}: ${k}`);
    assert.equal(typeof meta.message, 'string');
    assert.ok(audit.some((r) => r.action === 'user_erased'), `${outcome.status} stopped the erasure`);
  }
});

test('3 · an account that never used Apple leaves no Apple row at all', async () => {
  const { appleRows, audit } = await erase(async () => ({ status: 'not_apple_linked' }));
  assert.equal(appleRows.length, 0);
  assert.ok(audit.some((r) => r.action === 'user_erased'));
});

test('4 · a THROWING revoke is recorded and the erasure still finishes', async () => {
  const { appleRows, audit, log } = await erase(async () => {
    throw new Error('boom');
  });
  assert.equal(appleRows.length, 1);
  assert.equal(appleRows[0]!.action, 'erasure_step_failed');
  assert.equal((appleRows[0]!.metadata as Record<string, unknown>).outcome, 'failed');
  assert.ok(log.includes('delete:apple_sign_in_tokens'), 'the token row must still be deleted');
  assert.ok(audit.some((r) => r.action === 'user_erased'), 'a throwing revoke stopped the erasure');
});
