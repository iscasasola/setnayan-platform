'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
/**
 * /admin/disputes resolution actions (cross-actor audit 2026-06-07).
 *
 * Until now `/admin/disputes` was a read-only list (iteration 0023 § 3.6 MVP)
 * and the page told admins to "update a row directly in Supabase Studio." That
 * left a genuine couple↔vendor dispute with NO in-app governance path — the
 * exact gap the cross-actor audit flagged. This adds the resolve write path.
 *
 * No migration is needed: `vendor_disputes.status` already carries the
 * resolved_for_vendor / resolved_for_couple / withdrawn values (migration
 * 20260516210000). We update status + resolution_notes + resolved_at and
 * notify the person who opened the dispute so the outcome reaches them.
 *
 * Mirrors the requireAdmin + emitNotification shape of
 * app/admin/force-majeure/actions.ts (the parallel couple-filed flow).
 */

const RESOLUTIONS = [
  'resolved_for_vendor',
  'resolved_for_couple',
  'withdrawn',
] as const;
type Resolution = (typeof RESOLUTIONS)[number];

const RESOLUTION_LABEL: Record<Resolution, string> = {
  resolved_for_vendor: 'Resolved in the vendor’s favor',
  resolved_for_couple: 'Resolved in the couple’s favor',
  withdrawn: 'Withdrawn',
};

