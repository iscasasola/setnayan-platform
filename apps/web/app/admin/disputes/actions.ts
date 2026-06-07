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
  await requireAdmin();
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
  const { data: updated, error } = await admin
    .from('vendor_disputes')
    .update({
      status: resolution,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
    })
    .eq('dispute_id', disputeId)
    .select('dispute_id, public_id, opened_by_user_id')
    .single();
  if (error) throw new Error(error.message);

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
