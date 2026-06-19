'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import {
  parseVerificationState,
  type VerificationState,
} from '@/lib/vendor-verification';

/**
 * Server actions backing the admin Verification Queue. Two surfaces share
 * this file:
 *
 *   • `vendor_profiles.public_visibility` transitions (hidden / coming_soon /
 *     verified / archived) — the marketplace-side state from PR #56.
 *     Approve / Reject / Archive flips per § 3.2 of 0023.
 *
 *   • `vendor_verification_applications` decisions — Approve / Reject /
 *     Demote per the 2026-05-16 Vendor Verification flow lock. Each
 *     decision writes:
 *       1. The application row's `decision` + `decision_reason` + `decided_at`
 *       2. The vendor_profiles.verification_state transition
 *       3. A vendor_tier_history audit row (from_state, to_state, reason)
 *       4. An admin_audit_log row for the broader admin action stream
 *
 * Single-admin authority per 0023 § 4.3. State-transition audit is
 * idempotent-safe — re-running a decision on an already-decided application
 * no-ops without flipping history.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

// ---------------------------------------------------------------------------
// PART A — vendor_profiles.public_visibility transitions
//
// Carried over from PR #56. Distinct from the verification_state work below;
// `public_visibility` governs marketplace listing visibility and is set
// independently of the verification workflow.
// ---------------------------------------------------------------------------

async function transitionVendorVisibility(opts: {
  actor: AdminUser;
  vendorProfileId: string;
  nextVisibility: VendorPublicVisibility;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: readErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_visibility, business_name, verification_state',
    )
    .eq('vendor_profile_id', opts.vendorProfileId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Vendor not found.' };

  const before = parseVisibility(existing.public_visibility);
  if (before === opts.nextVisibility) {
    return { ok: true }; // idempotent no-op
  }

  // When this visibility flip publishes the vendor to the marketplace
  // (nextVisibility === 'verified'), also advance the verification_state so
  // the vendor dashboard's `verification_state` stops disagreeing with the
  // marketplace `public_visibility`. Mirrors the Applications-path approve
  // (applyApplicationDecision case 'approved'): verified + last_verified_at +
  // a one-year next_renewal_due_at + a vendor_tier_history audit row. Other
  // transitions (hidden / coming_soon / archived) leave verification_state
  // untouched — they're marketplace-listing moderation, not de-verification.
  const fromState = parseVerificationState(existing.verification_state);
  const shouldVerify = opts.nextVisibility === 'verified';
  const toState: VerificationState = shouldVerify ? 'verified' : fromState;
  const stateChanges = shouldVerify && toState !== fromState;

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'vendor_visibility_change',
    target_table: 'vendor_profiles',
    target_id: opts.vendorProfileId,
    before_json: {
      public_visibility: before,
      verification_state: fromState,
    },
    after_json: {
      public_visibility: opts.nextVisibility,
      verification_state: toState,
    },
    reason: opts.reason ?? null,
    actor_user_id: opts.actor.user_id,
  });
  if (auditErr) return { ok: false, error: `audit log failed: ${auditErr.message}` };

  const updatePayload: Record<string, unknown> = {
    public_visibility: opts.nextVisibility,
    updated_at: now,
  };
  if (shouldVerify) {
    const renewalDue = new Date(now);
    renewalDue.setUTCFullYear(renewalDue.getUTCFullYear() + 1);
    updatePayload.verification_state = toState;
    updatePayload.last_verified_at = now;
    updatePayload.next_renewal_due_at = renewalDue.toISOString();
  }

  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update(updatePayload)
    .eq('vendor_profile_id', opts.vendorProfileId);
  if (updErr) return { ok: false, error: updErr.message };

  // vendor_tier_history audit row — only when verification_state actually
  // moved (matches Step 3 of applyApplicationDecision). No application drove
  // this transition, so application_id is null.
  if (stateChanges) {
    const { error: historyErr } = await admin
      .from('vendor_tier_history')
      .insert({
        vendor_profile_id: opts.vendorProfileId,
        from_state: fromState,
        to_state: toState,
        application_id: null,
        admin_user_id: opts.actor.user_id,
        reason: opts.reason ?? null,
        metadata: {
          source: 'admin_visibility_transition',
          public_visibility: opts.nextVisibility,
        },
      });
    if (historyErr) return { ok: false, error: historyErr.message };
  }

  return { ok: true };
}

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
  revalidatePath('/explore');
  redirect('/admin/verify?approved=1');
}

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
  revalidatePath('/explore');
  redirect('/admin/verify?rejected=1');
}

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
  revalidatePath('/explore');
  redirect('/admin/verify?archived=1');
}

// ---------------------------------------------------------------------------
// PART B — vendor_verification_applications decisions
//
// One server action per decision: approve, reject, demote, set in-review.
// Each writes:
//   1. The application row's `decision` (when applicable) + decided_at +
//      admin_user_id + decision_reason + status flip.
//   2. The vendor's `verification_state` flip + side-effects:
//        - approved   → 'verified' + last_verified_at + next_renewal_due_at
//        - rejected   → 'rejected' (vendor must start a new app)
//        - demoted    → 'demoted' + last_demoted_at + demotion_count++
//   3. A vendor_tier_history audit row.
//   4. An admin_audit_log row.
// ---------------------------------------------------------------------------

type ApplicationDecisionInput = {
  actor: AdminUser;
  applicationId: string;
  decision: 'approved' | 'rejected' | 'demoted' | 'set_in_review';
  reason: string | null;
};

async function applyApplicationDecision(
  input: ApplicationDecisionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Load the application row + the vendor's current state so we can write
  // before/after snapshots into both audit tables.
  const { data: app, error: appErr } = await admin
    .from('vendor_verification_applications')
    .select(
      'application_id,vendor_profile_id,status,decision,application_type,fee_php_centavos',
    )
    .eq('application_id', input.applicationId)
    .maybeSingle();
  if (appErr) return { ok: false, error: appErr.message };
  if (!app) return { ok: false, error: 'Application not found.' };

  const { data: vendor, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,verification_state,demotion_count,last_demoted_at,last_verified_at,next_renewal_due_at,public_visibility',
    )
    .eq('vendor_profile_id', app.vendor_profile_id)
    .maybeSingle();
  if (vendorErr) return { ok: false, error: vendorErr.message };
  if (!vendor) return { ok: false, error: 'Vendor not found.' };

  const fromState = parseVerificationState(vendor.verification_state);
  let toState: VerificationState = fromState;
  let appStatus = app.status as string;
  let appDecision: 'approved' | 'rejected' | null = null;
  let approveSideEffects: {
    last_verified_at?: string;
    next_renewal_due_at?: string;
    public_visibility?: 'verified';
  } = {};
  let demoteSideEffects: {
    last_demoted_at?: string;
    demotion_count?: number;
  } = {};

  switch (input.decision) {
    case 'approved': {
      toState = 'verified';
      appStatus = 'approved';
      appDecision = 'approved';
      const renewalDue = new Date(now);
      renewalDue.setUTCFullYear(renewalDue.getUTCFullYear() + 1);
      approveSideEffects = {
        last_verified_at: now,
        next_renewal_due_at: renewalDue.toISOString(),
        public_visibility: 'verified',
      };
      break;
    }
    case 'rejected': {
      toState = 'rejected';
      appStatus = 'rejected';
      appDecision = 'rejected';
      if (!input.reason) {
        return {
          ok: false,
          error: 'Rejection reason is required.',
        };
      }
      break;
    }
    case 'demoted': {
      // Demotion is a vendor-level action; it doesn't decide an application.
      // The "demote" button in the queue is for an emergency moderation
      // action against a verified vendor (e.g. 3+ disputes in 30 days). The
      // application_id in scope is the most recent approved one — we keep
      // its status untouched.
      toState = 'demoted';
      demoteSideEffects = {
        last_demoted_at: now,
        demotion_count: (vendor.demotion_count ?? 0) + 1,
      };
      break;
    }
    case 'set_in_review': {
      toState = fromState; // tier doesn't change
      appStatus = 'in_review';
      break;
    }
  }

  // ---- Step 1: update the application row (when applicable). ----
  if (input.decision !== 'demoted') {
    const updatePayload: Record<string, unknown> = {
      status: appStatus,
      updated_at: now,
    };
    if (appDecision) {
      updatePayload.decision = appDecision;
      updatePayload.decision_reason = input.reason ?? null;
      updatePayload.decided_at = now;
      updatePayload.admin_user_id = input.actor.user_id;
    } else if (input.decision === 'set_in_review') {
      updatePayload.admin_user_id = input.actor.user_id;
    }
    const { error: appUpdErr } = await admin
      .from('vendor_verification_applications')
      .update(updatePayload)
      .eq('application_id', app.application_id);
    if (appUpdErr) return { ok: false, error: appUpdErr.message };
  }

  // ---- Step 2: update vendor_profiles tier + side-effects. ----
  if (toState !== fromState || Object.keys(approveSideEffects).length > 0) {
    const vendorUpdatePayload: Record<string, unknown> = {
      verification_state: toState,
      updated_at: now,
      ...approveSideEffects,
      ...demoteSideEffects,
    };
    const { error: vendorUpdErr } = await admin
      .from('vendor_profiles')
      .update(vendorUpdatePayload)
      .eq('vendor_profile_id', vendor.vendor_profile_id);
    if (vendorUpdErr) return { ok: false, error: vendorUpdErr.message };
  }

  // ---- Step 3: vendor_tier_history audit row. ----
  if (toState !== fromState) {
    const { error: historyErr } = await admin
      .from('vendor_tier_history')
      .insert({
        vendor_profile_id: vendor.vendor_profile_id,
        from_state: fromState,
        to_state: toState,
        application_id:
          input.decision === 'demoted' ? null : app.application_id,
        admin_user_id: input.actor.user_id,
        reason: input.reason,
        metadata: {
          source: 'admin_queue',
          decision: input.decision,
        },
      });
    if (historyErr) return { ok: false, error: historyErr.message };
  }

  // ---- Step 4: admin_audit_log row. ----
  const auditAction =
    input.decision === 'approved'
      ? 'vendor_verification_approved'
      : input.decision === 'rejected'
        ? 'vendor_verification_rejected'
        : input.decision === 'demoted'
          ? 'vendor_verification_demoted'
          : 'vendor_verification_set_in_review';
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: auditAction,
    target_table: 'vendor_verification_applications',
    target_id: app.application_id,
    before_json: {
      status: app.status,
      verification_state: fromState,
    },
    after_json: {
      status: appStatus,
      verification_state: toState,
    },
    reason: input.reason,
    actor_user_id: input.actor.user_id,
  });
  if (auditErr) return { ok: false, error: auditErr.message };

  return { ok: true };
}

export async function approveApplication(formData: FormData) {
  const actor = await requireAdmin();
  const applicationId = readFormString(formData, 'application_id');
  if (!applicationId) throw new Error('Missing application_id.');

  const result = await applyApplicationDecision({
    actor,
    applicationId,
    decision: 'approved',
    reason: readFormString(formData, 'reason') || null,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/explore');
  revalidatePath('/vendor-dashboard/verify');
  redirect('/admin/verify?app_approved=1&status=approved');
}

export async function rejectApplication(formData: FormData) {
  const actor = await requireAdmin();
  const applicationId = readFormString(formData, 'application_id');
  const reason = readFormString(formData, 'reason');
  if (!applicationId) throw new Error('Missing application_id.');
  if (!reason) {
    redirect(
      `/admin/verify?error=${encodeURIComponent('Rejection reason is required.')}`,
    );
  }

  const result = await applyApplicationDecision({
    actor,
    applicationId,
    decision: 'rejected',
    reason,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/explore');
  revalidatePath('/vendor-dashboard/verify');
  redirect('/admin/verify?app_rejected=1&status=rejected');
}

/**
 * Demote a verified vendor — used for moderation actions against an existing
 * verified vendor (e.g. 3+ disputes in 30 days; manual admin override).
 * Doesn't decide any specific application row; flips the vendor tier from
 * 'verified' → 'demoted' and bumps demotion_count.
 *
 * Form payload: vendor_profile_id + reason. application_id is optional —
 * if provided we still write a tier_history row pointing at it.
 */
