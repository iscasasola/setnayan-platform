/**
 * coordinatorMoneyScopeGranted invariants (Node built-in test runner, run via
 * tsx — `pnpm test:unit`).
 *
 * Owner decision 2026-07-19 #5 — consent-SCOPED coordinator money authority.
 * `coordinatorMoneyScopeGranted` is the gate-free core (assumes the
 * `coordinator_consent_money` Data Privacy control is active); the public
 * `coordinatorMoneyScopeAllowed` wraps it with a one-line control check and is
 * not unit-tested here (the control is DB-backed). The core resolves:
 *   • couple member → always true;
 *   • coordinator with un-revoked consent granting the scope → true;
 *   • coordinator without the scope (missing row, '{}', other scope only, or
 *     revoked) → false;
 *   • no live moderator row / unknown caller → false (fail-closed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { coordinatorMoneyScopeGranted } from './coordinator-money-scope';

type Row = Record<string, unknown>;

/**
 * Minimal Supabase stub. The core runs three query shapes:
 *   from('event_members')…maybeSingle()                → { data: memberRow }
 *   await from('event_moderators')…is()                → { data: moderatorRows }
 *   await from('coordinator_access_consents')…is()     → { data: consentRows }
 * Each builder method chains; the terminal is either .maybeSingle() or the
 * thenable builder itself. Tables are dispatched by the from() argument.
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

test('couple member is always allowed (both scopes)', async () => {
  const { admin } = makeAdmin({ member: { member_type: 'couple' } });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    true,
  );
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    true,
  );
});

test('unknown caller (no member, no moderator) → denied (fail-closed)', async () => {
  const { admin } = makeAdmin({ member: null, moderators: [] });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    false,
  );
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('coordinator WITHOUT any consent row is denied', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('coordinator with consent granting the scope is allowed', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: { vendor_lock: false, checkout: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    true,
  );
  // …but NOT the scope that wasn't granted.
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('empty "{}" scopes (pre-toggle consent rows) grant nothing', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: {} }],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    false,
  );
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('revoked consent is denied (query filters revoked_at → zero rows)', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    false,
  );
});

test('no live moderator row → denied (fail-closed)', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'guest' },
    moderators: [],
    consents: [{ scopes: { checkout: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('non-boolean / stringly scope values do not grant', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }],
    consents: [{ scopes: { checkout: 'true' } }, { scopes: null }],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'),
    false,
  );
});

test('any one of several consent rows granting the scope suffices', async () => {
  const { admin } = makeAdmin({
    member: { member_type: 'coordinator' },
    moderators: [{ moderator_id: 'mod-1' }, { moderator_id: 'mod-2' }],
    consents: [{ scopes: {} }, { scopes: { vendor_lock: true } }],
  });
  assert.equal(
    await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'vendor_lock'),
    true,
  );
});
