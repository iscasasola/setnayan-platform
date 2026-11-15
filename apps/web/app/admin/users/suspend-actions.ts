'use server';

/**
 * Suspend / Unsuspend a person's account — the admin actions (owner 2026-11-13, "Yes, add both"; specs DECISION_LOG
 * "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN CONTENTS"; prototype people.html `cfm-suspend-person` ·
 * `date-suspend` · `cfm-unsuspend-person`). The work is in `lib/account-suspension.server.ts`; this file only gates,
 * reads the form, audits and says what happened.
 *
 * ⚖ OPEN, flagged in the PR (not decided here): the drawing makes a suspension that touches MONEY (a payment
 * waiting, a payout owed, a refund open) one admin + 24 h, cancellable from Work. That waits on the builder panel's
 * item A (`run_after` on approvals), another slice. Until then a suspension starts at once, with Unsuspend + Undo.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import {
  isSuspendDuration,
  isSuspendReason,
  suspendUntilFor,
} from '@/lib/account-suspension';
import { liftSuspensionNow, suspendAccountNow } from '@/lib/account-suspension.server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(userId: string, params: Record<string, string>): never {
  redirect(`/admin/users/${userId}?${new URLSearchParams(params).toString()}`);
}

async function audit(
  action: string,
  args: { targetId: string; actor: string; reason?: string | null; metadata: Record<string, unknown> },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('admin_audit_log').insert({
    action,
    target_id: args.targetId,
    actor_user_id: args.actor,
    reason: args.reason ?? null,
    metadata: args.metadata,
  });
  if (error) console.error(`[${action}] audit insert failed (non-fatal)`, error.message);
}

/** Suspend… — reason · until (7 days · 30 days · until lifted) · a note for admins that the person never sees. */
async function suspendAccount(formData: FormData): Promise<void> {
  const { userId: adminUserId } = await requireAdminAction();
  const userId = String(formData.get('user_id') ?? '');
  if (!UUID.test(userId)) throw new Error('Invalid account');
  if (userId === adminUserId) back(userId, { suspend_error: 'You can’t suspend your own account.' });

  const reason = formData.get('reason');
  const duration = formData.get('duration');
  const noteRaw = formData.get('note');
  const note = typeof noteRaw === 'string' ? noteRaw.trim().slice(0, 2000) : '';
  if (!isSuspendReason(reason)) back(userId, { suspend_error: 'Pick a reason.' });
  if (!isSuspendDuration(duration)) back(userId, { suspend_error: 'Pick how long.' });

  const now = new Date();
  const until = suspendUntilFor(duration, now);
  const admin = createAdminClient();
  const result = await suspendAccountNow(admin, { userId, reason, until, now });
  if (!result.ok) back(userId, { suspend_error: result.message });

  await audit('user_suspended', {
    targetId: userId,
    actor: adminUserId,
    reason,
    metadata: {
      until: until?.toISOString() ?? null,
      duration,
      note: note || null,
      shops_suspended: result.shops,
      sessions_revoked: result.sessionsRevoked,
    },
  });

  revalidatePath('/admin/accounts');
  revalidatePath(`/admin/users/${userId}`);
  back(userId, { suspended: '1' });
}

/** Unsuspend — lifts the hold now; the page then offers Undo with the hold it just lifted. */
async function unsuspendAccount(formData: FormData): Promise<void> {
  const { userId: adminUserId } = await requireAdminAction();
  const userId = String(formData.get('user_id') ?? '');
  if (!UUID.test(userId)) throw new Error('Invalid account');

  const admin = createAdminClient();
  const result = await liftSuspensionNow(admin, userId);
  if (!result.ok) back(userId, { suspend_error: result.message });

  await audit('user_unsuspended', {
    targetId: userId,
    actor: adminUserId,
    reason: result.wasReason,
    metadata: { was_until: result.wasUntil, shops_lifted: result.shops },
  });

  revalidatePath('/admin/accounts');
  revalidatePath(`/admin/users/${userId}`);
  // Undo carries the hold it lifted: the same reason and the same Until (or "until lifted").
  back(userId, {
    unsuspended: '1',
    undo_reason: result.wasReason ?? '',
    undo_until: result.wasUntil ?? 'lifted',
  });
}

/**
 * Undo an Unsuspend — puts the SAME hold back (its reason, its Until). An Until that has passed in the meantime is
 * not re-applied; the admin is told to suspend afresh instead of the hold silently becoming "until lifted".
 */
async function undoUnsuspend(formData: FormData): Promise<void> {
  const { userId: adminUserId } = await requireAdminAction();
  const userId = String(formData.get('user_id') ?? '');
  if (!UUID.test(userId)) throw new Error('Invalid account');
  const reason = formData.get('reason');
  const untilRaw = String(formData.get('until') ?? '');
  if (!isSuspendReason(reason)) back(userId, { suspend_error: 'Nothing to undo — suspend them again with Suspend….' });

  const now = new Date();
  let until: Date | null = null;
  if (untilRaw !== 'lifted') {
    const t = new Date(untilRaw);
    if (Number.isNaN(t.getTime()) || t.getTime() <= now.getTime()) {
      back(userId, { suspend_error: 'That hold’s Until date has passed — use Suspend… to start a new one.' });
    }
    until = t;
  }

  const admin = createAdminClient();
  const result = await suspendAccountNow(admin, { userId, reason, until, now });
  if (!result.ok) back(userId, { suspend_error: result.message });

  await audit('user_suspended', {
    targetId: userId,
    actor: adminUserId,
    reason,
    metadata: { until: until?.toISOString() ?? null, undo_of_unsuspend: true, shops_suspended: result.shops },
  });

  revalidatePath('/admin/accounts');
  revalidatePath(`/admin/users/${userId}`);
  back(userId, { suspended: '1' });
}

/**
 * THE ONE EXPORT (one Vercel route — lint-server-action-budget): `op=suspend` · `op=unsuspend` · `op=undo`.
 */
export async function accountHold(formData: FormData): Promise<void> {
  const op = String(formData.get('op') ?? '');
  if (op === 'suspend') return suspendAccount(formData);
  if (op === 'unsuspend') return unsuspendAccount(formData);
  if (op === 'undo') return undoUnsuspend(formData);
  throw new Error('Unknown account hold action');
}
