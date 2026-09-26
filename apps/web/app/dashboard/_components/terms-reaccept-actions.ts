'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { TERMS_FIELD, TERMS_VERSION, hasAgreedToTerms } from '@/lib/terms-agreement';

/**
 * Record the agreement the one-time re-ask asked for (`needsTermsAgreement`).
 *
 * Refuses without the ticked box (`hasAgreedToTerms` fails closed), writes only
 * the signed-in person's own row, and only where nothing is recorded yet — a
 * stale second press can never overwrite an earlier agreement's date. The admin
 * client is scoped by `user_id` from the session, the same way sign-up stamps it
 * (`lib/event-account-link.ts` `recordTermsForNewAccount`).
 */
export async function acceptTermsNow(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (!hasAgreedToTerms(formData.get(TERMS_FIELD))) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq('user_id', user.id)
    .is('terms_accepted_at', null);
  if (error) console.error('[supabase-error] dashboard/terms-reaccept · from:users.update', error);
  revalidatePath('/dashboard', 'layout');
}