function isResolution(v: FormDataEntryValue | null): v is Resolution {
  return typeof v === 'string' && (RESOLUTIONS as readonly string[]).includes(v);
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Apply a resolution to a vendor dispute. Captures resolution notes (required
 * for the two adjudicated lanes so there's an audit trail; optional for a
 * plain withdrawal) and stamps resolved_at = now(). Notifies the opener so
 * the decision lands in their notification tray + inbox.
 */
export async function resolveDispute(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  const disputeId = formData.get('dispute_id');
  const resolution = formData.get('resolution');
  const notes = nullIfBlank(formData.get('resolution_notes'));

  if (typeof disputeId !== 'string' || disputeId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isResolution(resolution)) {
    throw new Error('Pick a resolution');
  }
  // Require notes for the adjudicated outcomes — a "resolved for X" with no
  // rationale is useless six months later when a pattern is being reviewed.
  if (resolution !== 'withdrawn' && !notes) {
    throw new Error(
      `${RESOLUTION_LABEL[resolution]} needs notes — record what was decided and why.`,
    );
  }

  const admin = createAdminClient();
  // Review is the demotion GATE (dispute-mediation, 2027-04-13). A dispute
  // demotes a vendor's rating ONLY when the neutral team resolves it against
  // the vendor. So the resolution sets counts_toward_demotion explicitly:
  //   • resolved_for_couple → TRUE  (the record was reviewed AND went against
  //                                   the vendor — it now feeds the 3-in-30
  //                                   demote-to-coming_soon counter)
  //   • resolved_for_vendor / withdrawn → FALSE (never counts)
  // Combined with the migration's default FALSE + the tightened
  // count_vendor_disputes_30d (resolved_for_couple only), an unreviewed 'open'
  // dispute can never silently demote.
  const countsTowardDemotion = resolution === 'resolved_for_couple';
  // State-machine guard (cross-account QA, 2026-06-19): only flip an OPEN
  // dispute. If the row was already resolved/withdrawn (race with another
  // admin, double-click after a 503, stale page render), the `status='open'`
  // filter drops it and the .maybeSingle() returns null — surface to the admin
  // as "already resolved — refresh" instead of silently re-firing the opener
  // notification + re-stamping resolved_at. Mirrors approvePayment's
  // pending→matched guard in app/admin/payments/actions.ts.
  const { data: updated, error } = await admin
    .from('vendor_disputes')
    .update({
      status: resolution,
      resolution_notes: notes,
      counts_toward_demotion: countsTowardDemotion,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('dispute_id', disputeId)
    .eq('status', 'open')
    .select('dispute_id, public_id, opened_by_user_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) {
    // Either the dispute_id doesn't exist or it's no longer open. Re-read so
    // the admin gets a useful message rather than a generic crash.
    const { data: existing } = await admin
      .from('vendor_disputes')
      .select('status')
      .eq('dispute_id', disputeId)
      .maybeSingle();
    if (!existing) throw new Error('Dispute not found');
    throw new Error(
      `Dispute already resolved (status: ${existing.status}). Refresh the page.`,
    );
  }

  // Admin audit trail (cross-account QA, 2026-06-19). vendor_disputes had no
  // governance audit row before; record who resolved it, the before/after
  // status, and the rationale. Best-effort — the resolution already committed,
  // so an audit hiccup must never roll it back. admin_audit_log has no
  // `metadata` column in V1, so we stay within the canonical insert shape used
  // by app/admin/verify/actions.ts.
  try {
    await admin.from('admin_audit_log').insert({
      action: 'dispute_resolved',
      target_table: 'vendor_disputes',
      target_id: updated.dispute_id as string,
      before_json: { status: 'open', counts_toward_demotion: false },
      after_json: { status: resolution, counts_toward_demotion: countsTowardDemotion },
      reason: notes,
      actor_user_id: adminUserId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/disputes] audit insert failed (non-fatal):', e);
  }

  // Notify the opener. vendor_disputes can be opened by either party; the
  // opener is the one waiting on the outcome. Reuse `order_quoted` — the
  // established "an admin update needs your attention" type (same reuse as
  // force-majeure resolveFlag). relatedUrl is left null because the route
  // differs by actor and vendor_disputes has no single canonical surface;
  // the notification body carries the full outcome.
  if (updated?.opened_by_user_id) {
    try {
      await emitNotification({
        userId: updated.opened_by_user_id as string,
        type: 'order_quoted',
        title: `Your dispute ${updated.public_id} has been resolved`,
        body:
          `${RESOLUTION_LABEL[resolution]}.` +
          (notes ? ` Note from the Setnayan team: ${notes}` : ''),
        relatedUrl: null,
      });
    } catch (e) {
      // Fail-soft — the resolution already committed.
      console.error('[admin/disputes] opener notification failed:', e);
    }
  }

  revalidatePath('/admin/disputes');
}

/* ───────────────────────────────────────────────────────────────────────────
   A DISPUTE IS NOT AN ERASER — Setnayan settles "the downpayment never
   reached me" by hand.

   ⚖ Owner 2026-08-28: "no. do not. we will confirm it manually."

   🔑 WHY THIS LIVES BESIDE resolveDispute AND NOT IN `vendor_disputes`. Reuse
   was measured and rejected: that table's own
   `CHECK (payout_id IS NOT NULL OR order_id IS NOT NULL)` cannot be satisfied
   by a deposit dispute — couple→supplier money is off-platform by owner lock,
   so there is no order and no payout — and the table feeds the 3-in-30
   demotion cron, which would put a supplier who RAISED a dispute one boolean
   away from being demoted by it. The settlement is therefore recorded beside
   the deposit facts on `event_vendors`, and the permanent history lands in
   `admin_audit_log` exactly as resolveDispute's does.

   🔒 THE GATE IS IN THE DATABASE, NOT HERE. settle_vendor_deposit_dispute is
   SECURITY DEFINER and checks is_admin() itself; requireAdmin() below is the
   surface's gate, not the security boundary.
   ─────────────────────────────────────────────────────────────────────────── */

const DEPOSIT_OUTCOMES = ['payment_stands', 'not_received'] as const;
type DepositOutcome = (typeof DEPOSIT_OUTCOMES)[number];

const DEPOSIT_OUTCOME_LABEL: Record<DepositOutcome, string> = {
  payment_stands: 'Setnayan confirmed the downpayment reached the supplier',
  not_received: 'Setnayan confirmed the downpayment did not arrive',
};

export async function settleDepositDispute(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  const eventVendorId = formData.get('event_vendor_id');
  const outcomeRaw = formData.get('outcome');
  /*
    ⚠ WRITTEN AS `String(formData.get(...))` + a falsy check ON PURPOSE, not as
    the `nullIfBlank` helper used above. That is the shape
    lib/admin-map/scan-admin-jobs.ts can actually READ (the 135-site house
    idiom), and the admin map's checklist tells an operator which fields a job
    refuses to run without. In the helper's shape this job would have been
    published as refusing nothing — a checklist that quietly understates what
    it needs.
    📋 NAMED, NOT FIXED: 8 admin actions files use that helper, so other jobs
    are likely understated the same way. Teaching the scanner the helper shape
    would rewrite many rows at once and belongs with the admin-map work, not
    here.
  */
  const note = String(formData.get('note') ?? '').trim();

  if (typeof eventVendorId !== 'string' || !eventVendorId) {
    throw new Error('Invalid input');
  }
  if (
    typeof outcomeRaw !== 'string' ||
    !(DEPOSIT_OUTCOMES as readonly string[]).includes(outcomeRaw)
  ) {
    throw new Error('Pick an outcome');
  }
  const outcome = outcomeRaw as DepositOutcome;
  // A settlement is a money decision about two other people. It must say why,
  // because the reason is shown to BOTH of them.
  if (!note) throw new Error('Say what you confirmed — both parties are shown this note.');

  const admin = createAdminClient();

  // Read the booking BEFORE settling: `payment_stands` clears the supplier's
  // words off the row to satisfy the one-way CHECK, and the audit row is where
  // they survive verbatim.
  const { data: booking } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, event_id, vendor_name, marketplace_vendor_id, deposit_paid_php, deposit_declined_at, deposit_decline_reason',
    )
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (!booking) throw new Error('Booking not found');

  /*
    🔑 THE RPC GOES THROUGH THE ADMIN'S OWN SESSION, NOT `admin`.
    settle_vendor_deposit_dispute gates on is_admin(), which reads auth.uid().
    The service-role client carries NO user, so auth.uid() is NULL there,
    is_admin() is false, and the function would RAISE on every single call —
    the feature would have been dead in production while looking finished.
    service_role bypasses RLS *policies* and fails every check that asks WHO
    IS THIS. Caught by lib/admin-gated-rpc-needs-a-session.test.ts, which
    derives its list of gated functions from the migrations.
    `admin` is still used above and below, for reads and for notifying people
    other than the caller.
  */
  const sessionDb = await createClient();
  const { data, error } = await sessionDb.rpc('settle_vendor_deposit_dispute', {
    p_event_vendor_id: eventVendorId,
    p_outcome: outcome,
    p_note: note,
  });
  if (error) throw new Error(error.message);

  const env = (data ?? {}) as { status?: string; claim?: string | null };
  if (env.status !== 'ok') {
    // 'already' / 'no_dispute' are honest answers, not crashes — another admin
    // got there first, or the couple has already sent it again.
    revalidatePath('/admin/disputes');
    redirect(`/admin/disputes?settled=${env.status ?? 'unknown'}`);
  }

  // Permanent history. Best-effort: the settlement has already committed, so an
  // audit hiccup must never roll it back (same posture as resolveDispute).
  try {
    await admin.from('admin_audit_log').insert({
      action: 'deposit_dispute_settled',
      target_table: 'event_vendors',
      target_id: eventVendorId,
      before_json: {
        deposit_declined_at: booking.deposit_declined_at,
        // The supplier's own words, kept here because `payment_stands` clears
        // them from the row.
        supplier_claim: env.claim ?? booking.deposit_decline_reason,
        deposit_paid_php: booking.deposit_paid_php,
      },
      after_json: { deposit_dispute_outcome: outcome },
      reason: note,
      actor_user_id: adminUserId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/disputes] deposit settlement audit insert failed (non-fatal):', e);
  }

  /*
    BOTH parties hear the outcome. `dispute_resolved` is an existing type that
    is already on the email allowlist and — measured 2026-08-28 — had ZERO emit
    sites, so this is a type finally getting a handle rather than a new one
    needing a migration and an enum ADD VALUE.
  */
  const supplierName = (booking.vendor_name as string | null) ?? 'your supplier';
  const eventId = booking.event_id as string | null;
  const title =
    outcome === 'payment_stands'
      ? 'Setnayan settled the downpayment question'
      : 'Setnayan could not confirm your downpayment';
  const body = `${DEPOSIT_OUTCOME_LABEL[outcome]}. Note from the Setnayan team: ${note}`;

  try {
    const recipients = new Set<string>();
    if (eventId) {
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) if (m.user_id) recipients.add(m.user_id as string);
    }
    // The supplier who raised it. Resolved through the shop that owns the
    // booking — the account that pressed the button.
    if (booking.marketplace_vendor_id) {
      const { data: shop } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', booking.marketplace_vendor_id as string)
        .maybeSingle();
      if (shop?.user_id) recipients.add(shop.user_id as string);
    }
    for (const userId of recipients) {
      await emitNotification({
        userId,
        type: 'dispute_resolved',
        title,
        body:
          outcome === 'not_received'
            ? `${body} Your receipt is still on file — send it to ${supplierName} again from the vendor workspace.`
            : body,
        relatedUrl: eventId ? `/dashboard/${eventId}/vendors/${eventVendorId}/workspace` : null,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/disputes] deposit settlement notify failed (non-fatal):', e);
  }

  revalidatePath('/admin/disputes');
  revalidatePath('/admin/work');
  if (eventId) revalidatePath(`/dashboard/${eventId}/vendors/${eventVendorId}/workspace`);
  redirect('/admin/disputes?settled=ok');
}
