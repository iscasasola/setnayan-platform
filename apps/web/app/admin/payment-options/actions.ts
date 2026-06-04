'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ModerationStatus } from '@/lib/vendor-payment-methods';

/**
 * Server actions backing the admin "Payment options" moderation surface.
 *
 * Vendors publish their OWN off-platform payment destinations (bank details,
 * an uploaded QR, or a payment link) on `vendor_payment_methods`. Couples pay
 * them DIRECTLY — Setnayan never holds the money (RA 11967 non-party-publisher
 * posture). Admin moderation here is a FRAUD SCREEN only: approving a link or
 * QR does NOT make Setnayan the payment processor; it just confirms the
 * destination isn't an obvious scam before it surfaces to couples.
 *
 * Each action:
 *   1. requireAdmin() — single-admin authority per 0023 § 4.3.
 *   2. Flips vendor_payment_methods.moderation_status (+ moderation_note when
 *      provided + updated_at).
 *   3. Writes an admin_audit_log row (same column shape as verify/actions.ts).
 *   4. revalidatePath('/admin/payment-options').
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { adminUserId: user.id };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Shared moderation transition. Reads the row's current status for the audit
 * before/after snapshot, flips it, then logs. Idempotent no-op when the row is
 * already in the target status.
 */
async function transitionModeration(opts: {
  adminUserId: string;
  paymentMethodId: string;
  nextStatus: ModerationStatus;
  note: string | null;
  auditAction: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin
    .from('vendor_payment_methods')
    .select('payment_method_id, moderation_status')
    .eq('payment_method_id', opts.paymentMethodId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error('Payment method not found.');

  const before = existing.moderation_status as ModerationStatus;

  const updatePayload: Record<string, unknown> = {
    moderation_status: opts.nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (opts.note) {
    updatePayload.moderation_note = opts.note;
  }

  const { error: updErr } = await admin
    .from('vendor_payment_methods')
    .update(updatePayload)
    .eq('payment_method_id', opts.paymentMethodId);
  if (updErr) throw new Error(updErr.message);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: opts.auditAction,
    target_table: 'vendor_payment_methods',
    target_id: opts.paymentMethodId,
    before_json: { moderation_status: before },
    after_json: { moderation_status: opts.nextStatus },
    reason: opts.note,
    actor_user_id: opts.adminUserId,
  });
  if (auditErr) throw new Error(`audit log failed: ${auditErr.message}`);

  revalidatePath('/admin/payment-options');
}

export async function approvePaymentMethod(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const paymentMethodId = readFormString(formData, 'payment_method_id');
  if (!paymentMethodId) throw new Error('Missing payment_method_id.');

  await transitionModeration({
    adminUserId,
    paymentMethodId,
    nextStatus: 'approved',
    note: readFormString(formData, 'moderation_note') || null,
    auditAction: 'vendor_payment_method_approved',
  });
}

export async function holdPaymentMethod(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const paymentMethodId = readFormString(formData, 'payment_method_id');
  if (!paymentMethodId) throw new Error('Missing payment_method_id.');

  await transitionModeration({
    adminUserId,
    paymentMethodId,
    nextStatus: 'held',
    note: readFormString(formData, 'moderation_note') || null,
    auditAction: 'vendor_payment_method_held',
  });
}

export async function removePaymentMethod(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const paymentMethodId = readFormString(formData, 'payment_method_id');
  if (!paymentMethodId) throw new Error('Missing payment_method_id.');

  await transitionModeration({
    adminUserId,
    paymentMethodId,
    nextStatus: 'removed',
    note: readFormString(formData, 'moderation_note') || null,
    auditAction: 'vendor_payment_method_removed',
  });
}
