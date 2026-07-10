'use server';

/**
 * /admin/fraud server actions — the Phase-4 fraud queue + two-stage enforcement.
 * Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 5.
 *
 * ENFORCEMENT MODEL (owner-locked § 5):
 *   • DISMISS      — admin clears a vendor's open signals as a false positive.
 *                    If the vendor was auto-suspended, ALSO un-suspends it.
 *                    Audited (`dismiss` [+ `unsuspend`]).
 *   • UN-SUSPEND   — reverse an auto-suspend WITHOUT clearing signals (the
 *                    vendor is un-frozen but stays in the queue). Audited.
 *   • CONFIRM FRAUD → WIPE + BAN — the IRREVERSIBLE action. It is NEVER
 *                    performed directly here — it is ROUTED THROUGH the existing
 *                    two-admin (four-eyes) approval gate (admin_approval_requests
 *                    action_type='approve_fraud_wipe_ban'). One admin initiates
 *                    (`initiateFraudWipeBan`); a DIFFERENT admin confirms in
 *                    /admin/approvals, which calls `executeFraudWipeBan` from the
 *                    approvals executor. The actual wipe: void the ring's
 *                    reviews/events, tombstone + permanently ban, +1 demotion,
 *                    refresh matviews, audit with an evidence snapshot, and open
 *                    a help-center appeal ticket stub.
 *
 * SECURITY (mirrors app/admin/approvals/actions.ts + app/admin/verify/actions.ts):
 *   requireAdmin() asserts the caller is an admin via the authenticated client;
 *   all reads/writes then go through the service-role client (createAdminClient),
 *   which bypasses RLS. The table RLS (is_admin()) is defense-in-depth.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildFraudEvidenceSnapshot,
  writeFraudEnforcementAudit,
} from '@/lib/fraud-enforcement-runner';
import { deriveVendorFraudState } from '@/lib/fraud-enforcement';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
type AdminClient = ReturnType<typeof createAdminClient>;

function requireVendorId(formData: FormData): string {
  const v = formData.get('vendor_profile_id');
  if (typeof v !== 'string' || !v) throw new Error('Missing vendor');
  return v;
}

/**
 * DISMISS — mark this vendor's OPEN fraud signals dismissed (false positive).
 * If the vendor was auto-suspended, ALSO un-suspend it (clears the freeze and
 * restores it to the pre-verification-safe 'coming_soon' visibility). Audited.
 */
export async function dismissVendorSignals(formData: FormData) {
  const { userId } = await requireAdmin();
  const vendorProfileId = requireVendorId(formData);
  const reasonRaw = formData.get('reason');
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 2000) : '';

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Snapshot BEFORE we mutate, so the audit captures the picture that was open.
  const snapshot = await buildFraudEvidenceSnapshot(admin, vendorProfileId);

  const { data: vendorRow } = await admin
    .from('vendor_profiles')
    .select('fraud_suspended_at, fraud_banned_at, public_visibility')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const v = (vendorRow ?? {}) as {
    fraud_suspended_at: string | null;
    fraud_banned_at: string | null;
    public_visibility: string | null;
  };
  const state = deriveVendorFraudState(v);
  if (state === 'banned') {
    throw new Error('This vendor is already permanently banned — nothing to dismiss.');
  }

  // Resolve the open signals as dismissed.
  const { error: sigErr } = await admin
    .from('fraud_signals')
    .update({
      status: 'dismissed',
      resolution_notes: reason || 'Dismissed by admin (false positive)',
      reviewed_by: userId,
      reviewed_at: nowIso,
    })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'open');
  if (sigErr) throw new Error(`Could not dismiss signals: ${sigErr.message}`);

  // If suspended, un-suspend (un-freeze) at the same time.
  if (state === 'suspended') {
    const { error: unsuspErr } = await admin
      .from('vendor_profiles')
      .update({ fraud_suspended_at: null, public_visibility: 'coming_soon' })
      .eq('vendor_profile_id', vendorProfileId)
      .not('fraud_suspended_at', 'is', null)
      .is('fraud_banned_at', null);
    if (unsuspErr) throw new Error(`Could not un-suspend: ${unsuspErr.message}`);
    await writeFraudEnforcementAudit(admin, {
      vendorProfileId,
      action: 'unsuspend',
      actorUserId: userId,
      reason: reason || 'Un-suspended on dismiss (false positive)',
      evidenceSnapshot: snapshot,
    });
  }

  await writeFraudEnforcementAudit(admin, {
    vendorProfileId,
    action: 'dismiss',
    actorUserId: userId,
    reason: reason || 'Dismissed (false positive)',
    evidenceSnapshot: snapshot,
  });

  try {
    await admin.rpc('refresh_vendor_fraud_scores');
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'fraud-dismiss-refresh' } });
  }

  revalidatePath('/admin/fraud');
  revalidatePath('/admin');
}

