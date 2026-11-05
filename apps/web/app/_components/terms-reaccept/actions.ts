'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  TERMS_FIELD,
  TERMS_SAVE_FAILED_MESSAGE,
  TERMS_VERSION,
  hasAgreedToTerms,
} from '@/lib/terms-agreement';

export type TermsAgreementResult = { ok: true } | { ok: false; message: string };

/**
 * Record the agreement the one-time re-ask asked for (`needsTermsAgreement`), and the desktop sign-up door's carried
 * tick (`lib/desktop-oauth.ts`).
 *
 *   · Refuses without the affirmative press — `hasAgreedToTerms` fails closed. The re-ask's "I agree" is a submit
 *     button whose name/value is posted ONLY by a real press on it; nothing pre-sets it.
 *   · Writes only the signed-in person's own row, on the service-role client, the same way sign-up stamps it
 *     (`lib/event-account-link.ts` `recordTermsForNewAccount`) — the subject cannot author their own consent record
 *     through PostgREST (`guard_users_privilege_columns`).
 *   · Writes only where the record is NOT already this version (none, or an older one). A stale second press can
 *     never move the date of an agreement to the current Terms.
 *   · 🔑 RETURNS what happened. The re-ask must never trap anyone: a failed save is SAID, with a Retry, and the sheet
 *     stays — never a silent no-op that looks like it worked and then asks again.
 */
export async function acceptTermsNow(formData: FormData): Promise<TermsAgreementResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'You were signed out. Sign in again to continue.' };
  if (!hasAgreedToTerms(formData.get(TERMS_FIELD))) {
    return { ok: false, message: 'Press "I agree" to continue.' };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('users')
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .eq('user_id', user.id)
      .or(`terms_version.is.null,terms_version.lt.${TERMS_VERSION}`);
    if (error) {
      console.error('[supabase-error] terms-reaccept · from:users.update', error);
      return { ok: false, message: TERMS_SAVE_FAILED_MESSAGE };
    }
  } catch (caught) {
    console.error('[supabase-error] terms-reaccept · threw', caught);
    return { ok: false, message: TERMS_SAVE_FAILED_MESSAGE };
  }
  // A server action's revalidate also purges the client Router Cache, so every signed-in tree re-reads the record on
  // its next navigation; the sheet's own `router.refresh()` re-renders the page it sits on. Never `('/', 'layout')` —
  // that busts the supplier layout's cache for everyone (`scripts/lint-vendor-layout-revalidate.mjs`).
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
