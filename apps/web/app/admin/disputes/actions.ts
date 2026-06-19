'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

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
      before_json: { status: 'open' },
      after_json: { status: resolution },
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