/**
 * UN-SUSPEND — reverse an auto-suspend WITHOUT clearing the signals. The vendor
 * is un-frozen (restored to 'coming_soon' visibility) but stays in the queue so
 * an admin can keep watching. Audited.
 */
export async function unsuspendVendor(formData: FormData) {
  const { userId } = await requireAdmin();
  const vendorProfileId = requireVendorId(formData);
  const reasonRaw = formData.get('reason');
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 2000) : '';

  const admin = createAdminClient();
  const snapshot = await buildFraudEvidenceSnapshot(admin, vendorProfileId);

  const { data: updated, error } = await admin
    .from('vendor_profiles')
    .update({ fraud_suspended_at: null, public_visibility: 'coming_soon' })
    .eq('vendor_profile_id', vendorProfileId)
    .not('fraud_suspended_at', 'is', null)
    .is('fraud_banned_at', null)
    .select('vendor_profile_id')
    .maybeSingle();
  if (error) throw new Error(`Could not un-suspend: ${error.message}`);
  if (!updated) {
    throw new Error('Vendor is not currently auto-suspended (or is already banned).');
  }

  await writeFraudEnforcementAudit(admin, {
    vendorProfileId,
    action: 'unsuspend',
    actorUserId: userId,
    reason: reason || 'Un-suspended by admin',
    evidenceSnapshot: snapshot,
  });

  revalidatePath('/admin/fraud');
  revalidatePath('/admin');
}

/**
 * INITIATE the irreversible wipe + ban — routes THROUGH the two-admin gate.
 * This does NOT wipe or ban anything. It creates a pending
 * admin_approval_requests row (action_type='approve_fraud_wipe_ban',
 * target_id=vendor_profile_id) that a DIFFERENT admin must confirm in
 * /admin/approvals. A typed-confirmation ("type the business name") guards the
 * INITIATION here too, so a mis-click can't even open the request.
 */
export async function initiateFraudWipeBan(formData: FormData) {
  const { userId } = await requireAdmin();
  const vendorProfileId = requireVendorId(formData);
  const typedName = String(formData.get('confirm_name') ?? '').trim();
  const rationaleRaw = formData.get('rationale');
  const rationale = typeof rationaleRaw === 'string' ? rationaleRaw.trim() : '';

  if (rationale.length < 3) {
    throw new Error('A rationale (≥3 chars) is required to initiate a wipe + ban.');
  }

  const admin = createAdminClient();

  const { data: vendorRow } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, fraud_banned_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vendorRow) throw new Error('Vendor not found');
  const vendor = vendorRow as {
    business_name: string | null;
    fraud_banned_at: string | null;
  };
  if (vendor.fraud_banned_at) {
    throw new Error('This vendor is already permanently banned.');
  }

  // Typed-confirmation gate — the admin must retype the exact business name.
  const expected = (vendor.business_name ?? '').trim();
  if (!expected || typedName !== expected) {
    throw new Error(
      'Business-name confirmation did not match. Type the vendor’s exact business name to initiate the wipe + ban.',
    );
  }

  // Guard against a duplicate pending request for the same vendor.
  const { data: existing } = await admin
    .from('admin_approval_requests')
    .select('approval_id')
    .eq('action_type', 'approve_fraud_wipe_ban')
    .eq('target_id', vendorProfileId)
    .eq('status', 'pending')
    .limit(1);
  if (existing && existing.length > 0) {
    throw new Error(
      'A wipe + ban request for this vendor is already pending a second admin’s confirmation.',
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_fraud_wipe_ban',
    target_id: vendorProfileId,
    rationale: rationale.slice(0, 2000),
    initiated_by: userId,
  });
  if (insErr) throw new Error(`Could not open the wipe + ban request: ${insErr.message}`);

  // Audit the intent (not the execution — that's logged on confirm). Uses the
  // canonical admin_audit_log columns (target_table / target_id TEXT / reason /
  // after_json), matching the /admin/approvals audit() helper.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'fraud_wipe_ban_initiated',
    target_table: 'vendor_profiles',
    target_id: vendorProfileId,
    actor_user_id: userId,
    reason: rationale.slice(0, 2000),
    after_json: { business_name: expected },
  });
  if (auditErr) {
    // eslint-disable-next-line no-console
    console.error('[fraud initiate audit] insert failed', auditErr.message);
  }

  revalidatePath('/admin/fraud');
  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/**
 * EXECUTE the irreversible wipe + ban. Called ONLY by the two-admin approvals
 * executor (app/admin/approvals/actions.ts) AFTER a different admin confirms the
 * pending approve_fraud_wipe_ban request. NOT a public server action — it takes
 * the service-role client + the confirming admin's id from the executor, which
 * has already enforced four-eyes.
 *
 * Steps (§ 5):
 *   1. Snapshot the fraud picture (for the audit evidence trail).
 *   2. VOID the ring's reviews + self-dealt/imported events from every stat via
 *      voided_by_fraud flags (soft-delete — evidence survives; the vetted views
 *      already exclude voided rows).
 *   3. Tombstone + permanently ban the vendor (+1 demotion_count) and hide it.
 *   4. Refresh the affected matviews.
 *   5. Write a `ban_wipe` audit row with the evidence snapshot.
 *   6. Open a help-center appeal ticket stub (0029) for the banned vendor.
 */
