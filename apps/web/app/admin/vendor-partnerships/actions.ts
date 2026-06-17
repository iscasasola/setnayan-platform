'use server';

/**
 * /admin/vendor-partnerships server actions.
 *
 * Two-admin gate for Approve:
 *   1. First admin clicks "Approve" — writes a row to admin_approval_requests
 *      (action_type='approve_vendor_partnership', target_id=partnership id,
 *      status='pending').
 *   2. A DIFFERENT admin clicks "Confirm approval" on the pending request —
 *      the atomic UPDATE enforces `.neq('initiated_by', deciderId)` + status
 *      guard, then sets vendor_partnerships.admin_verified=true.
 *
 * Reject is single-admin (sets is_active=false) — it blocks the partnership
 * from being visible without granting elevated access, so it doesn't need
 * a second admin.
 *
 * HQ can also manually create partnerships on behalf of vendors.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<{ userId: string }> {
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
  return { userId: user.id };
}

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

// ---------------------------------------------------------------------------
// Best-effort audit log helper
// ---------------------------------------------------------------------------

async function audit(opts: {
  action: string;
  targetId: string;
  actorUserId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('admin_audit_log').insert({
    action: opts.action,
    target_table: 'vendor_partnerships',
    target_id: opts.targetId,
    actor_user_id: opts.actorUserId,
    reason: opts.reason ?? null,
    before_json: opts.before ?? null,
    after_json: opts.after ?? null,
  });
  if (error) console.error('[vendor-partnerships audit]', error.message);
}

// ---------------------------------------------------------------------------
// ACTION 1 — Initiate two-admin approval (first admin)
//
// Called when an admin clicks "Approve" on a pending partnership. Creates a
// row in admin_approval_requests (action_type='approve_vendor_partnership',
// status='pending'). A DIFFERENT admin must then confirm via confirmApproval.
// ---------------------------------------------------------------------------

export async function initiateApproval(formData: FormData) {
  const { userId } = await requireAdmin();
  const partnershipId = readString(formData, 'partnership_id');
  if (!partnershipId) throw new Error('Missing partnership_id');

  const admin = createAdminClient();

  // Verify the partnership exists and is still unverified.
  const { data: existing } = await admin
    .from('vendor_partnerships')
    .select('id, admin_verified, is_active')
    .eq('id', partnershipId)
    .maybeSingle();
  if (!existing) redirect('/admin/vendor-partnerships?error=Partnership+not+found.');
  if (existing.admin_verified) {
    redirect('/admin/vendor-partnerships?error=Already+verified.');
  }
  if (!existing.is_active) {
    redirect('/admin/vendor-partnerships?error=Partnership+is+inactive.');
  }

  // Check there isn't already a pending approval for this partnership from a
  // different admin — avoid duplicate pending rows.
  const { data: alreadyPending } = await admin
    .from('admin_approval_requests')
    .select('approval_id, initiated_by')
    .eq('action_type', 'approve_vendor_partnership')
    .eq('target_id', partnershipId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (alreadyPending) {
    if (alreadyPending.initiated_by === userId) {
      redirect(
        '/admin/vendor-partnerships?error=You+already+initiated+approval+for+this+partnership.+A+different+admin+must+confirm.',
      );
    }
    redirect(
      '/admin/vendor-partnerships?error=An+approval+request+for+this+partnership+is+already+pending+a+second+admin.',
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_vendor_partnership',
    target_id: partnershipId,
    rationale: `Admin ${userId} initiated approval of vendor_partnership id=${partnershipId}`,
    initiated_by: userId,
    // Expires in 72 hours (partnerships don't time-out urgently)
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  if (insErr) {
    redirect(
      `/admin/vendor-partnerships?error=${encodeURIComponent('Could not create approval request: ' + insErr.message)}`,
    );
  }

  await audit({
    action: 'vendor_partnership_approval_initiated',
    targetId: partnershipId,
    actorUserId: userId,
    after: { status: 'pending_second_admin' },
  });

  revalidatePath('/admin/vendor-partnerships');
  redirect('/admin/vendor-partnerships?initiated=1');
}

// ---------------------------------------------------------------------------
// ACTION 2 — Confirm approval (second admin)
//
// A DIFFERENT admin clicks "Confirm & verify". The atomic UPDATE on
// admin_approval_requests enforces `.neq('initiated_by', deciderId)` +
// `status='pending'` + `expires_at > now` — same four-eyes guarantee as
// /admin/approvals. Then flips vendor_partnerships.admin_verified=true.
// ---------------------------------------------------------------------------

export async function confirmApproval(formData: FormData) {
  const { userId } = await requireAdmin();
  const approvalId = readString(formData, 'approval_id');
  const partnershipId = readString(formData, 'partnership_id');
  if (!approvalId || !partnershipId) throw new Error('Missing ids');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Atomic claim — only succeeds if:
  //   • status is still pending
  //   • not expired
  //   • current user is NOT the initiator (four-eyes enforcement)
  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({ status: 'approved', decided_by: userId, decided_at: nowIso })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .neq('initiated_by', userId)
    .select('approval_id, initiated_by, target_id')
    .maybeSingle();

  if (claimErr) {
    redirect(
      `/admin/vendor-partnerships?error=${encodeURIComponent(claimErr.message)}`,
    );
  }
  if (!claimed) {
    redirect(
      '/admin/vendor-partnerships?error=Could+not+confirm+%E2%80%94+the+request+was+already+decided%2C+expired%2C+or+you+initiated+it.+A+different+admin+must+confirm.',
    );
  }

  // Execute: flip admin_verified = true
  const { error: updErr } = await admin
    .from('vendor_partnerships')
    .update({ admin_verified: true })
    .eq('id', partnershipId);

  if (updErr) {
    // Roll back the claim so a different admin can retry
    await admin
      .from('admin_approval_requests')
      .update({ status: 'pending', decided_by: null, decided_at: null })
      .eq('approval_id', approvalId)
      .eq('status', 'approved');

    redirect(
      `/admin/vendor-partnerships?error=${encodeURIComponent('Verification failed: ' + updErr.message)}`,
    );
  }

  await audit({
    action: 'vendor_partnership_verified',
    targetId: partnershipId,
    actorUserId: userId,
    before: { admin_verified: false },
    after: { admin_verified: true },
  });

  revalidatePath('/admin/vendor-partnerships');
  revalidatePath('/explore');
  redirect('/admin/vendor-partnerships?verified=1');
}

// ---------------------------------------------------------------------------
// ACTION 3 — Reject (single-admin; sets is_active=false)
// ---------------------------------------------------------------------------

export async function rejectPartnership(formData: FormData) {
  const { userId } = await requireAdmin();
  const partnershipId = readString(formData, 'partnership_id');
  const reason = readString(formData, 'reason');
  if (!partnershipId) throw new Error('Missing partnership_id');

  const admin = createAdminClient();

  const { error } = await admin
    .from('vendor_partnerships')
    .update({ is_active: false })
    .eq('id', partnershipId);

  if (error) {
    redirect(
      `/admin/vendor-partnerships?error=${encodeURIComponent(error.message)}`,
    );
  }

  await audit({
    action: 'vendor_partnership_rejected',
    targetId: partnershipId,
    actorUserId: userId,
    reason: reason || null,
    before: { is_active: true },
    after: { is_active: false },
  });

  // Cancel any pending approval request for this partnership
  await admin
    .from('admin_approval_requests')
    .update({ status: 'rejected', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('action_type', 'approve_vendor_partnership')
    .eq('target_id', partnershipId)
    .eq('status', 'pending');

  revalidatePath('/admin/vendor-partnerships');
  redirect('/admin/vendor-partnerships?rejected=1');
}

// ---------------------------------------------------------------------------
// ACTION 4 — HQ manually create a partnership
// ---------------------------------------------------------------------------

export async function createPartnershipHq(formData: FormData) {
  const { userId } = await requireAdmin();

  const recommendingId = readString(formData, 'recommending_vendor_id');
  const recommendedId = readString(formData, 'recommended_vendor_id');
  const relationshipType = readString(formData, 'relationship_type');
  const feeCentavosRaw = readString(formData, 'additional_fee_centavos');
  const discountPctRaw = readString(formData, 'discount_pct');
  const coveredGroups = formData.getAll('covered_plan_groups').map(String);

  if (!recommendingId || !recommendedId || !relationshipType) {
    redirect('/admin/vendor-partnerships?error=Missing+required+fields.');
  }
  if (recommendingId === recommendedId) {
    redirect('/admin/vendor-partnerships?error=A+vendor+cannot+partner+with+themselves.');
  }

  const feeCentavos = feeCentavosRaw === '' ? null : parseInt(feeCentavosRaw, 10);
  const discountPct = discountPctRaw === '' ? null : parseInt(discountPctRaw, 10);

  const admin = createAdminClient();

  const { data: row, error: insErr } = await admin
    .from('vendor_partnerships')
    .insert({
      recommending_vendor_id: recommendingId,
      recommended_vendor_id: recommendedId,
      relationship_type: relationshipType,
      additional_fee_centavos: feeCentavos,
      discount_pct: discountPct,
      covered_plan_groups: coveredGroups,
      // HQ-created partnerships start unverified — they still need the
      // two-admin approval flow to become public.
      admin_verified: false,
      is_active: true,
    })
    .select('id')
    .single();

  if (insErr) {
    redirect(
      `/admin/vendor-partnerships?error=${encodeURIComponent(insErr.message)}`,
    );
  }

  await audit({
    action: 'vendor_partnership_hq_created',
    targetId: String(row.id),
    actorUserId: userId,
    after: { recommending_vendor_id: recommendingId, recommended_vendor_id: recommendedId, relationship_type: relationshipType },
  });

  revalidatePath('/admin/vendor-partnerships');
  redirect('/admin/vendor-partnerships?created=1');
}

// ---------------------------------------------------------------------------
// ACTION 5 — Vendor-side: submit a partnership claim
// (used from /vendor-dashboard/partnerships stub)
// ---------------------------------------------------------------------------

export async function submitPartnershipClaim(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Look up the vendor's own profile
  const { data: profile } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/vendor-dashboard?error=No+vendor+profile+found.');

  const recommendedId = readString(formData, 'recommended_vendor_id');
  const relationshipType = readString(formData, 'relationship_type');

  if (!recommendedId || !relationshipType) {
    redirect('/vendor-dashboard/partnerships?error=Missing+required+fields.');
  }
  if (recommendedId === profile.vendor_profile_id) {
    redirect('/vendor-dashboard/partnerships?error=You+cannot+partner+with+yourself.');
  }

  const { error: insErr } = await supabase.from('vendor_partnerships').insert({
    recommending_vendor_id: profile.vendor_profile_id,
    recommended_vendor_id: recommendedId,
    relationship_type: relationshipType,
    admin_verified: false,
    is_active: true,
  });

  if (insErr) {
    redirect(
      `/vendor-dashboard/partnerships?error=${encodeURIComponent(insErr.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/partnerships');
  redirect('/vendor-dashboard/partnerships?submitted=1');
}
