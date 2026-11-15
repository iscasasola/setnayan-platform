import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { revokeAllSessions } from '@/lib/force-logout';
import { emitNotification } from '@/lib/notification-emit';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { ACCOUNT_SUSPENSION_LIFT_GAP_MS } from '@/lib/periodic-job-registry';
import { clearHomeShelf } from '@/lib/home-shelf-clear';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import type { SuspendReason } from '@/lib/account-suspension';
import {
  finishLiftWith,
  liftSuspensionWith,
  suspendAccountWith,
  type LiftResult,
  type LiftRow,
  type SuspendResult,
  type SuspensionIo,
} from '@/lib/account-suspension-flow';

/**
 * ACCOUNT SUSPEND — the server half (owner 2026-11-13, "Yes, add both"). The pure rules are in
 * `lib/account-suspension.ts`; the database half is `admin_suspend_account` / `admin_lift_account_suspension`
 * (migration 20271344061337), which stamp the person and suspend their shops in ONE transaction.
 *
 * ORDER, ON PURPOSE:
 *   suspend → (1) the database (it validates: internal, deleted, already on hold) → (2) the sign-in ban through the
 *             GoTrue ADMIN API (`updateUserById` ban_duration → auth.users.banned_until) → (3) every session revoked
 *             (`admin_revoke_user_sessions`) → (4) one in-app notice.
 *             If (2) fails the database half is lifted again and the admin is told — a person recorded as suspended
 *             who can still sign in is the exact defect this feature exists to close.
 *   lift    → (1) the database → (2) the ban set to `none` → (3) one in-app notice.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type { SuspendResult, LiftResult } from '@/lib/account-suspension-flow';

/** The real side effects behind the flow (lib/account-suspension-flow.ts holds the order and the rollbacks). */
function suspensionIo(admin: AdminClient): SuspensionIo {
  return {
    suspendInDb: async (args) => {
      const { data, error } = await admin.rpc('admin_suspend_account', {
        p_user_id: args.userId,
        p_until: args.until,
        p_reason: args.reason,
      });
      return { data, error: error ? error.message : null };
    },
    liftInDb: async (userId) => {
      const { data, error } = await admin.rpc('admin_lift_account_suspension', { p_user_id: userId });
      return { data, error: error ? error.message : null };
    },
    // GoTrue ADMIN API → auth.users.banned_until. This, not the database row, is what refuses the sign-in.
    ban: async (userId, duration) => {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration });
      return { error: error ? error.message : null };
    },
    revokeSessions: async (userId) => {
      const r = await revokeAllSessions(userId);
      return r.ok ? { sessionsRevoked: r.sessionsRevoked, error: null } : { sessionsRevoked: null, error: r.error };
    },
    notify: (userId, type, title, body) => emitNotification({ userId, type, title, body }),
    shopsChanged: (shopIds) => {
      if (shopIds.length === 0) return;
      // The home page remembers the shop shelf for 60 s — forget it now (lib/home-shelf-clear.ts), as the fraud desk does.
      clearHomeShelf('shops');
      for (const id of shopIds) revalidateShopPage(id);
    },
    log: (msg) => console.error(`[account-suspension] ${msg}`),
  };
}

/** Put an account on hold. Never throws; the admin action turns the result into words. */
export function suspendAccountNow(
  admin: AdminClient,
  args: { userId: string; reason: SuspendReason; until: Date | null; now: Date },
): Promise<SuspendResult> {
  return suspendAccountWith(suspensionIo(admin), args);
}

/** Lift a hold (by an admin). Never throws. */
export function liftSuspensionNow(admin: AdminClient, userId: string): Promise<LiftResult> {
  return liftSuspensionWith(suspensionIo(admin), userId);
}

/**
 * THE SELF-LIFT — every hold whose Until date has passed. Cron-free (`account-suspension-lift`, hourly), riding public
 * traffic with the daily jobs. Returns how many were lifted; a refused read throws so the run records a FAILURE, not 0.
 */
export async function runAccountSuspensionLift(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('lift_expired_account_suspensions');
  if (error) throw new Error(`lift_expired_account_suspensions failed: ${error.message}`);
  const rows = (data ?? []) as { lifted_user_id: string; lifted: LiftRow | null }[];
  const io = suspensionIo(admin);
  for (const r of rows) {
    // The database half is already lifted (the SQL did it); finish the ban, the notice and the shop pages.
    await finishLiftWith(io, r.lifted_user_id, r.lifted);
  }
  return rows.length;
}

export async function maybeRunAccountSuspensionLift(): Promise<void> {
  await runClaimedJob('account-suspension-lift', ACCOUNT_SUSPENSION_LIFT_GAP_MS, () => runAccountSuspensionLift());
}