export async function executeFraudWipeBan(
  admin: AdminClient,
  args: { vendorProfileId: string; confirmingAdminId: string; rationale?: string | null },
): Promise<void> {
  const { vendorProfileId, confirmingAdminId } = args;
  const rationale = args.rationale ?? null;
  const nowIso = new Date().toISOString();

  const { data: vendorRow } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, user_id, demotion_count, fraud_banned_at, contact_email')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vendorRow) throw new Error('Vendor not found');
  const vendor = vendorRow as {
    business_name: string | null;
    user_id: string | null;
    demotion_count: number | null;
    fraud_banned_at: string | null;
    contact_email: string | null;
  };
  if (vendor.fraud_banned_at) {
    // Idempotent: already banned — nothing more to do.
    return;
  }

  // 1. Evidence snapshot BEFORE voiding.
  const snapshot = await buildFraudEvidenceSnapshot(admin, vendorProfileId);

  // 2. VOID the ring's reviews + events. Reviews keyed by vendor_profile_id;
  //    events by linked_vendor_profile_id (the marketplace-attribution key the
  //    vetted stats join on). Soft-delete via voided_by_fraud so the evidence
  //    trail survives for appeal / counsel review.
  const { count: reviewsVoided } = await admin
    .from('vendor_reviews')
    .update({ voided_by_fraud: true }, { count: 'exact' })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('voided_by_fraud', false);
  const { count: eventsVoided } = await admin
    .from('event_vendors')
    .update({ voided_by_fraud: true }, { count: 'exact' })
    .eq('linked_vendor_profile_id', vendorProfileId)
    .eq('voided_by_fraud', false);

  // 3. Tombstone + permanently ban + demotion++ + hide.
  const { error: banErr } = await admin
    .from('vendor_profiles')
    .update({
      fraud_banned_at: nowIso,
      fraud_tombstoned: true,
      fraud_suspended_at: nowIso, // banned implies frozen; keep the timestamp set
      public_visibility: 'hidden',
      demotion_count: (vendor.demotion_count ?? 0) + 1,
    })
    .eq('vendor_profile_id', vendorProfileId);
  if (banErr) throw new Error(`Ban write failed: ${banErr.message}`);

  // 4. Refresh the matviews that read the now-voided rows + the fraud aggregate.
  //    Fail-soft: a failing refresh must not roll back the ban.
  for (const rpc of [
    'refresh_vendor_review_stats',
    'refresh_vendor_completed_events_stats',
    'refresh_vendor_fraud_scores',
  ] as const) {
    try {
      await admin.rpc(rpc);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'fraud-wipe-refresh' },
        extra: { rpc, vendorProfileId },
      });
    }
  }

  // 5. Audit the irreversible action with the evidence snapshot + void counts.
  snapshot.reviews_voided = reviewsVoided ?? 0;
  snapshot.events_voided = eventsVoided ?? 0;
  snapshot.business_name = vendor.business_name;
  await writeFraudEnforcementAudit(admin, {
    vendorProfileId,
    action: 'ban_wipe',
    actorUserId: confirmingAdminId,
    reason: rationale || 'Confirmed fraud — permanent wipe + ban (two-admin gate)',
    evidenceSnapshot: snapshot,
  });

  // 6. Open a help-center appeal ticket stub (0029). Best-effort — a failed
  //    ticket insert never rolls back the ban; the appeal path is a courtesy on
  //    top of the enforcement, and the banned vendor can always reach /help
  //    directly. Only opened when we have a contact to route the appeal to.
  const appealEmail = vendor.contact_email?.trim();
  if (appealEmail) {
    try {
      await admin.from('help_messages').insert({
        user_id: vendor.user_id ?? null,
        sender_email: appealEmail,
        sender_name: vendor.business_name ?? null,
        topic: 'fraud_ban_appeal',
        subject: `Appeal · account suspended for policy violation (${vendor.business_name ?? 'vendor'})`,
        body:
          'This ticket was opened automatically when this business account was ' +
          'permanently disabled for violating Setnayan’s trust & integrity policy. ' +
          'If you believe this was a mistake, reply here with any context and our ' +
          'team will review the appeal.',
        status: 'new',
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'fraud-ban-appeal-ticket' },
        extra: { vendorProfileId },
      });
    }
  }

  revalidatePath('/admin/fraud');
  revalidatePath('/admin');
}
