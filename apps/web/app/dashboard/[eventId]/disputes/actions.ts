'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { emitNotification } from '@/lib/notification-emit';
import { FLAG_TYPE_LABEL, isFlagType } from '@/lib/force-majeure';

/**
 * Couple-side: file a force-majeure flag against an event.
 *
 * Validates the flag type + a 30+ char description, optionally narrows the
 * scope to a specific event_vendor row, uploads any attached evidence files
 * to R2 (paths under `force-majeure/<eventId>/`), then inserts the flag via
 * the user's RLS-bound client. Membership is enforced by RLS — the INSERT
 * fails with a policy violation if the caller isn't a couple on the target
 * event.
 *
 * After the insert lands, fans out an in-app notification (+ email when
 * Resend is configured) to every internal/team-pool admin so the Disputes
 * Handler picks it up promptly.
 */
export async function fileForceMajeureFlag(formData: FormData) {
  const eventId = formData.get('event_id');
  const flagType = formData.get('flag_type');
  const description = formData.get('description');
  const eventVendorIdRaw = formData.get('event_vendor_id');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Missing event');
  }
  if (!isFlagType(flagType)) {
    throw new Error('Pick a flag type');
  }
  if (typeof description !== 'string' || description.trim().length < 30) {
    throw new Error('Description must be at least 30 characters');
  }
  if (description.trim().length > 4000) {
    throw new Error('Description must be 4000 characters or fewer');
  }

  // `event_vendor_id` is optional — "Whole event" sends an empty string.
  const eventVendorId =
    typeof eventVendorIdRaw === 'string' && eventVendorIdRaw.trim().length > 0
      ? eventVendorIdRaw.trim()
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Evidence upload — multiple files, all optional. Each file is validated
  // by uploadPublicAsset (MIME + size). We stop on the first failure so the
  // couple sees the underlying error message rather than a silent partial.
  const evidenceUrls: string[] = [];
  const files = formData.getAll('evidence');
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    const result = await uploadPublicAsset({
      pathPrefix: `force-majeure/${eventId}`,
      file: f,
    });
    if (!result.ok) {
      return redirect(
        `/dashboard/${eventId}/disputes?error=${encodeURIComponent(result.error)}`,
      );
    }
    evidenceUrls.push(result.publicUrl);
  }

  const { data: inserted, error } = await supabase
    .from('force_majeure_flags')
    .insert({
      event_id: eventId,
      event_vendor_id: eventVendorId,
      couple_user_id: user.id,
      flag_type: flagType,
      description: description.trim(),
      evidence_urls: evidenceUrls,
    })
    .select('flag_id, public_id')
    .single();
  if (error) throw new Error(error.message);

  // Notify every admin. Uses the admin client because the caller (a couple)
  // can't enumerate other users through RLS.
  try {
    const admin = createAdminClient();
    const { data: adminUsers } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true');
    if (adminUsers && adminUsers.length > 0) {
      const flagPublicId = (inserted?.public_id as string | undefined) ?? '';
      const flagId = (inserted?.flag_id as string | undefined) ?? '';
      const summary = description.trim().slice(0, 140);
      await Promise.all(
        adminUsers.map((row) =>
          emitNotification({
            userId: row.user_id as string,
            type: 'order_quoted',
            title: `Force-majeure flag · ${flagPublicId || 'new'}`,
            body: `${FLAG_TYPE_LABEL[flagType]} — ${summary}${
              summary.length === 140 ? '…' : ''
            }`,
            relatedUrl: `/admin/force-majeure/${flagId}`,
          }),
        ),
      );
    }
  } catch (e) {
    // Notifications fail soft — don't roll back the user's filed flag.
    console.error('[force-majeure] admin fan-out failed:', e);
  }

  revalidatePath(`/dashboard/${eventId}/disputes`);
  redirect(`/dashboard/${eventId}/disputes?filed=1`);
}
