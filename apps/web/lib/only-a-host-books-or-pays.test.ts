/**
 * 🔒 ONLY A HOST BOOKS OR PAYS (owner 2026-11-21, *"no booking, no paying"* — DECISION_LOG "BOOKED COORDINATOR ON
 * BUILD: FIND + RECOMMEND + SHORTLIST, NO BOOKING, NO PAYING" · "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE
 * HOSTS', NOT LOGGABLE").
 *
 * Proves, on the SERVER rule every book and pay action asks (`coordinatorMoneyScopeAllowed`):
 *   • a host (`couple` member) is allowed, both acts;
 *   • a coordinator is REFUSED — even with a consent row that once granted the retired opt-in scopes;
 *   • a guest, a stranger, a failed read are refused (fail-closed: money);
 *   • the rule no longer hides behind the default-INACTIVE Data Privacy control;
 * and, by source, that every book / pay / log door still asks it — including the status flip INTO booked, which a
 * coordinator's `event_vendors_moderator_write` would otherwise allow.
 *
 * SABOTAGE (each turns this file red): return true for `member_type = 'coordinator'` · put back the
 * `isCoordinatorConsentGateEnabled()` short-circuit · drop the check from `updateVendorStatus` or any call site below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';

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

test('a host (couple member) books and pays', async () => {
  for (const scope of ['vendor_lock', 'checkout'] as const) {
    const { admin } = makeAdmin({ member: { member_type: 'couple' } });
    assert.equal(await coordinatorMoneyScopeGranted(admin, EVENT, USER, scope), true);
  }
});

test('the coordinator is refused BOTH — even holding a consent row that granted the retired scopes', async () => {
  for (const scope of ['vendor_lock', 'checkout'] as const) {
    const { admin, tablesQueried } = makeAdmin({
      member: { member_type: 'coordinator' },
      moderators: [{ moderator_id: 'mod-1' }],
      consents: [{ scopes: { vendor_lock: true, checkout: true } }],
    });
    assert.equal(await coordinatorMoneyScopeGranted(admin, EVENT, USER, scope), false);
    assert.deepEqual(tablesQueried, ['event_members'], 'the retired consent scopes are never read');
  }
});

test('a guest, a booked supplier, a stranger and a failed read are refused', async () => {
  for (const member of [{ member_type: 'guest' }, { member_type: 'vendor' }, null]) {
    const { admin } = makeAdmin({ member });
    assert.equal(await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'), false);
  }
  const { admin } = makeAdmin({ member: { member_type: 'couple' }, memberError: { message: 'boom' } });
  assert.equal(await coordinatorMoneyScopeGranted(admin, EVENT, USER, 'checkout'), false, 'a refused read is never a host');
  assert.equal(await coordinatorMoneyScopeGranted(admin, '', USER, 'checkout'), false);
  assert.equal(await coordinatorMoneyScopeGranted(admin, EVENT, '', 'checkout'), false);
});

const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('the rule answers on its own — no Data Privacy control short-circuits it to "allowed"', () => {
  // Comments removed: a guard that matches the comment explaining it cannot fail.
  const s = stripComments(src('lib/coordinator-money-scope.ts'));
  assert.doesNotMatch(s, /isCoordinatorConsentGateEnabled/, 'the default-INACTIVE control is back in front of the money rule');
  assert.doesNotMatch(s, /coordinator_access_consents/, 'the retired opt-in scopes are read again');
  assert.match(s, /member_type === 'couple'/);
});

test('every book / pay / log door asks the rule (server half)', () => {
  const doors: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/vendors/actions.ts', /coordinatorMoneyScopeAllowed\([\s\S]{0,120}'vendor_lock'/],
    ['app/dashboard/[eventId]/vendors/actions.ts', /coordinatorMoneyScopeAllowed\([\s\S]{0,120}'checkout'/],
    ['app/dashboard/[eventId]/orders/actions.ts', /coordinatorMoneyScopeAllowed\(/],
    ['app/dashboard/[eventId]/checkout/actions.ts', /coordinatorMoneyScopeAllowed\(/],
    ['app/pay/[reference]/actions.ts', /coordinatorMoneyScopeAllowed\(/],
    // Maya (card / wallet) is a pay door too — refused in the same words as the proof form.
    ['app/pay/[reference]/maya-start.ts', /coordinatorMoneyScopeAllowed\([\s\S]{0,400}if \(!allowed\) back\(ONLY_A_HOST_PAYS\)/],
    ['lib/iap/iap-actions.ts', /coordinatorMoneyScopeAllowed\(/],
  ];
  for (const [file, re] of doors) assert.match(src(file), re, `${file} no longer asks who may book or pay`);
});

test('the status flip INTO booked refuses a non-host (a coordinator may write event_vendors)', () => {
  const s = src('app/dashboard/[eventId]/vendors/actions.ts');
  const fn = s.slice(s.indexOf('async function updateVendorStatus'), s.indexOf('export async function deleteVendor'));
  assert.ok(fn.length > 0, 'updateVendorStatus moved');
  const check = fn.indexOf("coordinatorMoneyScopeAllowed(createAdminClient(), eventId, user.id, 'vendor_lock')");
  const write = fn.indexOf(".from('event_vendors')\n    .update(");
  assert.ok(check > 0, 'updateVendorStatus books without asking who may');
  assert.ok(write < 0 || check < write, 'the refusal must run BEFORE the status write');
  assert.match(fn, /throw new Error\(ONLY_A_HOST_BOOKS\)/);
});
