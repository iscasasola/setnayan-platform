'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { logQueryError } from '@/lib/supabase/error-detect';

export type ReviewMinState = { ok: boolean; message: string | null };

/**
 * The count at which a supplier is listed for review (owner 2026-10-12 #12:
 * admin-set, default 2, review only). It changes what the admin is SHOWN —
 * nothing is charged or sent. Audited like every other platform setting.
 */
export async function saveFeeReviewMin(_prev: ReviewMinState, formData: FormData): Promise<ReviewMinState> {
  const { userId: adminUserId } = await requireAdminAction();
  const raw = String(formData.get('fee_review_unsettled_events_min') ?? '').trim();
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    return { ok: false, message: 'The count must be a whole number, 1 or more.' };
  }
  const value = Number(raw);
  const admin = createAdminClient();
  const { data: prior, error: priorErr } = await admin
    .from('platform_settings')
    .select('fee_review_unsettled_events_min')
    .eq('id', 1)
    .maybeSingle();
  // The audit row records the value before the edit; an unread "before" is not
  // a blank one, so nothing is saved without it.
  if (priorErr) return { ok: false, message: `Couldn't read the current count — ${priorErr.message}` };
  const { error } = await admin
    .from('platform_settings')
    .update({ fee_review_unsettled_events_min: value, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'fee_review_min_edit',
    target_id: 'fee_review_unsettled_events_min',
    actor_user_id: adminUserId,
    metadata: { table: 'platform_settings', before: prior ?? null, after: { fee_review_unsettled_events_min: value } },
  });
  // The count is saved; a missing audit row is logged, never a silent gap.
  if (auditErr) logQueryError('admin/booking-fees.saveFeeReviewMin.audit', auditErr);
  revalidatePath('/admin/booking-fees');
  return { ok: true, message: 'Saved.' };
}
