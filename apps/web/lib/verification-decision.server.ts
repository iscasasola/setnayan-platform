import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DOC_SLOTS,
  markSentBack,
  parseVerificationState,
  type DocUploadMap,
  type VerificationState,
} from '@/lib/vendor-verification';
import { notifyVendorStatusChange } from '@/lib/vendor-status-notify';
import { verificationEvidenceSnapshot } from '@/lib/verification-checks-server';
import { deadlineAtApproval } from '@/lib/verified-badge';
import { planBackAtRenewal } from '@/lib/papers-renewal';
import { PAPERS_LAPSED_AUDIT_ACTION } from '@/lib/papers-lapse';
import { plainRefusal } from '@/lib/admin/plain-refusal';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { logQueryError } from '@/lib/supabase/error-detect';
import { grantVerificationPlanReward } from '@/lib/verification-plan-reward.server';

/**
 * verification-decision.server.ts — THE ONE ENGINE that approves, rejects,
 * demotes or marks in review a verification application. Moved out of
 * `app/admin/verify/actions.ts` UNCHANGED (2026-11-14) so the automatic path
 * — clean papers verified on Submit — writes the approval through the SAME
 * engine the admin uses (owner: "the SAME approve path the admin uses"), with
 * `approved_by: 'automatic'` and every check recorded in the audit row.
 *
 * The sections below (PART B in the admin actions file) are verbatim but for
 * the actor type and the two `automatic` lines.
 */

// ---------------------------------------------------------------------------
// PART B — vendor_verification_applications decisions
export type ApplicationDecisionInput = {
  /**
   * Who decided. An admin's user id — or `null` with `automatic` set, when
   * clean papers verified the shop on Submit (owner "CLEAN PAPERS VERIFY THE
   * SHOP ON SUBMIT"). There is no third way in: the automatic path is reached
   * only from `runAutoVerifyOnSubmit`, which decides from SEALED server reads.
   */
  actor: { user_id: string | null };
  automatic?: { checks: unknown; reason: string };
  applicationId: string;
  decision: 'approved' | 'rejected' | 'demoted' | 'set_in_review';
  reason: string | null;
  /**
   * Approve only: the Mayor's Permit's printed "valid until", as the badge
   * deadline (end of that day, Manila) — already validated by
   * `permitDeadlineFrom`. Null = none recorded → the one-year renewal the
   * approval has always written.
   */
  permitDeadlineIso?: string | null;
  /**
   * Send-back only (owner 2026-11-14, DECISION_LOG "A SEND-BACK NAMES ONLY THE PAPER THAT NEEDS A NEW COPY": "Only
   * the named one"): the required papers the admin named. At least one; ONLY these read "Needs a new copy" with the
   * reason, every other paper keeps its state (`markSentBack`).
   */
  sentBackSlots?: readonly string[];
};

/* 🔒 NOT A SERVER ACTION (2026-10-28, admin supplier slice; moved here 2026-11-14). It was once exported from a
   server-actions file (one marked with the use-server directive), which made the badge's decision engine a public route with NO admin gate of its own. It now
   lives in this plain server module — importable by server code, never callable from a browser. Every caller checks
   who is asking: the admin actions (`requireAdmin`) and the automatic path (`runAutoVerifyOnSubmit`). */
/**
 * The plan a lapse held (ruling 2), from the lapse's own audit row — the service-role-only, append-only record the
 * daily pass wrote (`papers-lapse.server.ts`, `held_tier` · `held_ms`). Nothing held → nothing changes. Never throws:
 * an unread row gives back nothing rather than inventing a plan.
 */
async function heldPlanBack(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
  now: Date,
): Promise<{ tier_state?: string; tier_expires_at?: string | null } | null> {
  // 💸 null = THE READ FAILED. Never `{}`: an empty answer would let the approval clear the lapse with the paid plan's
  // held days unread, and nothing reads the lapse row again — a Plus/Pro shop would come back on the free plan for good.
  try {
    const { data, error } = await admin
      .from('admin_audit_log')
      .select('metadata')
      .eq('action', PAPERS_LAPSED_AUDIT_ACTION)
      .eq('target_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logQueryError('verification-decision:held-plan', error);
      return null;
    }
    const meta = ((data as { metadata?: Record<string, unknown> } | null)?.metadata ?? null) as
      | { held_tier?: unknown; held_ms?: unknown }
      | null;
    const back = planBackAtRenewal(meta ? { tier: meta.held_tier, held_ms: meta.held_ms } : null, now);
    return back ?? {};
  } catch (e) {
    logQueryError('verification-decision:held-plan', e);
    return null;
  }
}

