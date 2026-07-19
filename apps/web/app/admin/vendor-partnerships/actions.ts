'use server';

/**
 * /admin/vendor-partnerships server actions.
 *
 * MUTUAL-ACCEPT MODEL (migration 20270403305164): a partnership publishes to
 * couples on `status='accepted'` (the recipient vendor accepts an incoming
 * proposal) — NOT on the old admin_verified flag. The two-admin "verify" flow
 * is therefore RETIRED: it only ever flipped admin_verified, which no longer
 * gates any couple-facing visibility, so it published nothing. Those dead
 * actions (initiateApproval / confirmApproval) were removed.
 *
 * HQ retains passive oversight:
 *   • createPartnershipHq — record a partnership on a vendor's behalf. It is
 *     forced to status='proposed' so it lands in the recommended vendor's inbox
 *     and only publishes when THEY accept (never auto-published by HQ).
 *   • rejectPartnership — single-admin kill-switch (is_active=false). Blocks a
 *     partnership from ever showing a badge without granting elevated access,
 *     so it doesn't need a second admin.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

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
// ACTION — Reject (single-admin kill-switch; sets is_active=false)
//
// The one HQ intervention that still matters under mutual-accept: veto an
// abusive partnership so no badge can ever show, regardless of status. A
// rejected row can never be re-published by the recipient accepting it (the
// couple-read RLS requires is_active=true AND status='accepted').
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

  revalidatePath('/admin/vendor-partnerships');
  revalidatePath('/explore');
  redirect('/admin/vendor-partnerships?rejected=1');
}

// ---------------------------------------------------------------------------
// ACTION — HQ manually create (propose) a partnership
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
      // Phase 4 mutual-accept: an HQ-created partnership is a PROPOSAL — it
      // lands in the recommended vendor's inbox and only publishes when THEY
      // accept. status MUST be set explicitly here: the column default is
      // 'accepted' (so pre-existing rows stay live), which would otherwise
      // auto-publish a fabricated partnership without the recipient's consent.
      status: 'proposed',
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

// NOTE: the former vendor-side `submitPartnershipClaim` action was REMOVED in
// Phase 4 (mutual-accept). Vendors now propose partnerships via
// `app/vendor-dashboard/partnerships/actions.ts::proposePartnership`, which
// forces status='proposed' so nothing auto-publishes. The old action inserted
// with no explicit status, which after Phase 4 would have defaulted to
// 'accepted' and auto-published a partnership without the recipient's consent.
//
// NOTE: the two-admin verify flow (initiateApproval / confirmApproval) was
// RETIRED here — it flipped the now-inert admin_verified flag, which no longer
// gates couple visibility (status='accepted' does). It published nothing.
