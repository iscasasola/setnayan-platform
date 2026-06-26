'use server';

// ACCOUNT-LEVEL FACE PROFILE — consent actions (opt-in + "forget everywhere").
//
// ⚠ BIOMETRIC = SENSITIVE PERSONAL INFO under RA 10173. Everything here is gated
// behind NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED (default OFF). DPO sign-off on
// the consent copy + retention is REQUIRED before the flag is flipped.
//
// Guardrails honored:
//   1. OPT-IN, PER PERSON ONLY — both actions operate ONLY on the signed-in
//      user's own row (auth.uid()). A user can only opt IN/OUT of their OWN face.
//   3. ACCOUNT-LEVEL DELETE — `forgetMyFaceEverywhere` deletes the account
//      profile and (optionally) the user's OWN per-event guest enrollments.
//   4. FLAG-GATED OFF — both actions hard-return when the flag is OFF.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  accountFaceProfileEnabled,
  ACCOUNT_FACE_CONSENT_VERSION,
} from '@/lib/account-face-profile';

const PROFILE_PATH = '/dashboard/profile';

/**
 * Opt IN or OUT of "remember my face across my events". OFF by default for every
 * account: the user only ever has a profile after an explicit opt-in here.
 *
 * - Opt IN  → upsert the user's OWN profile row with consent recorded. The face
 *             vector itself stays NULL until the on-device embedder fills it
 *             (feature ships dormant); the row is the consent signal.
 * - Opt OUT → delete the account profile entirely ("forget" semantics — we never
 *             keep a biometric row the user has switched off).
 */
export async function setAccountFaceProfileConsent(formData: FormData) {
  if (!accountFaceProfileEnabled()) redirect(PROFILE_PATH);

  const raw = formData.get('enabled');
  if (raw !== 'true' && raw !== 'false') {
    throw new Error('Invalid face-profile preference');
  }
  const enable = raw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (enable) {
    // Upsert the user's OWN row. RLS (auth.uid() = user_id) + the unique user_id
    // constraint mean this can only ever touch the caller's own profile.
    const { error } = await supabase.from('user_face_profiles').upsert(
      {
        user_id: user.id,
        consent_version: ACCOUNT_FACE_CONSENT_VERSION,
        consent_granted_at: new Date().toISOString(),
        revoked_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(error.message);
  } else {
    // Opting out forgets the account profile — we don't retain a switched-off
    // biometric row. Per-event enrollments are untouched here (use the explicit
    // "forget everywhere" control to wipe those too).
    const { error } = await supabase
      .from('user_face_profiles')
      .delete()
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath(PROFILE_PATH);
  redirect(`${PROFILE_PATH}?saved=1`);
}

/**
 * "Forget my face everywhere" — account-level erasure (guardrail #3). Deletes
 * the account profile, and when the checkbox is set, ALSO revokes the user's OWN
 * per-event guest face enrollments (the rows whose guest belongs to this user
 * via event_members). Uses the admin client for the per-event sweep because
 * those rows are written through admin-client server actions; every WHERE clause
 * is scoped to the caller's own user_id, so it can never touch anyone else.
 */
export async function forgetMyFaceEverywhere(formData: FormData) {
  if (!accountFaceProfileEnabled()) redirect(PROFILE_PATH);

  const alsoEvents = formData.get('also_event_enrollments') === '1';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 1. Delete the account-level profile (owner-scoped via RLS).
  const { error: profErr } = await supabase
    .from('user_face_profiles')
    .delete()
    .eq('user_id', user.id);
  if (profErr) throw new Error(profErr.message);

  // 2. Optionally revoke the user's OWN per-event enrollments.
  if (alsoEvents) {
    const admin = createAdminClient();
    // The guest rows that are THIS user's, via event_members.
    const { data: memberGuests } = await admin
      .from('event_members')
      .select('guest_id')
      .eq('user_id', user.id)
      .not('guest_id', 'is', null);
    const guestIds = Array.from(
      new Set((memberGuests ?? []).map((m) => m.guest_id as string).filter(Boolean)),
    );
    if (guestIds.length > 0) {
      await admin
        .from('guest_face_enrollments')
        .update({
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('guest_id', guestIds)
        .is('revoked_at', null);
    }
  }

  revalidatePath(PROFILE_PATH);
  redirect(`${PROFILE_PATH}?face_forgotten=1`);
}
