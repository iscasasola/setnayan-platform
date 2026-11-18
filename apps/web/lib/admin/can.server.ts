import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdminAction } from './require-admin';
import { isOwnerProfile } from './owner';
import { canWith, refusalFor, type AdminPowers, type AdminScopeRow } from './can';
import type { AdminArea, AdminLevel } from './areas';

/**
 * can(area, level) — the SERVER half. `requireAdminAction()` stays the gate
 * (isAdminProfile: who may open /admin at all); this reads what the caller may
 * DO, from `admin_scopes`, and the owner rule from lib/admin/owner.ts.
 *
 * Read with the service role, scoped to the session-proved user id — the same
 * pattern every admin action already uses after its gate. cache()'d so several
 * checks in one request cost one read.
 *
 * FAILS CLOSED: an unreadable scope list leaves `scopes: null`, and every
 * can() then says no with a sentence that says it could not read — never a
 * sentence that says "not your area" (a refusal must not look like a rule).
 */
export const getAdminPowersFor = cache(async (userId: string): Promise<AdminPowers> => {
  const admin = createAdminClient();
  const [meRes, scopesRes] = await Promise.all([
    admin.from('users').select('email, is_internal').eq('user_id', userId).maybeSingle(),
    admin.from('admin_scopes').select('area, level').eq('user_id', userId),
  ]);
  if (meRes.error) logQueryError('getAdminPowers.me', meRes.error, {}, 'graceful_degrade');
  if (scopesRes.error) logQueryError('getAdminPowers.scopes', scopesRes.error, {}, 'graceful_degrade');
  return {
    userId,
    isOwner: !meRes.error && isOwnerProfile(meRes.data),
    scopes: scopesRes.error ? null : ((scopesRes.data ?? []) as AdminScopeRow[]),
  };
});

/** The caller's powers (after the admin gate). */
export async function getMyAdminPowers(): Promise<AdminPowers> {
  const { userId } = await requireAdminAction();
  return getAdminPowersFor(userId);
}

/** Thrown by requireAdminCan — the message is the plain sentence to show. */
export class AdminAreaRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAreaRefusal';
  }
}

/**
 * The gate for one act: an admin AND allowed this area at this level. Use it at
 * the top of an action in place of `requireAdminAction()`; it returns the same
 * `{ userId }` plus the powers, and throws a plain refusal otherwise.
 */
export async function requireAdminCan(
  area: AdminArea,
  level: AdminLevel,
): Promise<{ userId: string; powers: AdminPowers }> {
  const powers = await getMyAdminPowers();
  if (!canWith(powers, area, level)) {
    throw new AdminAreaRefusal(refusalFor(powers, area, level));
  }
  return { userId: powers.userId, powers };
}
