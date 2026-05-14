'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  FLAG_STATUS_LABEL,
  isResolutionAction,
  type ResolutionAction,
} from '@/lib/force-majeure';

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
 * "Take ownership" — sets the admin handler and moves a still-`open` flag
 * to `under_review`. Idempotent: re-clicking just rewrites the same handler.
 * Re-taking ownership of a resolved row is allowed but doesn't change
 * status (admin may be re-opening their notes); a resolution action is
 * required to flip the status back to a resolution lane.
 */
export async function takeOwnership(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();

  // Promote to `under_review` only if the flag is still `open`. Anything
  // already resolved keeps its existing status; we just overwrite the handler.
  const { data: existing } = await admin
    .from('force_majeure_flags')
    .select('status')
    .eq('flag_id', flagId)
    .maybeSingle();

  const payload: Record<string, string | null> = {
    admin_handler_user_id: userId,
  };
  if (existing && (existing.status as string) === 'open') {
    payload.status = 'under_review';
  }

  const { error } = await admin
    .from('force_majeure_flags')
    .update(payload)
    .eq('flag_id', flagId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/force-majeure/${flagId}`);
  revalidatePath('/admin/force-majeure');
}

/**
 * Apply one of the six resolution actions to a flag. Captures resolution
 * notes (required for refund/partial-credit, optional otherwise to stay
 * out of the admin's way) and stamps resolved_at = now() so the SLA
 * countdown stops in the queue view.
 *
 * Also notifies the couple_user_id so they see the resolution land in
 * their notifications drawer and (if Resend is configured) their inbox.
 */
export async function resolveFlag(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  const action = formData.get('action');
  const notes = nullIfBlank(formData.get('resolution_notes'));

  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isResolutionAction(action)) {
    throw new Error('Invalid resolution action');
  }
  // Encourage notes for the financial outcomes so there's an audit trail.
  if ((action === 'refund_issued' || action === 'partial_credit') && !notes) {
    throw new Error(
      `${FLAG_STATUS_LABEL[action]} needs notes — record the amount + payment channel.`,
    );
  }

  const admin = createAdminClient();
  const newStatus: ResolutionAction = action;
  const { data: updated, error } = await admin
    .from('force_majeure_flags')
    .update({
      status: newStatus,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      admin_handler_user_id: userId, // ensure the resolver is on the row
    })
    .eq('flag_id', flagId)
    .select('flag_id, public_id, event_id, couple_user_id')
    .single();
  if (error) throw new Error(error.message);

  // Notify the couple. The notification type list is small; `order_quoted`
  // already serves "admin update needs your attention" elsewhere in the app.
  if (updated?.couple_user_id) {
    try {
      await emitNotification({
        userId: updated.couple_user_id as string,
        type: 'order_quoted',
        title: `Your dispute ${updated.public_id} is ${FLAG_STATUS_LABEL[newStatus].toLowerCase()}`,
        body:
          notes ??
          `An admin reviewed your flag and applied the following resolution: ${FLAG_STATUS_LABEL[newStatus]}.`,
        relatedUrl: `/dashboard/${updated.event_id as string}/disputes`,
      });
    } catch (e) {
      console.error('[force-majeure] couple notification failed:', e);
    }
  }

  revalidatePath(`/admin/force-majeure/${flagId}`);
  revalidatePath('/admin/force-majeure');
}
