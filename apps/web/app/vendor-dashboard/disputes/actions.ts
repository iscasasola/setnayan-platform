'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * /vendor-dashboard/disputes — vendor mediation actions.
 *
 * "Stand up for yourself": a vendor can formally CONTEST a dispute filed
 * against them by writing their side of the story. The neutral team reads the
 * contest in /admin/disputes and adjudicates BEFORE the dispute can touch the
 * vendor's rating (an unreviewed dispute never counts toward demotion — see
 * migration 20270413204817).
 *
 * The write is scoped three ways:
 *   • The vendor's own session (RLS: vendor_disputes_self_read lets a vendor
 *     read disputes against their profile; vendor_disputes_vendor_contest lets
 *     them UPDATE their own rows).
 *   • The column-guard trigger (guard_vendor_dispute_contest_columns) reverts
 *     any attempt to touch anything other than vendor_contest +
 *     vendor_contested_at for a non-service-role caller — so this action can
 *     never self-clear the demotion flag or flip status.
 *   • This action only lets a vendor contest an OPEN dispute (once the team has
 *     ruled, the record is final).
 */

const CONTEST_MAX = 2000;

async function requireVendorProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) throw new Error('Vendor profile not found.');
  return { user, profile };
}

/**
 * Submit (or update) the vendor's contest note on an open dispute filed against
 * their profile. Stamps vendor_contested_at on write.
 */
export async function submitDisputeContest(formData: FormData) {
  const disputeId = formData.get('dispute_id');
  const rawContest = formData.get('vendor_contest');
  if (typeof disputeId !== 'string' || disputeId.length === 0) {
    throw new Error('Invalid input');
  }
  const contest = typeof rawContest === 'string' ? rawContest.trim() : '';
  if (contest.length === 0) {
    throw new Error('Write your side of the story before submitting.');
  }
  if (contest.length > CONTEST_MAX) {
    throw new Error(`Keep your response under ${CONTEST_MAX} characters.`);
  }

  const supabase = await createClient();
  const { profile } = await requireVendorProfile(supabase);

  // Scope the update to this vendor's own OPEN dispute. RLS + the column-guard
  // trigger enforce that only vendor_contest + vendor_contested_at can change;
  // the explicit vendor_profile_id + status filters make the intent obvious and
  // give a clean "already resolved" message on a stale render.
  const { data: updated, error } = await supabase
    .from('vendor_disputes')
    .update({
      vendor_contest: contest,
      vendor_contested_at: new Date().toISOString(),
    })
    .eq('dispute_id', disputeId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('status', 'open')
    .select('dispute_id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) {
    // Either the dispute isn't against this vendor, or it's already been
    // resolved by the team (no longer open). Re-read for a useful message.
    const { data: existing } = await supabase
      .from('vendor_disputes')
      .select('status')
      .eq('dispute_id', disputeId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (!existing) throw new Error('Dispute not found.');
    throw new Error(
      `This dispute has already been reviewed (status: ${existing.status}) — your response can no longer be edited. Reach out to the Setnayan team if you have new information.`,
    );
  }

  revalidatePath('/vendor-dashboard/disputes');
}
