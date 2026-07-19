/**
 * coordinatorMoneyScopeAllowed invariants (Node built-in test runner, run via
 * tsx — `pnpm test:unit`).
 *
 * Owner decision 2026-07-19 #5 — consent-SCOPED coordinator money authority:
 *   • Flag OFF → permissive (true) for everyone, no reads: flag-off behavior
 *     must equal today's membership-only guards EXACTLY.
 *   • Flag ON  → couple member always true;
 *                coordinator with un-revoked consent granting the scope → true;
 *                coordinator without the scope (missing row, '{}', other
 *                scope only, or revoked) → false;
 *                no live moderator row → false (fail-closed).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { coordinatorMoneyScopeAllowed } from './coordinator-money-scope';

const FLAG = 'NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED';
const originalFlag = process.env[FLAG];

beforeEach(() => {
  delete process.env[FLAG];
});
afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
});

type Row = Record<string, unknown>;

/**
 * Minimal Supabase stub. The helper runs three query shapes:
 *   from('event_members')…maybeSingle()                → { data: memberRow }
 *   await from('event_moderators')…is()                → { data: moderatorRows }
 *   await from('coordinator_access_consents')…is()     → { data: consentRows }
 * Each builder method chains; the terminal is either .maybeSingle() or the
 * thenable builder itself. Tables are dispatched by the from() argument, and
 * every from() call is recorded so tests can assert the flag-off path never
 * touches the database.
 */
function makeAdmin(config: {
  member?: Row | null;
  moderators?: Row[] | null;
  consents?: Row[] | null;
  memberError?: { message: string } | null;
}) {
  const tablesQueried: string[] = [];
  function builderFor(table: string) {
    const listResult =
      table === 'event_moderators'
        ? { data: config.moderators ?? null, error: null }
        : { data: config.consents ?? null, error: null };
    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      in() {
        return builder;
      },
      is() {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve({
          data: config.member ?? null,
          error: config.memberError ?? null,
        });
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(listResult).then(resolve);
      },
    };
    return builder;
  }
  const client = {
    from(table: string) {
      tablesQueried.push(table);
      return builderFor(table);
    },
  };
  return { admin: client as unknown as SupabaseClient, tablesQueried };
}

const EVENT = 'evt-1';
const USER = 'user-1';

test('flag OFF → permissive for anyone, and no DB reads at all', async () => {
  // Flag unset (default) — even a caller with no membership must pass, because
  // flag-off behavior is exactly today's (membership guards upstream only).
  const { admin, tablesQueried } = makeAdmin({ member: null, moderators: [] });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    true,
  );
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    true,
  );
  assert.deepEqual(tablesQueried, []);
});

test('flag ON → couple member is always allowed (both scopes)', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({ member: { member_type: 'couple' } });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    true,
  );
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    true,
  );
});

test('flag ON → coordinator WITHOUT any consent row is denied', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('flag ON → coordinator with consent granting the scope is allowed', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: { vendor_lock: false, checkout: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    true,
  );
  // …but NOT the scope that wasn't granted.
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('flag ON → empty "{}" scopes (pre-toggle consent rows) grant nothing', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: {} }],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    false,
  );
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('flag ON → revoked consent is denied (query filters revoked_at)', async () => {
  process.env[FLAG] = 'true';
  // The helper filters `.is('revoked_at', null)` server-side — a revoked-only
  // history surfaces as zero rows here, which must deny.
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('flag ON → no live moderator row → denied (fail-closed)', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'guest' },
    moderators: [],
    consents: [{ scopes: { checkout: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('flag ON → non-boolean / stringly scope values do not grant', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: { checkout: 'true' } }, { scopes: null }],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('flag ON → any one of several consent rows granting the scope suffices', async () => {
  process.env[FLAG] = 'true';
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }, { moderator_id: 'mod-2' }],
    consents: [{ scopes: {} }, { scopes: { vendor_lock: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeAllowed(admin, EVENT, USER, 'vendor_lock'),
    true,
  );
});
