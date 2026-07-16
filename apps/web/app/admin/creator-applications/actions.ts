'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';

/**
 * /admin/creator-applications — review queue for self-serve creator-program
 * applications (Adventure Chapter · CP-1b).
 *
 * A non-creator files a `creator_applications` row (pending) from the creator
 * dashboard's "Become a creator" form. An admin reviews here and either:
 *
 *   • Approve → flips `users.is_creator = TRUE` (the ONLY code path that grants
 *     creator access, besides a direct admin DB grant) + stamps the application
 *     approved. Creators are FREE — no SKU, no charge.
 *   • Reject → stamps the application rejected with a required note; the user
 *     stays a non-creator and may re-apply.
 *
 * Both writes go through the service-role admin client (RLS-bypassing), gated by
 * requireAdminAction() (is_internal / is_team_member / account_type='admin').
 */

const SURFACE = '/admin/creator-applications';

/**
 * Load the pending application + verify it's still actionable. Shared front-half
 * of approve + reject so a stale row (already actioned by another admin) is
 * caught before we grant anything.
 */
async function loadPending(applicationId: string) {
  const admin = createAdminClient();
  const { data: app, error } = await admin
    .from('creator_applications')
    .select('application_id, user_id, status')
    .eq('application_id', applicationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!app) throw new Error('Application not found.');
  if (app.status !== 'pending') {
    throw new Error(
      `This application is already ${app.status} — refresh the queue to see the current state.`,
    );
  }
  return { admin, app };
}

function readApplicationId(formData: FormData): string {
  const raw = formData.get('application_id');
  if (typeof raw !== 'string' || !raw) throw new Error('Missing application.');
  return raw;
}

export async function approveApplication(formData: FormData) {
  const { userId: adminUserId } = await requireAdminAction();
  const applicationId = readApplicationId(formData);
  const noteRaw = formData.get('note');
  const note =
    typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim().slice(0, 2000) : null;

  const { admin, app } = await loadPending(applicationId);

  // Grant creator access FIRST — this is the actual entitlement. is_creator is a
  // FREE access flag, never a SKU.
  const { error: grantErr } = await admin
    .from('users')
    .update({ is_creator: true })
    .eq('user_id', app.user_id);
  if (grantErr) throw new Error(grantErr.message);

  // Then stamp the application approved (re-approve is idempotent if this fails).
  const { error: stampErr } = await admin
    .from('creator_applications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      note,
    })
    .eq('application_id', applicationId);
  if (stampErr) throw new Error(stampErr.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?actioned=approved`);
}

export async function rejectApplication(formData: FormData) {
  const { userId: adminUserId } = await requireAdminAction();
  const applicationId = readApplicationId(formData);
  const noteRaw = formData.get('note');
  const note = typeof noteRaw === 'string' ? noteRaw.trim().slice(0, 2000) : '';
  if (note.length === 0) {
    throw new Error('Add a short note explaining the rejection.');
  }

  const { admin } = await loadPending(applicationId);

  const { error } = await admin
    .from('creator_applications')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      note,
    })
    .eq('application_id', applicationId);
  if (error) throw new Error(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?actioned=rejected`);
}