export async function demoteVendor(formData: FormData) {
  const actor = await requireAdmin();
  const vendorProfileId = readFormString(formData, 'vendor_profile_id');
  const applicationId =
    readFormString(formData, 'application_id') || crypto.randomUUID();
  const reason = readFormString(formData, 'reason');
  if (!vendorProfileId) throw new Error('Missing vendor_profile_id.');
  if (!reason) {
    redirect(
      `/admin/verify?error=${encodeURIComponent('Demotion reason is required.')}`,
    );
  }

  // We synthesize a placeholder application_id only for routing into the
  // shared decision helper, but the helper's `case 'demoted'` doesn't touch
  // the application row. The "application_id" we pass is the most recent
  // approved one (if any) so the audit log carries a useful pointer.
  const admin = createAdminClient();
  const { data: latestApp } = await admin
    .from('vendor_verification_applications')
    .select('application_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reroute through the application-level helper using the latest approved
  // app's id (or fall through with the synthesised id which the helper
  // tolerates because it doesn't write to the row on demote).
  const targetAppId = latestApp?.application_id ?? applicationId;
  const result = await applyApplicationDecisionForDemote({
    actor,
    vendorProfileId,
    targetAppId,
    reason,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/explore');
  redirect('/admin/verify?demoted=1&status=demoted');
}

/**
 * Specialized helper for the demote path so the main `applyApplicationDecision`
 * doesn't have to round-trip the application_id (vs vendor_profile_id).
 * Writes verification_state + tier_history + admin_audit_log; never touches
 * the application row.
 */
async function applyApplicationDecisionForDemote(opts: {
  actor: AdminUser;
  vendorProfileId: string;
  targetAppId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: vendor, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id,verification_state,demotion_count')
    .eq('vendor_profile_id', opts.vendorProfileId)
    .maybeSingle();
  if (vendorErr) return { ok: false, error: vendorErr.message };
  if (!vendor) return { ok: false, error: 'Vendor not found.' };

  const fromState = parseVerificationState(vendor.verification_state);
  if (fromState === 'demoted') {
    return { ok: true }; // idempotent
  }

  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update({
      verification_state: 'demoted',
      last_demoted_at: now,
      demotion_count: (vendor.demotion_count ?? 0) + 1,
      updated_at: now,
    })
    .eq('vendor_profile_id', opts.vendorProfileId);
  if (updErr) return { ok: false, error: updErr.message };

  // Best-effort tier_history insert — UUIDs that don't match a real row will
  // FK-violate; in that case fall back to a null application_id.
  let appIdForHistory: string | null = opts.targetAppId;
  const { data: appExists } = await admin
    .from('vendor_verification_applications')
    .select('application_id')
    .eq('application_id', opts.targetAppId)
    .maybeSingle();
  if (!appExists) appIdForHistory = null;

  await admin.from('vendor_tier_history').insert({
    vendor_profile_id: opts.vendorProfileId,
    from_state: fromState,
    to_state: 'demoted',
    application_id: appIdForHistory,
    admin_user_id: opts.actor.user_id,
    reason: opts.reason,
    metadata: { source: 'admin_queue_demote' },
  });

  await admin.from('admin_audit_log').insert({
    action: 'vendor_verification_demoted',
    target_table: 'vendor_profiles',
    target_id: opts.vendorProfileId,
    before_json: { verification_state: fromState },
    after_json: { verification_state: 'demoted' },
    reason: opts.reason,
    actor_user_id: opts.actor.user_id,
  });

  return { ok: true };
}

/**
 * Flip a pending_review row → in_review so the queue UI shows "this admin is
 * actively reviewing". Optional bookkeeping action (the queue still works
 * without it).
 */
export async function setApplicationInReview(formData: FormData) {
  const actor = await requireAdmin();
  const applicationId = readFormString(formData, 'application_id');
  if (!applicationId) throw new Error('Missing application_id.');

  const result = await applyApplicationDecision({
    actor,
    applicationId,
    decision: 'set_in_review',
    reason: null,
  });
  if (!result.ok) {
    redirect(`/admin/verify?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/verify');
  redirect('/admin/verify?in_review=1&status=in_review');
}
