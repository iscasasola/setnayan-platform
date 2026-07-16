'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { manilaToday } from '@/lib/std-views';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { claimBirthdateCutoff } from '@/lib/dependent-people';

/**
 * Redeem an alaga hand-over link (owner-locked 2026-07-16 ownership rule).
 * Two purposes, both redeemed as ONE conditional UPDATE through the service
 * role — atomic, so a raced/expired/revoked token simply matches zero rows:
 *  - 'claim' (person, ≥18): stamps handed_over_at + claimed_user_id. The row
 *    stays with the guardian read-only (RLS freezes their pen); the person now
 *    owns their data. The age proof is re-checked IN the UPDATE's WHERE
 *    (birth_date ≤ today − 18y, Manila) — the link being minted is not trusted.
 *  - 'rehome' (pet/other): owner_user_id moves to the redeemer; spouse-sharing
 *    resets (the old household's consent doesn't travel).
 */
export async function claimAlaga(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/');
  const token = String(formData.get('token') ?? '').trim();
  if (!token) redirect('/');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}`);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('dependents')
    .select('dependent_id, claim_token_purpose, owner_user_id')
    .eq('claim_token', token)
    .maybeSingle();
  if (!row) redirect(`/claim/${token}?error=invalid`);
  if (row.owner_user_id === user.id) redirect(`/claim/${token}?error=own_link`);

  const nowISO = new Date().toISOString();

  if (row.claim_token_purpose === 'claim') {
    const { data: updated } = await admin
      .from('dependents')
      .update({
        handed_over_at: nowISO,
        claimed_user_id: user.id,
        claim_token: null,
        claim_token_purpose: null,
        claim_token_expires_at: null,
      })
      .eq('claim_token', token)
      .is('handed_over_at', null)
      .eq('dependent_kind', 'person')
      .lte('birth_date', claimBirthdateCutoff(manilaToday()))
      .gt('claim_token_expires_at', nowISO)
      .select('dependent_id');
    if (!updated?.length) redirect(`/claim/${token}?error=invalid`);
  } else if (row.claim_token_purpose === 'rehome') {
    const { data: updated } = await admin
      .from('dependents')
      .update({
        owner_user_id: user.id,
        shared_with_spouse: false,
        claim_token: null,
        claim_token_purpose: null,
        claim_token_expires_at: null,
      })
      .eq('claim_token', token)
      .is('handed_over_at', null)
      .in('dependent_kind', ['pet', 'other'])
      .gt('claim_token_expires_at', nowISO)
      .select('dependent_id');
    if (!updated?.length) redirect(`/claim/${token}?error=invalid`);
  } else {
    redirect(`/claim/${token}?error=invalid`);
  }

  redirect('/dashboard/people?claimed=1');
}
