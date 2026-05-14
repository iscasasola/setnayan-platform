'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';

/**
 * Server actions backing the admin Verification Queue. Single-admin authority
 * per 0023 § 4.3 — vendor verification approvals are routine operational
 * work and don't require the two-admin gate.
 *
 * State transitions are audit-logged into admin_audit_log with action
 * `vendor_visibility_change`, before/after JSON, and the actor user_id.
 *
 * See:
 *   • 0022_vendor_dashboard § 2.1c (state machine)
 *   • 0023_admin_console § 3.2 (verification queue) + § 4.3 (authority)
 *   • CLAUDE.md decision log 2026-05-15
 */

type AdminUser = { user_id: string };

async function requireAdmin(): Promise<AdminUser> {
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
  return { user_id: user.id };
}

/**
 * Set a vendor's `public_visibility` to the requested next state. Writes the
 * state-transition audit log row first; the visibility flip is a single
 * UPDATE that's safe to retry. The audit row carries before/after JSON so
 * the queue can be unwound if needed.
 */
async function transitionVendorVisibility(opts: {
  actor: AdminUser;
  vendorProfileId: string;
  nextVisibility: VendorPublicVisibility;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, public_visibility, business_name')
    .eq('vendor_profile_id', opts.vendorProfileId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Vendor not found.' };

  const before = parseVisibility(existing.public_visibility);
  if (before === opts.nextVisibility) {
    return { ok: true }; // idempotent no-op
  }

  // Audit-log the transition. Fire-and-forget would be wrong here — we want
  // the audit row written before the UPDATE so a partial failure leaves the
  // trail intact.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'vendor_visibility_change',
    target_table: 'vendor_profiles',
    target_id: opts.vendorProfileId,
    before_json: { public_visibility: before },
    after_json: { public_visibility: opts.nextVisibility },
    reason: opts.reason ?? null,
    actor_user_id: opts.actor.user_id,
  });
  if (auditErr) return { ok: false, error: `audit log failed: ${auditErr.message}` };

  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update({ public_visibility: opts.nextVisibility, updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', opts.vendorProfileId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Approve a vendor for the public marketplace. Flips `coming_soon` →
 * `verified`. Idempotent on already-verified rows.
 */
export async function approveVendor(formData: FormData) {
  const actor = await requireAdmin();
  const vendorProfileId = readFormString(formData, 'vendor_profile_id');
  if (!vendorProfileId) throw new Error('Missing vendor_profile_id.');

  const result = await transitionVendorVisibility({
    actor,
    vendorProfileId,
    nextVisibility: 'verified',
    reason: readFormString(formData, 'reason') || null,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/vendors');
  redirect('/admin/verify?approved=1');
}

/**
 * Reject a vendor. Per 0022 § 2.1c the admin can choose between:
 *   • leaving it as `coming_soon` (default — vendor can re-submit)
 *   • flipping to `hidden` (rejection sticks; vendor must contact support)
 *
 * The form posts a `reject_to` value to express that choice.
 */
export async function rejectVendor(formData: FormData) {
  const actor = await requireAdmin();
  const vendorProfileId = readFormString(formData, 'vendor_profile_id');
  if (!vendorProfileId) throw new Error('Missing vendor_profile_id.');

  const rejectTo = readFormString(formData, 'reject_to');
  const next: VendorPublicVisibility =
    rejectTo === 'hidden' ? 'hidden' : 'coming_soon';

  const result = await transitionVendorVisibility({
    actor,
    vendorProfileId,
    nextVisibility: next,
    reason: readFormString(formData, 'reason') || null,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/vendors');
  redirect('/admin/verify?rejected=1');
}

/**
 * Archive a vendor — terminal state. Existing event relationships keep their
 * FK integrity; the profile disappears from all browse surfaces. Used when
 * a vendor closes their business.
 */
export async function archiveVendor(formData: FormData) {
  const actor = await requireAdmin();
  const vendorProfileId = readFormString(formData, 'vendor_profile_id');
  if (!vendorProfileId) throw new Error('Missing vendor_profile_id.');

  const result = await transitionVendorVisibility({
    actor,
    vendorProfileId,
    nextVisibility: 'archived',
    reason: readFormString(formData, 'reason') || null,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/vendors');
  redirect('/admin/verify?archived=1');
}
