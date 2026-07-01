'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rescanAllReviewsForFraud } from '@/lib/review-fraud-screener';
import { scanForGhostListings } from '@/lib/ghost-listing-detector';

/**
 * /admin/integrity-watch actions — moderator resolution path for the unified
 * review-fraud + ghost-listing queue (integrity_flags, migration 20270412000042).
 *
 * A flag can be:
 *   · dismiss         — false positive / acceptable. status=dismissed.
 *   · confirm_fraud   — records the verdict + notes on a review_fraud flag ONLY.
 *                       NO auto-delete: any action against the review or vendor
 *                       is a separate, deliberate admin step. status=confirmed_fraud.
 *   · hide_listing    — ghost_listing flag ONLY: un-publishes the ghost listing
 *                       (vendor_profiles.is_published = FALSE) AND records the
 *                       verdict. status=listing_hidden. This is the one action
 *                       that touches the subject — an explicit, logged admin
 *                       decision, never automatic.
 *
 * Mirrors the requireAdmin + admin_audit_log + revalidatePath shape of
 * app/admin/repost-watch/actions.ts + app/admin/reviews/actions.ts.
 */

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

const ACTIONS = ['dismiss', 'confirm_fraud', 'hide_listing'] as const;
type Action = (typeof ACTIONS)[number];

function isAction(v: FormDataEntryValue | null): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

const ACTION_STATUS: Record<Action, 'dismissed' | 'confirmed_fraud' | 'listing_hidden'> = {
  dismiss: 'dismissed',
  confirm_fraud: 'confirmed_fraud',
  hide_listing: 'listing_hidden',
};

const ACTION_NOTE: Record<Action, string> = {
  dismiss: 'Dismissed — not fraudulent / acceptable listing.',
  confirm_fraud:
    'Confirmed review fraud. Verdict recorded; any action on the review is a separate admin step.',
  hide_listing: 'Ghost listing hidden — un-published from the marketplace.',
};

/**
 * Resolve an integrity flag. For hide_listing (ghost_listing flags only) also
 * un-publishes the subject vendor_profiles row. NEVER auto-deletes a review.
 * Logs to admin_audit_log. Idempotent via the `.eq('status','open')` guard.
 */
export async function resolveIntegrityFlag(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  const action = formData.get('action');
  const note = formData.get('note');

  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isAction(action)) {
    throw new Error('Pick an action');
  }

  const admin = createAdminClient();

  // Read the flag first — capture kind + subject + before-state for the audit
  // row and to enforce action↔kind validity.
  const { data: flag } = await admin
    .from('integrity_flags')
    .select('id, kind, subject_vendor_id, subject_review_id, status')
    .eq('id', Number(flagId))
    .maybeSingle();
  if (!flag) throw new Error('Flag not found.');

  const kind = (flag as { kind: string }).kind;
  if (action === 'confirm_fraud' && kind !== 'review_fraud') {
    throw new Error('Confirm fraud only applies to review-fraud flags.');
  }
  if (action === 'hide_listing' && kind !== 'ghost_listing') {
    throw new Error('Hide listing only applies to ghost-listing flags.');
  }

  const extraNote =
    typeof note === 'string' && note.trim().length > 0
      ? ` — ${note.trim().slice(0, 500)}`
      : '';

  // Resolve the flag FIRST, guarded on status='open' (idempotency), and capture
  // whether it actually transitioned a still-open flag. The destructive
  // un-publish below must ONLY run when this click transitioned an open flag —
  // otherwise a stale click on an already-resolved flag (e.g. the listing has
  // since recovered and the flag auto-dismissed) would un-publish a legitimate,
  // recovered listing off a no-op status update.
  const { data: transitioned, error } = await admin
    .from('integrity_flags')
    .update({
      status: ACTION_STATUS[action],
      resolution_notes: ACTION_NOTE[action] + extraNote,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', Number(flagId))
    .eq('status', 'open') // idempotency guard
    .select('id');
  if (error) throw new Error(error.message);

  // hide_listing: un-publish the ghost listing ONLY when THIS click actually
  // transitioned a still-open flag. Idempotent — a re-hide of an
  // already-resolved flag is a no-op and never touches the subject.
  if (action === 'hide_listing' && transitioned && transitioned.length > 0) {
    const vendorId = (flag as { subject_vendor_id: string }).subject_vendor_id;
    const { error: hideErr } = await admin
      .from('vendor_profiles')
      .update({ is_published: false })
      .eq('vendor_profile_id', vendorId);
    if (hideErr) throw new Error(`Failed to hide listing: ${hideErr.message}`);
  }

  // Audit — every admin mutation logs to admin_audit_log (§ 9.1 discipline).
  // Best-effort: audit failure logs to console but does NOT roll back.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: `integrity_flag_${action}`,
    target_id: flagId,
    actor_user_id: userId,
    metadata: {
      flag_id: flagId,
      kind,
      subject_vendor_id: (flag as { subject_vendor_id: string }).subject_vendor_id,
      subject_review_id:
        (flag as { subject_review_id: string | null }).subject_review_id ?? null,
      before_status: (flag as { status: string }).status,
      after_status: ACTION_STATUS[action],
    },
  });
  if (auditErr) {
    console.error('[resolveIntegrityFlag] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/integrity-watch');
}

/**
 * Admin "Rescan reviews" — re-screen every existing review against the current
 * deterministic scorer (backfill; the after() task only screens new reviews).
 */
export async function rescanReviewsForFraud() {
  await requireAdmin();
  const summary = await rescanAllReviewsForFraud();
  revalidatePath('/admin/integrity-watch');
  redirect(
    `/admin/integrity-watch?tab=reviews&scanned=${summary.reviewsScanned}&flagged=${summary.flagsUpserted}`,
  );
}

/**
 * Admin "Rescan listings" — deterministically sweep every published, non-demo
 * marketplace listing for ghost signals + upsert flags.
 */
export async function rescanGhostListings() {
  await requireAdmin();
  const summary = await scanForGhostListings();
  revalidatePath('/admin/integrity-watch');
  redirect(
    `/admin/integrity-watch?tab=listings&scanned=${summary.vendorsScanned}&flagged=${summary.flagsUpserted}`,
  );
}