export async function applyApplicationDecision(
  input: ApplicationDecisionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Load the application row + the vendor's current state so we can write
  // before/after snapshots into both audit tables.
  const { data: app, error: appErr } = await admin
    .from('vendor_verification_applications')
    .select(
      'application_id,vendor_profile_id,status,decision,application_type,fee_php_centavos,doc_uploads',
    )
    .eq('application_id', input.applicationId)
    .maybeSingle();
  if (appErr) return { ok: false, error: plainRefusal('AdminVerifyActions (appErr)', appErr) };
  if (!app) return { ok: false, error: 'Application not found.' };

  const { data: vendor, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,verification_state,demotion_count,last_demoted_at,last_verified_at,next_renewal_due_at,public_visibility,papers_lapsed_at,tier_state',
    )
    .eq('vendor_profile_id', app.vendor_profile_id)
    .maybeSingle();
  if (vendorErr) return { ok: false, error: plainRefusal('AdminVerifyActions (vendorErr)', vendorErr) };
  if (!vendor) return { ok: false, error: 'Supplier not found.' };

  const fromState = parseVerificationState(vendor.verification_state);
  let toState: VerificationState = fromState;
  let appStatus = app.status as string;
  let appDecision: 'approved' | 'rejected' | null = null;
  let approveSideEffects: {
    papers_lapsed_at?: null;
    tier_state?: string;
    tier_expires_at?: string | null;
    last_verified_at?: string;
    next_renewal_due_at?: string;
    public_visibility?: 'verified';
  } = {};
  // 📨 The send-back's marked papers (rejected only) — written with the status, in the same update.
  let sentBackUploads: DocUploadMap | null = null;
  let demoteSideEffects: {
    last_demoted_at?: string;
    demotion_count?: number;
  } = {};

  switch (input.decision) {
    case 'approved': {
      // ⏸ The paid plan's held days, read BEFORE anything is written: a failed read stops the approval (retry), never
      // approves without them.
      const heldBack = (vendor as { papers_lapsed_at?: string | null }).papers_lapsed_at
        ? await heldPlanBack(admin, vendor.vendor_profile_id, new Date(now))
        : {};
      if (heldBack === null) {
        return { ok: false, error: "Couldn't read the plan this shop had waiting — nothing was changed. Try again." };
      }
      toState = 'verified';
      appStatus = 'approved';
      appDecision = 'approved';
      // 🔑 THE BADGE'S DEADLINE — the ONE renewal day, 30 March of the next year (owner 12 Nov 2026,
      // `deadlineAtApproval`): the reminder lands 60 days before it and the badge comes off on it. The reviewer's
      // permit date is recorded with the approval (audit below) but no longer sets the day. The shop's listing and
      // bookability never read this column.
      approveSideEffects = {
        // 📄 Renewed papers end a lapse at once: the shop is back in search and
        // Discover (DECISION_LOG 481b9b6b — the lapse never refused a booking).
        papers_lapsed_at: null,
        // …and the free plan the lapse took down to "free" comes back. A paid plan was never touched.
        ...((vendor as { papers_lapsed_at?: string | null }).papers_lapsed_at &&
        (vendor as { tier_state?: string | null }).tier_state === 'free'
          ? { tier_state: 'verified' as const }
          : {}),
        // ⏸ RULING (2), 14 Nov "Fable's picks taken": a PAID plan's unused days WAITED during Free · Unverified —
        // the lapse wrote what it held into its own audit row — and come back now, counted from this approval.
        ...heldBack,
        last_verified_at: now,
        // The renewal day is 30 March (owner 12 Nov · "THE RENEWAL DAY IS 30 MARCH") for EVERY approval,
        // admin or automatic — never the permit's printed date (controller correction 2026-11-14).
        next_renewal_due_at: deadlineAtApproval(new Date(now)),
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
      sentBackUploads = markSentBack(
        (app.doc_uploads ?? {}) as DocUploadMap,
        input.sentBackSlots ?? [],
        input.reason,
        now,
      );
      if (!sentBackUploads) {
        return { ok: false, error: 'Pick the paper that needs a new copy.' };
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
      if (sentBackUploads) updatePayload.doc_uploads = sentBackUploads;
    } else if (input.decision === 'set_in_review') {
      updatePayload.admin_user_id = input.actor.user_id;
    }
    const { error: appUpdErr } = await admin
      .from('vendor_verification_applications')
      .update(updatePayload)
      .eq('application_id', app.application_id);
    if (appUpdErr) return { ok: false, error: plainRefusal('AdminVerifyActions (appUpdErr)', appUpdErr) };
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
    if (vendorUpdErr) return { ok: false, error: plainRefusal('AdminVerifyActions (vendorUpdErr)', vendorUpdErr) };
    revalidateShopPage(vendor.vendor_profile_id);
  }

  // ---- Step 2b: papers approved → a vouch's papers deadline is met. ----
  // The deadline that matters now is the permit's (written above). Clearing the
  // vouch row's own `expires_at` stops the desk counting down a bridge the shop
  // has already crossed. Best-effort: most shops were never vouched for, and
  // the badge reads `next_renewal_due_at`, not this row.
  if (input.decision === 'approved') {
    const { error: vouchErr } = await admin
      .from('vendor_verification_bypasses')
      .update({ expires_at: null, updated_at: now })
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .not('expires_at', 'is', null);
    if (vouchErr) console.error('[verification-decision] vouch deadline clear failed', vouchErr.message);
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
          source: input.automatic ? 'automatic' : 'admin_queue',
          decision: input.decision,
        },
      });
    if (historyErr) return { ok: false, error: plainRefusal('AdminVerifyActions (historyErr)', historyErr) };
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
  // 🔑 WHAT THE CHECKS SAID AT PRESS TIME, RECORDED WITH THE GRANT.
  // This does NOT refuse — offered "refuse with an override" the owner did not
  // take it (2026-09-09), he answered with the automation. What changes is that
  // six months from now the row says whether anybody had checked anything.
  // Measured the day this shipped: both live shops carry the badge and NOTHING
  // anywhere records what was looked at, because nothing was.
  const evidence =
    input.decision === 'approved'
      ? await verificationEvidenceSnapshot(vendor.vendor_profile_id)
      : null;
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
      ...(input.decision === 'rejected' ? { sent_back_papers: input.sentBackSlots ?? [] } : {}),
    },
    reason: input.reason,
    actor_user_id: input.actor.user_id,
    ...(evidence
      ? {
          metadata: {
            evidence_at_grant: evidence,
            badge_deadline: approveSideEffects.next_renewal_due_at ?? null,
            badge_deadline_source: 'march_30_renewal',
            permit_valid_until: input.permitDeadlineIso ?? null,
            ...(input.automatic
              ? { approved_by: 'automatic', auto_checks: input.automatic.checks, auto_reason: input.automatic.reason }
              : {}),
          },
        }
      : {}),
  });
  if (auditErr) return { ok: false, error: plainRefusal('AdminVerifyActions (auditErr)', auditErr) };

  // 🏅 Regular verification's reward (owner 12 Nov 2026): the required papers approved → 1 × 4 weeks of Ultra, once per
  // shop, ever — a shop founders-verified earlier already had its weeks (`lib/verification-plan-reward.server.ts`).
  if (input.decision === 'approved' && toState === 'verified' && fromState !== 'verified') {
    await grantVerificationPlanReward(admin, {
      vendorProfileId: vendor.vendor_profile_id,
      door: 'regular',
      actorUserId: input.actor.user_id,
    });
  }

  // Cross-account signal (Phase B · 2026-06-19): tell the vendor their
  // verification status changed, carrying the decision_reason. Only the three
  // status-moving decisions notify; set_in_review is internal bookkeeping the
  // vendor doesn't need pinged about. Best-effort — never rolls back the
  // decision that already committed.
  if (
    input.decision === 'approved' ||
    input.decision === 'rejected' ||
    input.decision === 'demoted'
  ) {
    await notifyVendorStatusChange({
      vendorProfileId: vendor.vendor_profile_id,
      decision: input.decision,
      reason: input.reason,
      // A send-back names its papers (owner 2026-11-14, "Only the named one") — the notice says which, by label.
      sentBackPapers:
        input.decision === 'rejected'
          ? DOC_SLOTS.filter((s) => (input.sentBackSlots ?? []).includes(s.key)).map((s) => s.label)
          : undefined,
    });
  }

  return { ok: true };
}

